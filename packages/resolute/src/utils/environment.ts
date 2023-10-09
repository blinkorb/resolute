export const isBrowser = () =>
  typeof globalThis.window !== 'undefined' &&
  typeof globalThis.document !== 'undefined';
