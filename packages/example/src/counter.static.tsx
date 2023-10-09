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
      <p>
        Client env: "{process.env.CLIENT_ENV}", Secret: "{process.env.SECRET}"
      </p>
    </div>
  );
};

export default Counter;
