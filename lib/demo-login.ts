const DEMO_DOMAIN = "demo.bluebookonline.local";

/** Demo-only aliases accepted in the email field on /login (password must match exactly). */
const DEMO_ACCOUNTS = [
  {
    aliases: ["teacher"],
    password: "teacher123",
    email: `teacher@${DEMO_DOMAIN}`,
  },
  {
    aliases: ["institutions"],
    password: "institutions123",
    email: `institutions@${DEMO_DOMAIN}`,
  },
  {
    aliases: ["student"],
    password: "student123",
    email: `student@${DEMO_DOMAIN}`,
  },
] as const;

/**
 * When the email field contains a demo alias and the password matches, return the
 * backing Supabase auth email. Otherwise null (normal email login continues).
 */
export function resolveDemoLoginEmail(
  identifier: string,
  password: string
): string | null {
  const key = identifier.trim().toLowerCase();
  const match = DEMO_ACCOUNTS.find((demo) =>
    demo.aliases.some((alias) => alias === key)
  );
  if (!match || match.password !== password) return null;
  return match.email;
}

/** True when identifier is a demo alias (used to reject wrong passwords early). */
export function isDemoLoginAlias(identifier: string): boolean {
  const key = identifier.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((demo) => demo.aliases.some((alias) => alias === key));
}
