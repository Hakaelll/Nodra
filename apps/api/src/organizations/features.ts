export function featureEnabled(value: unknown, feature: "groups" | "chat") {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)[feature] === true
  );
}
