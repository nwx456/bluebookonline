import { NextRequest } from "next/server";
import { handleFrqAnalyze } from "@/lib/frq-analyze";

export async function POST(request: NextRequest) {
  return handleFrqAnalyze(request);
}
