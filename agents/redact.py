"""
PII redaction boundary for the specialist agents.

Deliberately narrow scope: only fields that (a) directly identify a person
or device and (b) the agents don't need the *actual value* of to reason
correctly are tokenized. Two fields that might look like PII candidates are
kept raw on purpose:

  - `location` / `home_location`: Agent 1's whole geography-anomaly check
    ("impossible travel") requires the real city/country to reason about
    distance and plausibility. A token carries none of that signal, and a
    city/country string is a quasi-identifier at most, not a direct one.
  - `customer_id` / `transaction_id`: already-pseudonymous system-generated
    references the whole pipeline joins on (evidence linking, Airtable
    records, the dashboard). Tokenizing an ID that's already opaque adds
    nothing.

What IS tokenized: `name` (a person's real name has no analytical value to
an anomaly-detection prompt), `device_id` and `ip_address` (the agents only
need to know "is this the same device/IP as before", never the literal
value - see the redaction-preserves-signal note below).

Redaction is deterministic per real value within one RedactionContext: the
same real device_id always maps to the same token. This matters for ring
detection's shared-device signal - if two customers in one payload share a
device, they must still show the SAME token so an agent (or a human glancing
at the payload) can see the overlap, without either customer's actual device
identifier ever leaving the process boundary.

Rehydration reverses the mapping after the LLM responds, so the report that
lands in front of the analyst reads with real identifiers - the redaction
happens only in the bytes that cross the network to Groq/OpenAI/etc, never in
what's stored or displayed. Call rehydrate() once, on the *final* agent1/2/3
outputs, right before they're handed to the deterministic report generator -
not immediately after each agent call, or Agent 3's payload (built from
Agent 1/2's own JSON output) would carry real values straight into the third
LLM call.
"""

from typing import Any, Dict, List, Optional

_TOKEN_PREFIXES = {
    "name": "CUSTOMER",
    "device_id": "DEVICE",
    "ip_address": "IP",
}


class RedactionContext:
    """One instance per investigation (per `process_transaction` call).

    Not thread-safe and not meant to be reused across transactions - a fresh
    context per case keeps token numbering (CUSTOMER_1, DEVICE_1, ...)
    predictable and means one case's tokens can never collide with another's
    if contexts were ever inspected side by side.
    """

    def __init__(self):
        self._value_to_token: Dict[str, str] = {}
        self._token_to_value: Dict[str, str] = {}
        self._counters: Dict[str, int] = {}

    def _token_for(self, category: str, real_value: Any) -> Any:
        if real_value is None or real_value == "":
            return real_value
        real_value = str(real_value)
        cache_key = f"{category}:{real_value}"
        existing = self._value_to_token.get(cache_key)
        if existing:
            return existing

        self._counters[category] = self._counters.get(category, 0) + 1
        prefix = _TOKEN_PREFIXES.get(category, category.upper())
        token = f"{prefix}_{self._counters[category]}"
        self._value_to_token[cache_key] = token
        self._token_to_value[token] = real_value
        return token

    def redact_transaction(self, transaction: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Copies `transaction`, replacing device_id/ip_address with stable tokens."""
        if not transaction:
            return transaction
        redacted = dict(transaction)
        if redacted.get("device_id"):
            redacted["device_id"] = self._token_for("device_id", redacted["device_id"])
        if redacted.get("ip_address"):
            redacted["ip_address"] = self._token_for("ip_address", redacted["ip_address"])
        return redacted

    def redact_transactions(self, transactions: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        return [self.redact_transaction(t) for t in (transactions or [])]

    def redact_customer(self, customer: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not customer:
            return customer
        redacted = dict(customer)
        if redacted.get("name"):
            redacted["name"] = self._token_for("name", redacted["name"])
        return redacted

    def redact_history_events(self, events: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Customer_History rows can carry a device_id (Device_Change events)."""
        out = []
        for event in events or []:
            redacted = dict(event)
            if redacted.get("device_id"):
                redacted["device_id"] = self._token_for("device_id", redacted["device_id"])
            out.append(redacted)
        return out

    def rehydrate(self, value: Any) -> Any:
        """Recursively walk a JSON-like structure, replacing token substrings
        in every string with their real values. Safe to call on None, on an
        object with no tokens in it, or repeatedly (idempotent once all
        tokens are gone)."""
        if not self._token_to_value:
            return value
        if isinstance(value, str):
            result = value
            # Longest-token-first avoids e.g. "DEVICE_1" partially matching
            # inside "DEVICE_10" if both tokens exist in this context.
            for token in sorted(self._token_to_value, key=len, reverse=True):
                if token in result:
                    result = result.replace(token, self._token_to_value[token])
            return result
        if isinstance(value, dict):
            return {k: self.rehydrate(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self.rehydrate(v) for v in value]
        return value
