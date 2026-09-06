import crypto from "crypto";
import type { AnalystUser } from "./types";

export const SESSION_COOKIE_NAME = "analyst_session";

const SESSION_SECRET = process.env.ANALYST_AUTH_SECRET || "fraudcopilot-analyst-session-secret-key-2026";

/**
 * Pre-configured certified fraud analysts roster.
 * Represents authorized financial crime investigators with scoped tiers.
 */
export const CERTIFIED_ANALYSTS: (AnalystUser & { passwordHash?: string })[] = [
  {
    id: "ANL-802",
    name: "Sarah Chen",
    email: "sarah.chen@fraudcopilot.internal",
    role: "Lead Fraud Investigator",
    tier: "Tier 3 (Principal Reviewer)",
    initials: "SC",
    badgeColor: "from-indigo-600 to-indigo-800",
  },
  {
    id: "ANL-419",
    name: "Marcus Vance",
    email: "marcus.vance@fraudcopilot.internal",
    role: "Senior AML Compliance Analyst",
    tier: "Tier 2 (Senior Reviewer)",
    initials: "MV",
    badgeColor: "from-emerald-600 to-teal-800",
  },
  {
    id: "ANL-105",
    name: "Elena Rostova",
    email: "elena.rostova@fraudcopilot.internal",
    role: "Fraud Operations Specialist",
    tier: "Tier 1 (Triage Specialist)",
    initials: "ER",
    badgeColor: "from-amber-600 to-orange-800",
  },
];

export const DEMO_PASSWORD = "investigator2026";

/**
 * Creates an HMAC-SHA256 signed session token containing analyst ID and expiration.
 */
export function createSessionToken(analyst: AnalystUser, expiresInHours = 24): string {
  const payload = {
    sub: analyst.id,
    email: analyst.email,
    name: analyst.name,
    role: analyst.role,
    tier: analyst.tier,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Validates HMAC-SHA256 signed session token and returns analyst if valid.
 */
export function verifySessionToken(token: string): AnalystUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(payloadB64)
      .digest("base64url");

    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (!payload.exp || Date.now() / 1000 > payload.exp) {
      return null;
    }

    const matched = CERTIFIED_ANALYSTS.find((a) => a.id === payload.sub);
    if (matched) {
      const { passwordHash: _, ...safeAnalyst } = matched;
      return safeAnalyst;
    }

    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      tier: payload.tier,
      initials: (payload.name || "A")
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase(),
      badgeColor: "from-indigo-600 to-indigo-800",
    };
  } catch (err) {
    return null;
  }
}

/**
 * Extract authenticated analyst from incoming Request or NextRequest cookie header.
 */
export function getAuthenticatedAnalystFromRequest(req: Request): AnalystUser | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  return verifySessionToken(token);
}
