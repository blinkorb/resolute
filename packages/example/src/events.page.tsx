import React from 'react';

import CounterClient from './components/counter-client.js';

export const title = 'Events';

const Counter = () => {
  return (
    <div>
      <CounterClient />
    </div>
  );
};

const Events = async () => {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));

  return (
    <>
      <p>Hello</p>
      <Counter />
    </>
  );
};

export default Events;
