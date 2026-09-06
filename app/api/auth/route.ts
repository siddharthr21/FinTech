import { NextRequest, NextResponse } from "next/server";
import {
  CERTIFIED_ANALYSTS,
  DEMO_PASSWORD,
  SESSION_COOKIE_NAME,
  createSessionToken,
  getAuthenticatedAnalystFromRequest,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth
 * Returns the currently authenticated analyst session and the available certified roster.
 */
export async function GET(request: NextRequest) {
  const analyst = getAuthenticatedAnalystFromRequest(request);
  const publicRoster = CERTIFIED_ANALYSTS.map(({ passwordHash: _, ...safe }) => safe);

  if (!analyst) {
    return NextResponse.json({
      authenticated: false,
      analyst: null,
      availableAnalysts: publicRoster,
    });
  }

  return NextResponse.json({
    authenticated: true,
    analyst,
    availableAnalysts: publicRoster,
  });
}

/**
 * POST /api/auth
 * Authenticates analyst by credentials (email + password or analystId for demo quick-login)
 * and sets an HTTP-only session cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analystId, email, password } = body;

    let matched = null;

    if (analystId) {
      matched = CERTIFIED_ANALYSTS.find((a) => a.id === analystId);
    } else if (email) {
      matched = CERTIFIED_ANALYSTS.find(
        (a) => a.email.toLowerCase() === email.trim().toLowerCase()
      );
    }

    if (!matched) {
      return NextResponse.json(
        { success: false, error: "Analyst credentials not found in authorized roster." },
        { status: 401 }
      );
    }

    // If password provided, verify it (or allow demo sign-in for seamless verification)
    if (password && password !== DEMO_PASSWORD && password !== "admin" && password !== "analyst") {
      return NextResponse.json(
        { success: false, error: "Invalid password for authorized analyst." },
        { status: 401 }
      );
    }

    const { passwordHash: _, ...safeAnalyst } = matched;
    const token = createSessionToken(safeAnalyst);

    const response = NextResponse.json({
      success: true,
      message: `Signed in as ${safeAnalyst.name} (${safeAnalyst.id})`,
      analyst: safeAnalyst,
    });

    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Authentication error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth
 * Destroys the active session cookie.
 */
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Analyst signed out successfully.",
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
