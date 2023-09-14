import React, { isValidElement, ReactNode } from 'react';

import {
  AssertUnknownObject,
  AsyncComponent,
  ComponentLike,
  UnknownObject,
} from '../types.js';

export const isComponentLike = (value: unknown): value is ComponentLike =>
  typeof value === 'function';

export const isAsyncFunction = (
  value: ComponentLike
): value is AsyncComponent => {
  return value.constructor.name === 'AsyncFunction';
};

export const AsyncComponentWrapper = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => <>{children}</>;

export const createElementAsync = async (
  Comp: ComponentLike,
  props: UnknownObject
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

export const getProps = async (
  clientModule: UnknownObject,
  pathname: string
) => {
  if (!('getProps' in clientModule)) {
    return {};
  }

  if (typeof clientModule.getProps !== 'function') {
    throw new Error(
      `Exported "getProps" must be a function in "${clientModule}"`
    );
  }

  const props = await clientModule.getProps();

  assertProps(props, pathname);

  return props;
};

export const getModuleElement = async (
  clientModule: UnknownObject,
  pathname: string,
  props: UnknownObject,
  children?: readonly ReactNode[] | ReactNode
) => {
  if (!('default' in clientModule)) {
    throw new Error(`Must have a default export in "${pathname}"`);
  }

  const { default: Comp } = clientModule;

  if (!isComponentLike(Comp)) {
    throw new Error(
      `Default export must be a React component in "${pathname}"`
    );
  }

  const element: unknown = await createElementAsync(Comp, {
    ...props,
    children,
  });

  if (!isValidElement(element)) {
    throw new Error(
      `Default export must return a valid React element in "${pathname}"`
    );
  }

  return element;
};
