import { Prisma } from "@prisma/client";

export function isTransactionConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
    return true;
  if (
    !(error instanceof Error) ||
    error.name !== "DriverAdapterError" ||
    typeof error.cause !== "object" ||
    error.cause === null
  )
    return false;
  const cause = error.cause as { kind?: unknown; originalCode?: unknown };
  return (
    cause.kind === "TransactionWriteConflict" &&
    (cause.originalCode === "40001" || cause.originalCode === "40P01")
  );
}
