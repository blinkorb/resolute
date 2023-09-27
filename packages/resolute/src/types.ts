import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { HelmetProps } from 'react-helmet';
import type { Options } from 'react-markdown';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = Record<string, any>;
export type UnknownObject = Record<string, unknown>;
export type EmptyObject = Record<never, never>;

export type AsyncComponent<P = EmptyObject> = (
  props: P
) => Promise<ReactElement>;
export type ComponentLike<P = EmptyObject> =
  | ComponentType<P>
  | AsyncComponent<P>;

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

export interface Router {
  navigate: (
    pathname: string,
    state?: AnyObject,
    options?: NavigateOptions
  ) => void;
  go: (delta: number) => void;
  back: () => void;
}

export interface NavigateOptions {
  hard?: boolean;
  replace?: boolean;
  scrollToTop?: boolean;
}

export interface RouterContextState {
  location: LocationInfo;
  router: Router;
}

export interface InjectedPageProps {
  children?: ReactNode | readonly ReactNode[];
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

export interface ResoluteSettings {
  helmet?: Omit<HelmetProps, 'children'>;
  viewTransitions?: boolean;
  preload?: {
    onHover?: boolean;
    onFocus?: boolean;
    cacheTimeout?: number;
  };
  markdown?: Omit<Options, 'children'>;
}

export type PreloadFunction = (href: string) => void;
