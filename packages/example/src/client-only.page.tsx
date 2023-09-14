import { useIsClientRender } from '@blinkorb/resolute';
import React from 'react';

export const title = 'Client Only';

const ClientOnly = () => {
  const isClientRender = useIsClientRender();

  return isClientRender ? null : <p>{"I don't exist on the client"}</p>;
};

export default ClientOnly;
