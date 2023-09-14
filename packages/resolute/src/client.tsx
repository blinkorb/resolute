import { hydrateRoot } from 'react-dom/client';

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

  hydrateRoot(window.document.body, element);
}
