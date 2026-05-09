import { useCallback, useRef, useState, type RefObject } from 'react';
import { MacroRecorder } from './MacroRecorder';
import type { MacroAction } from '../types/macro';

export interface UseMacroRecorderResult {
  startRecording: () => void;
  stopRecording: () => MacroAction[];
  actions: MacroAction[];
  isRecording: boolean;
}

export function useMacroRecorder(containerRef: RefObject<HTMLElement | null>): UseMacroRecorderResult {
  const recorderRef = useRef<MacroRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<MacroAction[]>([]);

  const startRecording = useCallback(() => {
    if (!containerRef.current) return;

    if (!recorderRef.current) {
      recorderRef.current = new MacroRecorder();
    }

    recorderRef.current.start(containerRef.current);
    setIsRecording(true);
    setActions([]);
  }, [containerRef]);

  const stopRecording = useCallback((): MacroAction[] => {
    if (!recorderRef.current) {
      setIsRecording(false);
      return [];
    }

    const recorded = recorderRef.current.stop();
    setIsRecording(false);
    setActions(recorded);
    return recorded;
  }, []);

  return { startRecording, stopRecording, actions, isRecording };
}
