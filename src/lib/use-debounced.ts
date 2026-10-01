import { useEffect, useState } from 'react';

/**
 * Holds a value back until typing stops. Search hits the API, so firing on
 * every keystroke would send one request per character.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return settled;
}
