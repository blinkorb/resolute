import { useIsClientRender } from '@blinkorb/resolute';
import React from 'react';

import CounterClient from './components/counter-client.js';

export const title = 'Counter';

export interface StaticProps {
  foo: string;
}

const Counter = ({ foo }: StaticProps) => {
  const isClientRender = useIsClientRender();

  return (
    <div>
      <p>{foo}</p>
      {!isClientRender && <p>{"I don't exist on the client"}</p>}
      <CounterClient />
    </div>
  );
};

export default Counter;
