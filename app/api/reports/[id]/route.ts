import { NextRequest, NextResponse } from "next/server";
import { updateAnalystDecision } from "@/lib/airtable";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;
    const body = await request.json();
    const { decision, notes } = body;

    const validDecisions = ["Approved-Fraud", "False-Positive", "Escalated"];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json(
        { success: false, error: "Invalid decision. Must be Approved-Fraud, False-Positive, or Escalated." },
        { status: 400 }
      );
    }

    const updated = await updateAnalystDecision(reportId, decision, notes || "");
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Report not found or failed to update" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Case ${reportId} successfully resolved as ${decision}. Pipeline status updated to Closed.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
