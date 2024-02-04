import { RequestMethod } from './types.js';

export const WEB_SOCKET_PORT = 3333;

export const SCOPE = '@blinkorb';
export const NAME = 'resolute';
export const SCOPED_NAME = `${SCOPE}/${NAME}`;
export const SCOPED_CLIENT = `${SCOPED_NAME}/client`;
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

export const JS_EXTENSIONS = ['cjs', 'mjs', 'js'];

export const MATCHES_JS_EXTENSION = new RegExp(
  `\\.(?:${JS_EXTENSIONS.join('|')})$`
);

export const MATCHES_API = new RegExp(
  `\\.api\\.(?:${JS_EXTENSIONS.join('|')})$`
);

export const MATCHES_TRAILING_SLASH = /\/?$/;

export const DEFAULT_VIEW_TRANSITIONS = true;
export const DEFAULT_TRANSITION_INITIAL_RENDER = false;
export const DEFAULT_PRELOAD_CACHE_TIMEOUT = 60 * 1000;
export const DEFAULT_PRELOAD_ON_HOVER = true;
export const DEFAULT_PRELOAD_ON_FOCUS = true;

export const DEV_SERVER_PATHNAME = '/resolute-dev-server';
