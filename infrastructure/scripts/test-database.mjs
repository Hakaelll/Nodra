// Validate before creating a client, applying migrations or changing DATABASE_URL.
// Never include the connection string in errors: it can contain credentials.
export function testDatabaseUrl(source, environment = process.env.NODE_ENV) {
  const failure = () => {
    throw new Error(
      "TEST_DATABASE_URL must use local PostgreSQL and the dedicated nodra_test database, without connection overrides. Production is forbidden.",
    );
  };
  if (!source || environment === "production") failure();
  let url;
  try {
    url = new URL(source);
  } catch {
    failure();
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/nodra_test" ||
    url.search ||
    url.hash
  )
    failure();
  return source;
}
