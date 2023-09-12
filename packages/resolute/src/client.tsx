import { hydrateRoot } from 'react-dom/client';

import { getModuleElement } from './utils/component.js';
import { getModule } from './utils/module.js';

const resoluteClientJson = await fetch(
  `${window.location.protocol}//${window.location.host}${window.location.pathname}/resolute.json`
).then((response) => {
  if (response.ok) {
    return response.json();
  }

  throw new Error(
    `Failed to fetch resolute.json for route ${window.location.pathname}`
  );
});

if (!resoluteClientJson || typeof resoluteClientJson !== 'object') {
  throw new Error('Invalid resolute.json');
}

if ('client' in resoluteClientJson) {
  if (typeof resoluteClientJson.client !== 'string') {
    throw new Error('Client must be a string in resolute.json');
  }

  const { client } = resoluteClientJson;

  const clientModule = await getModule(client);

  hydrateRoot(
    window.document.body,
    await getModuleElement(clientModule, client)
  );
}
