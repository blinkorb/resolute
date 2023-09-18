import queryString from 'query-string';

import { MATCHES_TRAILING_SLASH } from './constants.js';
import { RequestHandler, RequestOptions, ServerModule } from './types.js';
import { toAPIPath } from './utils/paths.js';

const createAPI =
  <S extends ServerModule = never>(pathname: string) =>
  <K extends string & keyof S>(fn: K, options?: RequestOptions) => {
    const { queryParams, method, ...rest } = options || {};

    const queryParamsString = queryParams
      ? queryString.stringify(queryParams, {
          encode: true,
          arrayFormat: 'comma',
        })
      : '';

    const resolvedPathname = `${(process.env.API_URL || '').replace(
      MATCHES_TRAILING_SLASH,
      '/'
    )}${toAPIPath(pathname, fn)}${
      queryParamsString ? `?${queryParamsString}` : ''
    }`.replace(/\/+/g, '/');

    return fetch(resolvedPathname, {
      method: (method || 'get').toUpperCase(),
      ...rest,
    }).then(async (response) => {
      return response.json() as Promise<
        S[K] extends RequestHandler<infer T> ? T : never
      >;
    });
  };

export { createAPI };
