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
