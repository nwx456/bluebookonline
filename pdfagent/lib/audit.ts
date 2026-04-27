import { query } from "./db";

export async function audit(
  action: string,
  opts: { actorEmail?: string | null; targetId?: string | null; details?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (actor_email, action, target_id, details) VALUES ($1, $2, $3, $4)`,
      [
        opts.actorEmail ?? null,
        action,
        opts.targetId ?? null,
        opts.details ? JSON.stringify(opts.details) : null,
      ]
    );
  } catch {
    // audit failure should not break the caller
  }
}
