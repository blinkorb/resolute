import { useIsClientRender } from '@blinkorb/resolute';
import React from 'react';

const ClientOnly = () => {
  const isClientRender = useIsClientRender();

  return isClientRender ? null : <p>{"I don't exist on the client"}</p>;
};

export default ClientOnly;
