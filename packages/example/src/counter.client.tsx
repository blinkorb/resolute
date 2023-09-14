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
    </div>
  );
};

export default Counter;
