import { SUPPORTED_META } from '../constants.js';
import { PageMeta, UnknownObject } from '../types.js';

export const getPageMeta = (pageModule: UnknownObject, pathname: string) => {
  const meta: PageMeta = {};

  for (const metaName of SUPPORTED_META) {
    if (metaName in pageModule) {
      const value = pageModule[metaName];

      if (typeof value !== 'string') {
        throw new Error(`Meta "${metaName}" must be a string in "${pathname}"`);
      }

      meta[metaName] = value;
    }
  }

  return meta;
};
