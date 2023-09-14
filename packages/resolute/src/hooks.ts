import { useEffect, useState } from 'react';

export const useIsClientRender = () => {
  const [state, setState] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setState(true);
    }
  }, []);

  return state;
};
