export function matchesRequestOrigin(
  origin: string | null,
  host: string | null,
  protocol: string,
) {
  if (!origin || !host) return false;
  try {
    const source = new URL(origin);
    return (
      source.host === host &&
      source.protocol === protocol &&
      source.pathname === "/" &&
      !source.search &&
      !source.hash
    );
  } catch {
    return false;
  }
}
