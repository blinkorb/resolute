import { PageMeta, UnknownObject } from '../types.js';

const getTitle = (pageModule: UnknownObject, pathname: string) => {
  const { title } = pageModule;
  if (typeof title !== 'string' && typeof title !== 'number') {
    throw new Error(`Title must be a string or number in "${pathname}"`);
  }

  return title.toString();
};

export const getPageMeta = (pageModule: UnknownObject, pathname: string) => {
  const meta: PageMeta = {};

  if ('title' in pageModule) {
    meta.title = getTitle(pageModule, pathname);
  }

  return meta;
};
