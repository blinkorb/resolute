export const PROGRAM = 'resolute';
export const DESCRIPTION =
  'Bleeding edge React static/server side rendering framework';
export const PORT = process.env.PORT || 3000;
export const API_URL = `${process.env.API_URL || 'http://localhost'}:${PORT}`;
export const METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
] as const;
