import React, { ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';

import Page from './page.js';
import { ResoluteJSON } from './types.js';
import { getModuleElement, getProps } from './utils/component.js';
import { getModule } from './utils/module.js';

const resoluteClientJson: ResoluteJSON = await fetch(
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

  const clientModule = await getModule(client.pathname);
  const props = await getProps(clientModule, client.pathname);
  const allProps = staticInfo.props ? { ...staticInfo.props, ...props } : props;
  const element = await getModuleElement(
    clientModule,
    client.pathname,
    allProps
  );

  const withLayouts = await client.layouts.reduce<Promise<ReactElement>>(
    async (accPromise, layout) => {
      const acc = await accPromise;
      const layoutModule = await getModule(layout.pathname);
      const layoutProps = layout.props ?? {};
      const layoutElement = await getModuleElement(
        layoutModule,
        layout.pathname,
        layoutProps,
        acc
      );

      return layoutElement;
    },
    Promise.resolve(element)
  );

  hydrateRoot(
    window.document.body,
    <Page pageModule={clientModule} pathname={client.pathname}>
      {withLayouts}
    </Page>
  );
}
