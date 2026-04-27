import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.ADMIN_INIT_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INIT_PASSWORD;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!email || !password) throw new Error("ADMIN_INIT_EMAIL and ADMIN_INIT_PASSWORD must be set");
  if (password.length < 8) throw new Error("ADMIN_INIT_PASSWORD must be at least 8 chars");

  const pool = new Pool({ connectionString: url });
  try {
    const hash = await bcrypt.hash(password, 12);
    const res = await pool.query(
      `INSERT INTO admin_users (email, password_hash, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, hash]
    );
    if (res.rowCount === 0) {
      console.log(`[seed:admin] admin already exists: ${email}`);
    } else {
      console.log(`[seed:admin] created admin: ${email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed:admin] failed:", err);
  process.exit(1);
});
