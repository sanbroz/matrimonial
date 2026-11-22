/** DATABASE_URL pointed at one PostgreSQL schema. */
export function databaseUrlFor(schema: string, connectionLimit?: number, base = process.env.DATABASE_URL): string {
  if (!base) throw new Error("DATABASE_URL is not set");
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error(`Invalid schema name: ${schema}`);
  const u = new URL(base);
  u.searchParams.set("schema", schema);
  if (connectionLimit) u.searchParams.set("connection_limit", String(connectionLimit));
  return u.toString();
}
