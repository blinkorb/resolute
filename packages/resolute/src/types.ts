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
