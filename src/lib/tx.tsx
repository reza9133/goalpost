import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { invalidateReads, sendTransaction, type Call, type TxOutcome } from './chain';
import { useIdentity } from './identity';
import type { Phase } from './receipt';

export interface TxState {
  label: string;
  phase: Phase;
  hash?: string;
  statusName?: string;
  message?: string;
  startedAt: number;
  finishedAt?: number;
}

interface TxValue {
  state: TxState | null;
  busy: boolean;
  /** Run one transaction. Resolves with the outcome, or null if it could not be submitted. */
  run: (label: string, call: Call) => Promise<TxOutcome | null>;
  dismiss: () => void;
}

const TxContext = createContext<TxValue | null>(null);

export function TxProvider({ children }: { children: ReactNode }) {
  const { signer } = useIdentity();
  const [state, setState] = useState<TxState | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const busy = state !== null && state.phase !== 'decided' && state.phase !== 'failed';

  const run = useCallback(
    async (label: string, call: Call): Promise<TxOutcome | null> => {
      const startedAt = Date.now();
      if (!signer) {
        setState({ label, phase: 'failed', message: 'Choose an identity first, from the menu at the top right.', startedAt, finishedAt: startedAt });
        return null;
      }
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setState({ label, phase: 'signing', startedAt });
      try {
        const outcome = await sendTransaction(
          signer,
          call,
          (update) =>
            setState((previous) => ({
              label,
              startedAt,
              message: previous?.message,
              ...update,
              hash: update.hash ?? previous?.hash,
            })),
          abort.signal,
        );
        invalidateReads();
        setState({
          label,
          startedAt,
          finishedAt: Date.now(),
          phase: outcome.ok ? 'decided' : 'failed',
          hash: outcome.hash,
          statusName: outcome.statusName,
          message: outcome.failure ?? undefined,
        });
        return outcome;
      } catch (cause) {
        setState((previous) => ({
          label,
          startedAt,
          finishedAt: Date.now(),
          phase: 'failed',
          hash: previous?.hash,
          message: cause instanceof Error ? cause.message : String(cause),
        }));
        return null;
      }
    },
    [signer],
  );

  const dismiss = useCallback(() => {
    controller.current?.abort();
    setState(null);
  }, []);

  const value = useMemo<TxValue>(() => ({ state, busy, run, dismiss }), [state, busy, run, dismiss]);
  return <TxContext.Provider value={value}>{children}</TxContext.Provider>;
}

export function useTx(): TxValue {
  const value = useContext(TxContext);
  if (value === null) throw new Error('useTx must be used inside TxProvider');
  return value;
}
