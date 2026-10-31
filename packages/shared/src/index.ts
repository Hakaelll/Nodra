export const activeAssignmentStatuses = [
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
] as const;
export { sealAuthToken, openAuthToken } from "./auth-action-crypto";
export type PermissionRole = "OWNER" | "ADMIN" | "COORDINATOR" | "MEMBER";
export type Permission = "read" | "operate" | "team" | "settings";
export function permits(role: PermissionRole, permission: Permission): boolean {
  return (
    permission === "read" ||
    role === "OWNER" ||
    role === "ADMIN" ||
    (role === "COORDINATOR" && permission === "operate")
  );
}
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}
export const serviceTransitions: Record<string, readonly string[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["SELECTION", "CANCELLED"],
  SELECTION: ["CONFIRMATION", "CANCELLED"],
  CONFIRMATION: ["READY", "CANCELLED"],
  READY: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
