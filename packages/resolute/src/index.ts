import queryString from 'query-string';
import { useEffect, useState } from 'react';

import { API_URL, METHODS } from './constants.js';
import type { AnyObject, EmptyObject } from './types.js';

export type RequestMethod = (typeof METHODS)[number];

export interface RequestOptions<P extends AnyObject = EmptyObject>
  extends RequestInit {
  queryParams: P;
}

export type RequestHandler<T extends AnyObject> = () => Promise<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRequestHandler = RequestHandler<any>;

export type ServerModule = Partial<Record<string, AnyRequestHandler>>;

export type GetPropsResult<T extends () => void> = Awaited<ReturnType<T>>;

export const createAPI =
  <S extends ServerModule = never>(pathname: string) =>
  <K extends string & keyof S>(fn: K, options?: RequestOptions) => {
    const { queryParams, method, ...rest } = options || {};

    const queryParamsString = queryParams
      ? queryString.stringify(queryParams, {
          encode: true,
          arrayFormat: 'comma',
        })
      : '';

    const resolvedPathname = `/api/${pathname
      .replace(/^(\.?\/)?/, '')
      .replace(/\.server\..+?$/, '')
      .replace(/index$/, '')
      .replace(/\/?$/, '/')}${fn}${
      queryParamsString ? `?${queryParamsString}` : ''
    }`.replace(/\/+/g, '/');

    return fetch(`${API_URL.replace(/\/$/, '')}${resolvedPathname}`, {
      method: (method || 'get').toUpperCase(),
      ...rest,
    }).then(async (response) => {
      return response.json() as Promise<
        S[K] extends RequestHandler<infer T> ? T : never
      >;
    });
  };

export const useIsClientRender = () => {
  const [state, setState] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setState(true);
    }
  }, []);

  return state;
};
