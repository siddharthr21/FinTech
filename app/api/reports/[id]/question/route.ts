import { NextRequest, NextResponse } from "next/server";
import { getInvestigationReports } from "@/lib/airtable";
import { RedactionContext } from "@/lib/redact";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = decodeURIComponent(params.id);
    const body = await req.json();
    const question = (body.question || "").trim();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    const reports = await getInvestigationReports();
    const report = reports.find(
      (r) => r.report_id === reportId || r.transaction_id === reportId
    );

    if (!report) {
      return NextResponse.json(
        { error: `Report '${reportId}' not found.` },
        { status: 404 }
      );
    }

    const apiKey = process.env.LLM_API_KEY?.trim() || "";
    const baseUrl = process.env.LLM_BASE_URL?.trim() || "https://api.groq.com/openai/v1";
    const model = process.env.LLM_MODEL?.trim() || "openai/gpt-oss-120b";

    // Grounded Case Context (Spec §7.2, §7.3 - structured evidence is source of truth)
    const contextDoc = {
      report_id: report.report_id,
      transaction_id: report.transaction_id,
      verdict: report.verdict,
      confidence_score: report.confidence_score,
      summary: report.summary,
      fused_reasoning: report.fused_reasoning,
      recommended_action: report.recommended_action,
      hypotheses: report.hypotheses || [],
      investigation_path: report.investigation_path || [],
      evidence_trail: report.evidence_trail || [],
      supporting_evidence: report.supporting_evidence || [],
      contradicting_evidence: report.contradicting_evidence || [],
      detected_patterns: report.detected_patterns || [],
      customer_context: report.customer_context || [],
      network_findings: report.network_findings || null,
      ring_score: report.ring_score ?? null,
    };

    // Extract all evidence IDs present in the report
    const allEvidenceIds = (report.evidence_trail || [])
      .map((e) => e.evidence_id)
      .filter((id): id is string => Boolean(id));

    if (apiKey) {
      try {
        // network_findings.entities carries real device_id/ip_address values from
        // the deterministic Ring Detector (which never touches an LLM in Python,
        // so those values were never tokenized). This is a separate LLM call from
        // the Python pipeline's - see lib/redact.ts - so it needs its own boundary:
        // scrub every known real device/IP (including occurrences buried in free
        // text like a finding's `explanation`) before this leaves the server, then
        // rehydrate the model's answer back to real values before showing it to
        // the analyst.
        const redactionCtx = new RedactionContext();
        for (const device of report.network_findings?.entities?.devices || []) {
          redactionCtx.registerDevice(device);
        }
        for (const ip of report.network_findings?.entities?.ips || []) {
          redactionCtx.registerIp(ip);
        }
        const safeContextDoc = redactionCtx.scrub(contextDoc);

        const systemPrompt = `You are an Analyst Assistant for an enterprise multi-agent fraud investigation system.
Answer the analyst's question using ONLY the case evidence provided in JSON below.
CRITICAL RULES:
1. Do NOT invent facts or hallucinate evidence not present in the record.
2. If the case evidence does not contain the answer, explicitly state that it is unobserved in the current investigation.
3. Always cite the relevant Evidence IDs (e.g. EV-${report.transaction_id}-001) whenever discussing findings.
4. If asked about legitimacy or why it might NOT be fraud, highlight contradicting evidence or isolated-signal discounts.
5. Format your response cleanly with markdown bullet points and clear sections.`;

        const userPrompt = `CASE EVIDENCE:
${JSON.stringify(safeContextDoc, null, 2)}

ANALYST QUESTION:
${question}

Provide an evidence-grounded response citing specific EV-* IDs:`;

        const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 800,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const rawAnswer = resJson.choices?.[0]?.message?.content?.trim() || "";
          // Restore real device/IP values in the model's own answer text - the
          // analyst should never see a DEVICE_1/IP_1 token, only what actually
          // left the server was ever redacted.
          const answer = redactionCtx.rehydrate(rawAnswer);

          // Extract cited evidence IDs from the LLM answer
          const citedIds = allEvidenceIds.filter((id) => answer.includes(id));

          return NextResponse.json({
            answer,
            evidence_ids: citedIds.length > 0 ? citedIds : allEvidenceIds,
            is_llm: true,
          });
        }
      } catch (llmErr) {
        console.warn("LLM call failed, falling back to deterministic grounded response:", llmErr);
      }
    }

    // Deterministic Grounded Fallback (Spec §7.2, §15)
    // Ensures demo works with 100% fidelity even when LLM key is absent or endpoint is down
    const qLower = question.toLowerCase();
    let answer = "";
    let citedIds: string[] = [];

    if (qLower.includes("high risk") || qLower.includes("why") || qLower.includes("flagged") || qLower.includes("suspicious")) {
      const facts = (report.evidence_trail || []).map((e) => `- **[${e.evidence_id || "EV"}]** ${e.claim} (${e.category || "observed_fact"}, weight: ${e.weight})`);
      const topHyp = (report.hypotheses || [])[0];
      answer = `### Case Assessment: ${report.verdict} (${report.confidence_score}% Confidence)\n\n` +
        `This case was flagged as high risk due to ${report.evidence_trail?.length || 0} corroborated evidence signals:\n\n` +
        (facts.length > 0 ? facts.join("\n") : "- No critical anomalies recorded.") +
        `\n\n**Primary Hypothesis:** \`${topHyp ? `${topHyp.name} (${Math.round(topHyp.score * 100)}%)` : "account_takeover"}\`.\n\n` +
        `**Synthesis:** ${report.fused_reasoning || report.summary}`;
      citedIds = allEvidenceIds;
    } else if (qLower.includes("legitimate") || qLower.includes("not fraud") || qLower.includes("contradict") || qLower.includes("false positive")) {
      const contra = report.contradicting_evidence || [];
      if (contra.length > 0) {
        const contraList = contra.map((e) => `- **[${e.evidence_id || "EV"}]** ${e.claim}`);
        answer = `### Evidence Supporting Legitimacy (Spec §15)\n\n` +
          `The investigation identified ${contra.length} signal(s) contradicting the fraud hypothesis:\n\n` +
          contraList.join("\n") +
          `\n\nThese mitigating signals were factored into the fusion layer to prevent false-positive alert fatigue.`;
        citedIds = contra.map((e) => e.evidence_id!).filter(Boolean);
      } else {
        answer = `### Contradictory Evidence Analysis\n\n` +
          `No mitigating or contradictory evidence was identified for transaction **${report.transaction_id}**. ` +
          `All recorded signals corroborate the **${report.verdict}** verdict without observed legitimate travel or prior device registration.`;
      }
    } else if (qLower.includes("before") || qLower.includes("change") || qLower.includes("timeline") || qLower.includes("prior")) {
      const historySignals = (report.customer_context || []).map(
        (f) => `- **${f.signal_type}**: ${f.explanation} (Observed: ${f.evidence?.observed_value || "recorded in logs"})`
      );
      answer = `### Activity Preceding Transaction ${report.transaction_id}\n\n` +
        `Prior contextual telemetry retrieved from account history and support records:\n\n` +
        (historySignals.length > 0 ? historySignals.join("\n") : "- No credential or device changes observed prior to transaction.") +
        `\n\n**Investigation Trail:** Triggered customer identity check following initial transaction pattern anomalies.`;
      citedIds = (report.evidence_trail || [])
        .filter((e) => e.source_agent === "customer_history")
        .map((e) => e.evidence_id!)
        .filter(Boolean);
    } else if (qLower.includes("device") || qLower.includes("network") || qLower.includes("connected") || qLower.includes("ring")) {
      const net = report.network_findings;
      if (net && net.is_suspicious_ring) {
        answer = `### Connected Syndicate Network (Ring Score: ${Math.round((report.ring_score || 0) * 100)}%)\n\n` +
          `This transaction is linked to a multi-account cluster:\n` +
          `- **Cluster ID:** ${net.cluster_id}\n` +
          `- **Connected Customers:** ${net.entities?.customers?.join(", ") || "None"}\n` +
          `- **Shared Devices:** ${net.entities?.devices?.join(", ") || "None"}\n` +
          `- **Shared IPs:** ${net.entities?.ips?.join(", ") || "None"}\n\n` +
          `**Summary:** ${net.summary}`;
      } else {
        answer = `### Network & Device Connections\n\n` +
          `Transaction **${report.transaction_id}** was evaluated against the graph cluster database. ` +
          `No suspicious multi-account fraud ring was detected (Ring Score: ${report.ring_score ? `${Math.round(report.ring_score * 100)}%` : "0%"}).`;
      }
      citedIds = (report.evidence_trail || [])
        .filter((e) => e.source_field === "network_graph")
        .map((e) => e.evidence_id!)
        .filter(Boolean);
    } else {
      answer = `### Case Investigation Overview for ${report.transaction_id}\n\n` +
        `- **Verdict:** ${report.verdict} (Confidence: ${report.confidence_score}%)\n` +
        `- **Summary:** ${report.summary}\n` +
        `- **Recommended Action:** ${report.recommended_action}\n` +
        `- **Key Reasoning:** ${report.fused_reasoning}\n\n` +
        `*(You can ask specific questions such as "Why is this high risk?", "What changed before the transaction?", or "What evidence suggests this could be legitimate?")*`;
      citedIds = allEvidenceIds;
    }

    return NextResponse.json({
      answer,
      evidence_ids: citedIds,
      is_llm: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process investigation question." },
      { status: 500 }
    );
  }
}
