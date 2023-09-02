import React, {
  ComponentType,
  isValidElement,
  ReactElement,
  ReactNode,
} from 'react';
import { hydrateRoot } from 'react-dom/client';

type EmptyObject = Record<never, never>;
type UnknownObject = Record<string, unknown>;

type AsyncComponent<P = EmptyObject> = (props: P) => Promise<ReactElement>;
type ComponentLike = ComponentType | AsyncComponent;

type AssertUnknownObject = (
  module: unknown,
  pathname: string
) => asserts module is UnknownObject;

const resoluteClientJson: unknown = JSON.parse(
  document.getElementById('resolute-client-json')?.innerText ?? 'null'
);

if (!resoluteClientJson || typeof resoluteClientJson !== 'object') {
  throw new Error('Invalid resolute-client-json');
}

if (!('client' in resoluteClientJson)) {
  throw new Error('No client specified in resolute-client-json');
}

if (typeof resoluteClientJson.client !== 'string') {
  throw new Error('Client must be a string in resolute-client-json');
}

const isComponentLike = (value: unknown): value is ComponentLike =>
  typeof value === 'function';

const assertModule: AssertUnknownObject = (module, pathname) => {
  if (!module) {
    throw new Error(
      `Module at "${pathname}" was not what we expected: ${module}`
    );
  }

  if (typeof module !== 'object' || Array.isArray(module)) {
    throw new Error(`Module at "${pathname}" must be an object`);
  }
};

const assertProps: AssertUnknownObject = (props, pathname) => {
  if (!props) {
    throw new Error(`Props from "${pathname}" was no truthy: ${props}`);
  }

  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new Error(`Props from "${pathname}" must be an object`);
  }
};

const getProps = async (clientModule: UnknownObject, pathname: string) => {
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

const isAsyncFunction = (value: ComponentLike): value is AsyncComponent => {
  return value.constructor.name === 'AsyncFunction';
};

const AsyncComponentWrapper = ({
  children,
}: {
  children: ReactNode | readonly ReactNode[];
}) => <>{children}</>;

const createElementAsync = async (
  Comp: ComponentLike,
  props: UnknownObject
) => {
  if (isAsyncFunction(Comp)) {
    const element = await Comp(props);

    return <AsyncComponentWrapper {...props}>{element}</AsyncComponentWrapper>;
  }

  return <Comp {...props} />;
};

const { client } = resoluteClientJson;

const clientModule: unknown = await import(client);

assertModule(clientModule, client);

const props = await getProps(clientModule, client);

if (!('default' in clientModule)) {
  throw new Error(`Must have a default export in "${client}"`);
}

const { default: Comp } = clientModule;

if (!isComponentLike(Comp)) {
  throw new Error(`Default export must be a React component in "${client}"`);
}

const element: unknown = await createElementAsync(Comp, props);

if (!isValidElement(element)) {
  throw new Error(
    `Default export must return a valid React element in "${client}"`
  );
}

hydrateRoot(window.document.body, element);
