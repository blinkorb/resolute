import { ComponentType, ReactElement } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = Record<string, any>;
export type UnknownObject = Record<string, unknown>;
export type EmptyObject = Record<never, never>;

export type AsyncComponent<P = EmptyObject> = (
  props: P
) => Promise<ReactElement>;
export type ComponentLike = ComponentType | AsyncComponent;

export type AssertUnknownObject = (
  module: unknown,
  pathname: string
) => asserts module is UnknownObject;

export interface PageMeta {
  title?: string;
}

export type Renderer = 'client' | 'static' | 'server';

export interface LocationInfo {
  hash: string;
  host: string;
  hostname: string;
  href: string;
  origin: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
}

export interface RouteInfo {
  location: LocationInfo;
}

export interface InjectedPageProps {
  meta: PageMeta;
  location: LocationInfo;
  renderer: Renderer;
  isClientRender: boolean;
  isStaticRender: boolean;
  isServerRender: boolean;
}

export interface LayoutJSON {
  pathname: string;
  props?: UnknownObject;
}

export interface PageDataJSONClient {
  client: {
    pathname: string;
    layouts: readonly LayoutJSON[];
  };
  static: {
    meta: PageMeta;
    props?: UnknownObject;
  };
}

export interface PageDataJSONStatic {
  static: {
    head: string;
    body: string;
  };
}

export type PageDataJSON = PageDataJSONClient | PageDataJSONStatic;

export type RequestMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options';

export interface RequestOptions<P extends AnyObject = EmptyObject>
  extends RequestInit {
  queryParams: P;
}

export type RequestHandler<T extends AnyObject> = () => Promise<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRequestHandler = RequestHandler<any>;

export type ServerModule = Partial<Record<string, AnyRequestHandler>>;

export type GetPropsResult<T extends () => void> = Awaited<ReturnType<T>>;
