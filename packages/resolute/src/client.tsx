import React, { ReactElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import Page from './page.js';
import { PageDataJSON } from './types.js';
import {
  getInjectedProps,
  getModuleElement,
  getProps,
} from './utils/component.js';
import { getModule } from './utils/module.js';
import { toTSX } from './utils/paths.js';

const resoluteClientJson: PageDataJSON = await fetch(
  `${window.location.protocol}//${window.location.host}${window.location.pathname}/resolute.json`
).then((response) => {
  if (response.ok) {
    return response.json();
  }

  throw new Error(
    `Failed to fetch resolute.json for route ${window.location.pathname}`
  );
});

if ('client' in resoluteClientJson) {
  const { client, static: staticInfo } = resoluteClientJson;

  const { href } = globalThis.location;
  const pageModule = await getModule(client.pathname);
  const props = await getProps(pageModule, client.pathname);
  const allProps = staticInfo.props ? { ...staticInfo.props, ...props } : props;
  const element = await getModuleElement(
    pageModule,
    client.pathname,
    getInjectedProps(
      pageModule,
      toTSX(client.pathname),
      href,
      allProps,
      undefined,
      'client'
    )
  );

  const withLayouts = await client.layouts.reduce<Promise<ReactElement>>(
    async (accPromise, layout) => {
      const acc = await accPromise;
      const layoutModule = await getModule(layout.pathname);
      const layoutProps = layout.props ?? {};
      const layoutElement = await getModuleElement(
        layoutModule,
        layout.pathname,
        getInjectedProps(
          layoutModule,
          toTSX(layout.pathname),
          href,
          layoutProps,
          acc,
          'client'
        )
      );

      return layoutElement;
    },
    Promise.resolve(element)
  );

  const page = (
    <Page
      pageModule={pageModule}
      pathname={client.pathname}
      href={globalThis.location.href}
    >
      {withLayouts}
    </Page>
  );

  if (pageModule.hydrate === false) {
    const root = createRoot(window.document.body);
    root.render(page);
  } else {
    hydrateRoot(window.document.body, page);
  }
}
