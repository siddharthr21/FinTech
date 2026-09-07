"""
Minimal OpenAI-compatible chat client for the specialist agents.

Every provider we care about (Groq, Google AI Studio, Cerebras, OpenRouter,
Together, a local Ollama) exposes the same /chat/completions shape, so there is
one client and the provider is chosen with two environment variables:

    LLM_BASE_URL=https://api.groq.com/openai/v1        LLM_MODEL=openai/gpt-oss-120b
    LLM_BASE_URL=https://api.cerebras.ai/v1            LLM_MODEL=llama-3.3-70b
    LLM_BASE_URL=https://openrouter.ai/api/v1          LLM_MODEL=<something>:free
    LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
                                                       LLM_MODEL=gemini-2.0-flash
    LLM_BASE_URL=http://localhost:11434/v1             LLM_MODEL=llama3.1  (Ollama, no key)

Uses urllib only, matching scripts/setup_airtable.py — no new dependency.
"""

import http.client
import json
import os
import re
import time
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"


def load_dotenv(path: str = ".env") -> None:
    """Populate os.environ from a .env file, without overriding real env vars."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def get_api_key() -> str:
    return (
        os.environ.get("LLM_API_KEY")
        or os.environ.get("GROQ_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or ""
    )


def is_configured() -> bool:
    """A local Ollama needs no key; every hosted provider does."""
    base_url = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL)
    return bool(get_api_key()) or "localhost" in base_url or "127.0.0.1" in base_url


_PROVIDER_HOSTS = (
    ("groq.com", "groq"),
    ("cerebras.ai", "cerebras"),
    ("openrouter.ai", "openrouter"),
    ("generativelanguage.googleapis.com", "google-ai-studio"),
    ("localhost", "ollama"),
    ("127.0.0.1", "ollama"),
)


def current_model_label() -> tuple:
    """(provider, model) for whichever LLM_BASE_URL/LLM_MODEL are active.

    Stamped onto every live-mode report as model_provider/model_id so a
    verdict can be traced back to exactly which model produced it - the
    provider guess is cosmetic (for a human reading the audit trail), the
    model id is the load-bearing part.
    """
    base_url = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL)
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)
    provider = next((name for host, name in _PROVIDER_HOSTS if host in base_url), "custom")
    return provider, model


def _strip_code_fence(text: str) -> str:
    """Models ignore 'no markdown' often enough to be worth handling."""
    text = text.strip()
    if not text.startswith("```"):
        return text
    body = text.split("\n", 1)[1] if "\n" in text else ""
    return body.rsplit("```", 1)[0].strip()


class AgentCallError(Exception):
    """Raised when the provider is unreachable or the reply is not valid JSON.

    The caller turns this into a Ch.8.1 non-retryable escalation rather than
    guessing a fallback verdict. A 429 rate limit is retried internally first
    (see call_agent) since that failure mode is transient, not a schema error.
    """


MAX_RATE_LIMIT_RETRIES = 5
DEFAULT_RATE_LIMIT_WAIT_SECONDS = 5.0
MAX_RATE_LIMIT_WAIT_SECONDS = 20.0


def _parse_retry_after_seconds(detail: str) -> float:
    """Providers (Groq included) name the exact wait in the error body, e.g.
    '...Please try again in 2.8575s.'. Fall back to a fixed wait if absent."""
    match = re.search(r"try again in ([\d.]+)s", detail)
    if not match:
        return DEFAULT_RATE_LIMIT_WAIT_SECONDS
    return min(float(match.group(1)) + 0.5, MAX_RATE_LIMIT_WAIT_SECONDS)


def call_agent(system_prompt: str, user_payload: dict, temperature: float = 0.0, timeout: int = 60) -> dict:
    """Run one agent turn and return its parsed JSON object."""
    base_url = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)

    body = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, indent=2)},
        ],
        # Honoured by Groq/OpenAI/Ollama; providers that don't know the field
        # are retried without it below.
        "response_format": {"type": "json_object"},
    }

    rate_limit_attempts = 0
    raw = None
    while raw is None:
        try:
            raw = _post(f"{base_url}/chat/completions", body, timeout)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:400]
            if e.code == 400 and "response_format" in detail:
                body.pop("response_format")
                continue
            if e.code == 429 and rate_limit_attempts < MAX_RATE_LIMIT_RETRIES:
                wait_s = _parse_retry_after_seconds(detail)
                rate_limit_attempts += 1
                time.sleep(wait_s)
                continue
            raise AgentCallError(f"{model} @ {base_url} returned HTTP {e.code}: {detail}") from e
        except (OSError, http.client.HTTPException) as e:
            # Covers URLError, DNS failures, timeouts, and mid-response disconnects,
            # all of which must escalate rather than take down the pipeline.
            raise AgentCallError(f"Could not reach {base_url}: {e}") from e

    try:
        content = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise AgentCallError(f"Unexpected response shape from {model}: {json.dumps(raw)[:400]}") from e

    try:
        parsed = json.loads(_strip_code_fence(content))
    except json.JSONDecodeError as e:
        raise AgentCallError(f"{model} did not return valid JSON: {content[:400]}") from e

    if not isinstance(parsed, dict):
        raise AgentCallError(f"{model} returned {type(parsed).__name__}, expected a JSON object.")
    return parsed


def _post(url: str, body: dict, timeout: int) -> dict:
    # Cloudflare (fronting Groq and others) blocks the default urllib
    # User-Agent as a bot signature (HTTP 403 "error code: 1010"), so present
    # as a normal HTTP client.
    headers = {"Content-Type": "application/json", "User-Agent": "fraud-copilot-pipeline/1.0"}
    api_key = get_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))
