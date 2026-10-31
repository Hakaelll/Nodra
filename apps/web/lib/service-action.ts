/** A failed refresh must not turn an acknowledged write into a failed write. */
export async function saveServiceChange<T>(
  write: () => Promise<T>,
  refresh: () => Promise<void>,
) {
  const result = await write();
  try {
    await refresh();
    return { result, refreshed: true };
  } catch {
    return { result, refreshed: false };
  }
}
