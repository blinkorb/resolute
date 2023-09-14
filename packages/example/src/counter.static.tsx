import React from 'react';

import { StaticProps } from './counter.client.js';

export const title = 'Counter';

export const getProps = async (): Promise<StaticProps> => ({
  foo: 'bar',
});

const Counter = ({ foo }: StaticProps) => {
  return (
    <div>
      <p>{foo}</p>
      <p>Count: {0}</p>
      <button>+</button>
    </div>
  );
};

export default Counter;
