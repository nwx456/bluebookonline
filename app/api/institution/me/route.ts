import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { normalizeEmail } from "@/lib/moderator-auth";

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    email: normalizeEmail(auth.user!.email),
    role: "INSTITUTION",
    institution: {
      id: auth.institution!.id,
      name: auth.institution!.name,
      joinCode: auth.institution!.join_code,
      status: auth.institution!.status,
    },
  });
}
