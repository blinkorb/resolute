import { RequestMethod } from './types.js';

export const PROGRAM = 'resolute';
export const DESCRIPTION =
  'Bleeding edge React static/server side rendering framework';
export const METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
] as const satisfies readonly RequestMethod[];
export const MATCHES_TRAILING_SLASH = /\/?$/;
export const DEFAULT_PRELOAD_CACHE_TIMEOUT = 10000;
export const DEFAULT_PRELOAD_ON_HOVER = true;
