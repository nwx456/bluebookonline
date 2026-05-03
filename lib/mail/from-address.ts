/**
 * "Display Name" <email@domain.com> for providers.
 * Prefer MAIL_FROM as full RFC value, or MAIL_FROM_NAME + MAIL_FROM_EMAIL / GMAIL_USER.
 */
export function getFormattedFromAddress(): string {
  const raw = (process.env.MAIL_FROM ?? "").trim();
  if (raw) {
    if (raw.includes("<") && raw.includes(">")) return raw;
    if (/^[^\s<]+@[^\s>]+$/.test(raw)) {
      const name = (process.env.MAIL_FROM_NAME ?? "Bluebook Online").trim();
      return `"${name}" <${raw}>`;
    }
    return raw;
  }
  const name = (process.env.MAIL_FROM_NAME ?? "Bluebook Online").trim();
  const email =
    (process.env.MAIL_FROM_EMAIL ?? process.env.GMAIL_USER ?? "").trim();
  if (!email) {
    throw new Error(
      "Set MAIL_FROM (full address), or MAIL_FROM_EMAIL / GMAIL_USER for outbound mail."
    );
  }
  return `"${name}" <${email}>`;
}

export function resolveMailProvider(): "resend" | "smtp" | "gmail" {
  const explicit = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "resend") {
    if (!(process.env.RESEND_API_KEY ?? "").trim()) {
      throw new Error("MAIL_PROVIDER=resend requires RESEND_API_KEY.");
    }
    return "resend";
  }
  if (explicit === "smtp") {
    if (!(process.env.SMTP_HOST ?? "").trim()) {
      throw new Error("MAIL_PROVIDER=smtp requires SMTP_HOST (and credentials).");
    }
    return "smtp";
  }
  if (explicit === "gmail") {
    if (
      !(process.env.GMAIL_USER ?? "").trim() ||
      !(process.env.GMAIL_APP_PASSWORD ?? "").trim()
    ) {
      throw new Error("MAIL_PROVIDER=gmail requires GMAIL_USER and GMAIL_APP_PASSWORD.");
    }
    return "gmail";
  }

  if ((process.env.RESEND_API_KEY ?? "").trim()) return "resend";
  if ((process.env.SMTP_HOST ?? "").trim()) return "smtp";
  if (
    (process.env.GMAIL_USER ?? "").trim() &&
    (process.env.GMAIL_APP_PASSWORD ?? "").trim()
  ) {
    return "gmail";
  }
  throw new Error(
    "No mail provider configured. Set RESEND_API_KEY, or SMTP_HOST (+ SMTP_USER/SMTP_PASS), or GMAIL_USER + GMAIL_APP_PASSWORD (optionally MAIL_PROVIDER)."
  );
}

/** null if outbound mail env is usable; otherwise a short error message. */
export function getMailConfigError(): string | null {
  try {
    resolveMailProvider();
    getFormattedFromAddress();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Mail is not configured.";
  }
}
