import { useEffect, useRef, useState } from 'react';

import { invalidateReads } from './chain';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Load data and optionally refresh it on an interval. A failed refresh keeps the last good
 * data on screen and only surfaces the error, so a flaky RPC never blanks a page.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[], refreshMs = 0): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    let cancelled = false;
    const run = async (first: boolean): Promise<void> => {
      if (first) setState((previous) => ({ ...previous, loading: true }));
      try {
        const data = await loader.current();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setState((previous) => ({ data: previous.data, error: message, loading: false }));
        }
      }
    };
    void run(true);
    const timer = refreshMs > 0 ? window.setInterval(() => void run(false), refreshMs) : null;
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, refreshMs]);

  return {
    ...state,
    reload: () => {
      invalidateReads();
      setNonce((value) => value + 1);
    },
  };
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} - Goalpost` : 'Goalpost - did the promise keep its meaning?';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
