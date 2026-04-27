import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __pdfagentPgPool: Pool | undefined;
}

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString, max: 10 });
}

export function getPool(): Pool {
  if (!global.__pdfagentPgPool) {
    global.__pdfagentPgPool = buildPool();
  }
  return global.__pdfagentPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never);
}
