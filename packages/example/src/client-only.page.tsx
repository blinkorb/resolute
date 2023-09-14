import { useIsClientRender } from '@blinkorb/resolute';
import React from 'react';

export const title = 'Client Only';

const ClientOnly = () => {
  const isClientRender = useIsClientRender();

  return (
    <p>
      {isClientRender
        ? 'I only exist on the client'
        : "I don't exist on the client"}
    </p>
  );
};

export default ClientOnly;
