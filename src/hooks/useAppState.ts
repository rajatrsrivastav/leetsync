import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { AppState } from '../types';
import type { Command } from '../services/commands';
import { send } from '../services/client';
export function useAppState() {
  const [state, setState] = useState<AppState>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const version = useRef(0);
  const pending = useRef(0);
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const revision = ++version.current;
    try {
      const next = await send({ type: 'getState' });
      if (mounted.current && revision === version.current) setState(next);
    } catch (e) {
      if (mounted.current && revision === version.current) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const listener = () => {
      void refresh();
    };
    browser.storage.onChanged.addListener(listener);
    window.addEventListener('focus', listener);
    // Content scripts cannot read storage directly; polling also wakes a suspended worker.
    const interval = setInterval(listener, 4000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      browser.storage.onChanged.removeListener(listener);
      window.removeEventListener('focus', listener);
    };
  }, [refresh]);
  const act = useCallback(async (command: Command) => {
    pending.current += 1;
    ++version.current;
    setBusy(true);
    setError('');
    const task = tail.current.then(async () => {
      try {
        const next = await send(command);
        if (mounted.current) setState(next);
        return next;
      } catch (e) {
        if (mounted.current) setError((e as Error).message);
        return undefined;
      } finally {
        pending.current -= 1;
        if (mounted.current) setBusy(pending.current > 0);
      }
    });
    tail.current = task;
    return task;
  }, []);
  return { state, error, busy, act, refresh, clearError: () => setError('') };
}
