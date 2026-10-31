export function devOrigins(env: {
  NODRA_LAN_HOST?: string;
  WEB_ORIGIN?: string;
}) {
  const hosts = new Set<string>();
  if (env.NODRA_LAN_HOST) hosts.add(env.NODRA_LAN_HOST);
  if (env.WEB_ORIGIN) {
    try {
      hosts.add(new URL(env.WEB_ORIGIN).hostname);
    } catch {
      /* Invalid origin cannot grant access. */
    }
  }
  return [...hosts];
}
