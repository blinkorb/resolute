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

export interface LayoutJSON {
  pathname: string;
  props?: UnknownObject;
}

export interface ResoluteJSONClient {
  client: {
    pathname: string;
    layouts: readonly LayoutJSON[];
  };
  static: {
    meta: PageMeta;
    props?: UnknownObject;
  };
}

export interface ResoluteJSONStatic {
  static: {
    head: string;
    body: string;
  };
}

export type ResoluteJSON = ResoluteJSONClient | ResoluteJSONStatic;
