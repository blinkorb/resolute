import React, { useState } from 'react';

export const title = 'Events';

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
};

const Events = async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 1000));

  return (
    <>
      <p>Hello</p>
      <Counter />
    </>
  );
};

export default Events;
