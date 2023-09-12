import React, { useState } from 'react';

export const title = 'Counter';

export interface StaticProps {
  foo: string;
}

const Counter = ({ foo }: StaticProps) => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{foo}</p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
};

export default Counter;
