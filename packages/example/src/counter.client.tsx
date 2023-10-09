import React from 'react';

import CounterClient from './components/counter-client.js';

export const title = 'Counter';
export const hydrate = false;

export interface StaticProps {
  foo: string;
}

const Counter = ({ foo }: StaticProps) => {
  return (
    <div>
      <p>{foo}</p>
      <CounterClient />
      <p>
        Client env: "{process.env.CLIENT_ENV}", Accessing an env var that is not
        prefixed with "CLIENT_" on the client will error when trying to access
        process at runtime
      </p>
    </div>
  );
};

export default Counter;
