import React, { isValidElement, ReactNode } from 'react';

import { getLocationInfo } from '../router.js';
import {
  AssertUnknownObject,
  AsyncComponent,
  ComponentLike,
  InjectedPageProps,
  Renderer,
  UnknownObject,
} from '../types.js';
import { getPageMeta } from './meta.js';

export const isComponentLike = <P extends InjectedPageProps>(
  value: unknown
): value is ComponentLike<P> => typeof value === 'function';

export const isAsyncFunction = <P extends InjectedPageProps>(
  value: ComponentLike<P>
): value is AsyncComponent<P> => {
  return value.constructor.name === 'AsyncFunction';
};

export const AsyncComponentWrapper = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => <>{children}</>;

export const createElementAsync = async <P extends InjectedPageProps>(
  Comp: ComponentLike<P>,
  props: P
) => {
  if (isAsyncFunction(Comp)) {
    const element = await Comp(props);

    return <AsyncComponentWrapper {...props}>{element}</AsyncComponentWrapper>;
  }

  return <Comp {...props} />;
};

export const assertProps: AssertUnknownObject = (props, pathname) => {
  if (!props) {
    throw new Error(`Props from "${pathname}" was no truthy: ${props}`);
  }

  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new Error(`Props from "${pathname}" must be an object`);
  }
};

export const getInjectedProps = <P extends InjectedPageProps>(
  pageModule: UnknownObject,
  pathname: string,
  href: string,
  props: Omit<P, keyof InjectedPageProps>,
  children: ReactNode | readonly ReactNode[] | undefined,
  renderer: Renderer
) => {
  const meta = getPageMeta(pageModule, pathname);
  const injectedProps: InjectedPageProps = {
    meta,
    location: getLocationInfo(href),
    renderer,
    isClientRender: renderer === 'client',
    isStaticRender: renderer === 'static',
    isServerRender: renderer === 'server',
    children,
  };

  return {
    ...props,
    ...injectedProps,
  } as P;
};

export const getProps = async (pageModule: UnknownObject, pathname: string) => {
  if (!('getProps' in pageModule)) {
    return {};
  }

  if (typeof pageModule.getProps !== 'function') {
    throw new Error(
      `Exported "getProps" must be a function in "${pageModule}"`
    );
  }

  const props = await pageModule.getProps();

  assertProps(props, pathname);

  return props;
};

export const getModuleElement = async <P extends InjectedPageProps>(
  pageModule: UnknownObject,
  pathname: string,
  props: P
) => {
  if (!('default' in pageModule)) {
    throw new Error(`Must have a default export in "${pathname}"`);
  }

  const { default: Comp } = pageModule;

  if (!isComponentLike<P>(Comp)) {
    throw new Error(
      `Default export must be a React component in "${pathname}"`
    );
  }

  const element: unknown = await createElementAsync(Comp, props);

  if (!isValidElement(element)) {
    throw new Error(
      `Default export must return a valid React element in "${pathname}"`
    );
  }

  return element;
};
