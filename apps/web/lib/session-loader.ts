export function createSessionLoader() {
  let revision = 0;
  let active = true;
  return {
    reset(enabled: boolean) {
      active = enabled;
      ++revision;
    },
    async load<T>(read: () => Promise<T>, apply: (value: T) => void) {
      if (!active) return false;
      const request = ++revision;
      try {
        const value = await read();
        if (!active || request !== revision) return false;
        apply(value);
        return true;
      } catch (error) {
        if (!active || request !== revision) return false;
        throw error;
      }
    },
  };
}
