import React, { useState } from 'react';

const AboutInfo = ({ title, content }: { title: string; content: string }) => {
  const [count, setCount] = useState(0);
  return (
    <>
      <h1>{title}</h1>
      <p>{content}</p>
      <div>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>+</button>
      </div>
    </>
  );
};

export default AboutInfo;
