import { hydrateRoot } from 'react-dom/client';

import { getModuleElement } from './utils/component.js';
import { getModule } from './utils/module.js';

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

const { client } = resoluteClientJson;

const clientModule = await getModule(client);

hydrateRoot(window.document.body, await getModuleElement(clientModule, client));
