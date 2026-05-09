import { useCallback, useRef, useState } from 'react';

export interface UseUndoRedoResult<T> {
  state: T;
  set: (value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo<T>(initial: T): UseUndoRedoResult<T> {
  const historyRef = useRef<T[]>([initial]);
  const pointerRef = useRef(0);
  const [state, setState] = useState<T>(initial);

  const set = useCallback((value: T) => {
    // Truncate forward history when setting new state
    const history = historyRef.current.slice(0, pointerRef.current + 1);
    history.push(value);
    historyRef.current = history;
    pointerRef.current = history.length - 1;
    setState(value);
  }, []);

  const undo = useCallback(() => {
    if (pointerRef.current <= 0) return;
    pointerRef.current -= 1;
    const prev = historyRef.current[pointerRef.current];
    setState(prev);
  }, []);

  const redo = useCallback(() => {
    if (pointerRef.current >= historyRef.current.length - 1) return;
    pointerRef.current += 1;
    const next = historyRef.current[pointerRef.current];
    setState(next);
  }, []);

  const canUndo = pointerRef.current > 0;
  const canRedo = pointerRef.current < historyRef.current.length - 1;

  return { state, set, undo, redo, canUndo, canRedo };
}
