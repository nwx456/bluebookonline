import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { generateUniqueInstitutionJoinCode } from "@/lib/institution-server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServerSupabaseAdmin();
  const joinCode = await generateUniqueInstitutionJoinCode(supabase);
  if (!joinCode) {
    return NextResponse.json(
      { error: "Could not generate a unique join code. Please try again." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("institutions")
    .update({ join_code: joinCode })
    .eq("id", auth.institution!.id)
    .select("join_code")
    .single();

  if (error) {
    console.error("institution/join-code/reset:", error);
    return NextResponse.json({ error: "Could not reset join code." }, { status: 500 });
  }

  return NextResponse.json({ joinCode: data.join_code });
}
