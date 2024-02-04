import { DEV_SERVER_PATHNAME, WEB_SOCKET_PORT } from './constants.js';

const connectToDevServer = () => {
  const webSocketClient = new WebSocket(
    `${globalThis.location.protocol.startsWith('https') ? 'wss://' : 'ws://'}${
      globalThis.location.hostname
    }:${WEB_SOCKET_PORT}${DEV_SERVER_PATHNAME}`
  );

  webSocketClient.onopen = () => {
    // eslint-disable-next-line no-console
    console.log('Dev server connected');
  };

  webSocketClient.onclose = () => {
    // eslint-disable-next-line no-console
    console.log('Dev server disconnected');
  };
};

export default connectToDevServer;
