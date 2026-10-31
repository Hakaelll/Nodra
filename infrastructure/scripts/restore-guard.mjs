import { URL } from "node:url";

export function restoreConnection(raw, environment = process.env.NODE_ENV) {
  let connection;
  try {
    connection = new URL(raw);
  } catch {
    throw new Error("Invalid PostgreSQL connection for restore rehearsal.");
  }
  if (
    environment === "production" ||
    !["postgres:", "postgresql:"].includes(connection.protocol) ||
    !["127.0.0.1", "localhost"].includes(connection.hostname) ||
    !["", "5432"].includes(connection.port) ||
    !["/nodra", "/nodra_test", "/postgres"].includes(connection.pathname) ||
    connection.search ||
    connection.hash ||
    !connection.username
  )
    throw new Error(
      "Restore rehearsal requires local Compose PostgreSQL on port 5432; production and URL parameters are forbidden.",
    );
  return connection;
}

export function restoreFixtureName(name) {
  if (!/^nodra_restore_[a-f0-9]{16}_(source|target)$/.test(name))
    throw new Error(
      "Refusing operation on a database outside this restore rehearsal.",
    );
  return name;
}
