import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "openai/gpt-oss-120b";
  const baseUrl = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";

  return NextResponse.json({
    configured: Boolean(apiKey && apiKey.trim().length > 0),
    model,
    baseUrl,
  });
}
