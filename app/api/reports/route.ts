import { NextResponse } from "next/server";
import { getInvestigationReports } from "@/lib/airtable";

// Route handlers with no request-bound inputs are statically prerendered at build
// time by default, which would freeze the analyst queue at its build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reports = await getInvestigationReports();
    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
