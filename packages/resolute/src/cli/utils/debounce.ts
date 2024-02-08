export const createDebounced = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: readonly any[]) => void,
  delay: number
) => {
  let timeout: NodeJS.Timeout | null = null;

  return () => {
    if (timeout) {
      globalThis.clearTimeout(timeout);
    }

    timeout = globalThis.setTimeout(() => fn(), delay);
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createDebouncedByKey = <A extends readonly any[]>(
  fn: (...args: A) => void,
  getKey: (...args: A) => string,
  delay: number
) => {
  const timeouts: Record<string, NodeJS.Timeout | null> = {};

  return (...args: A) => {
    const key = getKey(...args);
    const timeout = timeouts[key];

    if (timeout) {
      globalThis.clearTimeout(timeout);
    }

    timeouts[key] = globalThis.setTimeout(() => fn(...args), delay);
  };
};
