/**
 * PII redaction boundary for the Analyst Q&A LLM call (mirrors agents/redact.py's
 * design on the Python side, for the same reason: a fraud-investigation record
 * naturally accumulates real device IDs and IP addresses - see RingAnalysisResult's
 * `entities.devices`/`entities.ips` in lib/types.ts, populated by the deterministic
 * Ring Detector, which never touches an LLM and so was never in scope of the Python
 * redaction pass. The Q&A route (app/api/reports/[id]/question/route.ts) forwards the
 * *entire* stored report to an external LLM on every question, so it needs its own
 * boundary here.
 *
 * Unlike the Python side (which tokenizes named fields before building the payload),
 * this scrubs by *known value*: register every real device/IP already present in the
 * report, then scrub() walks the whole contextDoc replacing any occurrence of those
 * values - including inside free text like a ring finding's `explanation` or an
 * agent's `fused_reasoning` - with a token. rehydrate() reverses it on the model's
 * answer before it's shown to the analyst, so only the bytes sent to the LLM provider
 * are ever redacted.
 */

type TokenCategory = "DEVICE" | "IP";

export class RedactionContext {
  private realToToken = new Map<string, string>();
  private tokenToReal = new Map<string, string>();
  private counters: Record<string, number> = {};

  private mint(category: TokenCategory, realValue: string): string {
    const existing = this.realToToken.get(realValue);
    if (existing) return existing;
    this.counters[category] = (this.counters[category] ?? 0) + 1;
    const token = `${category}_${this.counters[category]}`;
    this.realToToken.set(realValue, token);
    this.tokenToReal.set(token, realValue);
    return token;
  }

  /** Registers a real device_id so scrub() will replace it wherever it appears. */
  registerDevice(realValue: string | null | undefined): void {
    if (realValue) this.mint("DEVICE", realValue);
  }

  /** Registers a real ip_address so scrub() will replace it wherever it appears. */
  registerIp(realValue: string | null | undefined): void {
    if (realValue) this.mint("IP", realValue);
  }

  /**
   * Recursively replaces every registered real value with its token, anywhere it
   * appears in `value` - structured fields and free text alike. Returns a new
   * structure; never mutates the input.
   */
  scrub<T>(value: T): T {
    if (this.realToToken.size === 0) return value;
    if (typeof value === "string") {
      let result: string = value;
      // Longest-real-value-first avoids one real value partially matching inside
      // another (e.g. an IP that's a substring of a longer one, unlikely but cheap
      // to guard against, same reasoning as the Python side's token-length sort).
      for (const real of Array.from(this.realToToken.keys()).sort((a, b) => b.length - a.length)) {
        if (result.includes(real)) {
          result = result.split(real).join(this.realToToken.get(real)!);
        }
      }
      return result as unknown as T;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.scrub(v)) as unknown as T;
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        // Some report fields use the real value as a dict KEY, not just a
        // value - e.g. RingFinding.evidence.shared_devices is
        // { [device_id]: customer_id[] } (see pipeline/ring_detector.py's
        // shared_devices/shared_ips evidence blocks). An exact-match lookup
        // is correct here (unlike scrub()'s substring pass over free text)
        // since these keys are always the literal registered value, never a
        // key that merely contains it as a substring.
        const safeKey = this.realToToken.get(k) ?? k;
        out[safeKey] = this.scrub(v);
      }
      return out as T;
    }
    return value;
  }

  /** Reverses scrub(): restores real values from tokens, e.g. in the LLM's answer text. */
  rehydrate(text: string): string {
    if (this.tokenToReal.size === 0 || !text) return text;
    let result = text;
    for (const token of Array.from(this.tokenToReal.keys()).sort((a, b) => b.length - a.length)) {
      if (result.includes(token)) {
        result = result.split(token).join(this.tokenToReal.get(token)!);
      }
    }
    return result;
  }
}
