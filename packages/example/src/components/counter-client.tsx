import React, { useState } from 'react';
import { createUseStyles } from 'react-jss';

const useStyles = createUseStyles((theme) => ({
  button: {
    border: `1px solid ${theme.red}`,
  },
}));

const CounterClient = () => {
  const styles = useStyles();
  const [count, setCount] = useState(0);

  return (
    <>
      <p>Count: {count}</p>
      <button className={styles.button} onClick={() => setCount(count + 1)}>
        +
      </button>
    </>
  );
};

export default CounterClient;
