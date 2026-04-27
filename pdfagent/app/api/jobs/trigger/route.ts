import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { discoverQueue } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; sourceId?: unknown };
  const kind = typeof body.kind === "string" ? body.kind : "";
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";

  if (kind === "discover") {
    if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });
    await discoverQueue().add(
      "discover",
      { sourceId },
      { jobId: `discover:${sourceId}:${Date.now()}` }
    );
    await audit("job.trigger.discover", { actorEmail: session.email, targetId: sourceId });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
