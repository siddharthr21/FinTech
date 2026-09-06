import { NextResponse } from "next/server";
import { getInvestigationReports } from "@/lib/airtable";

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
