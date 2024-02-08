import { AssertUnknownObject } from '../types.js';

const assertModule: AssertUnknownObject = (module, pathname) => {
  if (!module) {
    throw new Error(
      `Module at "${pathname}" was not what we expected: ${module}`
    );
  }

  if (typeof module !== 'object' || Array.isArray(module)) {
    throw new Error(`Module at "${pathname}" must be an object`);
  }
};

export const getModule = async (pathname: string) => {
  const unknownModule: unknown = await import(pathname);

  assertModule(unknownModule, pathname);

  return unknownModule;
};
