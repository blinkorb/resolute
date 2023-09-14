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
