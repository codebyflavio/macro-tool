import { useCallback, useReducer, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { ActionLog } from './components/ActionLog';
import { MacroEditor } from './editor/MacroEditor';
import { SandboxArea } from './sandbox/SandboxArea';
import { useMacroRecorder } from './recorder/useMacroRecorder';
import { MacroPlayer } from './player/MacroPlayer';
import { playerReducer, initialPlayerState } from './player/playerReducer';
import type { MacroAction } from './types/macro';

function App() {
  const [actions, setActions] = useState<MacroAction[]>([]);
  const [playerState, dispatch] = useReducer(playerReducer, initialPlayerState);
  const sandboxRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<MacroPlayer | null>(null);

  const { startRecording, stopRecording, isRecording } = useMacroRecorder(sandboxRef);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      const recorded = stopRecording();
      if (recorded.length > 0) {
        setActions((prev) => [...prev, ...recorded]);
        dispatch({ type: 'LOG', message: `Recorded ${recorded.length} actions` });
      }
    } else {
      startRecording();
      dispatch({ type: 'LOG', message: 'Recording started...' });
    }
  }, [isRecording, startRecording, stopRecording]);

  const getOrCreatePlayer = useCallback((): MacroPlayer | null => {
    if (!sandboxRef.current) return null;

    if (!playerRef.current) {
      playerRef.current = new MacroPlayer(
        sandboxRef.current,
        (status) => {
          switch (status) {
            case 'playing':
              break;
            case 'paused':
              dispatch({ type: 'PAUSE' });
              break;
            case 'stopped':
              dispatch({ type: 'STOP' });
              break;
            case 'idle':
              dispatch({ type: 'DONE' });
              break;
          }
        },
        (msg) => dispatch({ type: 'LOG', message: msg }),
        (index) => dispatch({ type: 'TICK', index })
      );
    }
    return playerRef.current;
  }, []);

  const handlePlay = useCallback(() => {
    if (playerState.status === 'paused') {
      playerRef.current?.resume();
      dispatch({ type: 'RESUME' });
      return;
    }

    if (actions.length === 0) {
      dispatch({ type: 'LOG', message: 'No actions to play' });
      return;
    }

    const player = getOrCreatePlayer();
    if (!player) return;

    dispatch({ type: 'PLAY', total: actions.length });
    player.setSpeed(playerState.speed);
    player.play(actions, playerState.speed).then(() => {
      dispatch({ type: 'DONE' });
    });
  }, [actions, playerState.status, playerState.speed, getOrCreatePlayer]);

  const handlePause = useCallback(() => {
    playerRef.current?.pause();
    dispatch({ type: 'PAUSE' });
  }, []);

  const handleStop = useCallback(() => {
    playerRef.current?.stop();
    dispatch({ type: 'STOP' });
  }, []);

  const handleSpeedChange = useCallback(
    (s: number) => {
      dispatch({ type: 'SET_SPEED', speed: s });
      playerRef.current?.setSpeed(s);
    },
    []
  );

  const handleExport = useCallback(() => {
    const macro = {
      name: 'Exported Macro',
      createdAt: Date.now(),
      actions,
    };
    const blob = new Blob([JSON.stringify(macro, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macro-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch({ type: 'LOG', message: `Exported ${actions.length} actions` });
  }, [actions]);

  const handleImport = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      dispatch({
        type: 'LOG',
        message: `Import error: only .json macro files are supported (got "${file.name}")`,
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as { actions?: MacroAction[] };
        if (!Array.isArray(parsed.actions)) {
          throw new Error('Invalid macro file: missing actions array');
        }
        setActions(parsed.actions);
        dispatch({ type: 'LOG', message: `Imported ${parsed.actions.length} actions from ${file.name}` });
      } catch (err) {
        dispatch({
          type: 'LOG',
          message: `Import error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    };
    reader.readAsText(file);
  }, []);

  const handleActionsChange = useCallback((newActions: MacroAction[]) => {
    setActions(newActions);
  }, []);

  return (
    <div className="app">
      <Toolbar
        isRecording={isRecording}
        playerStatus={playerState.status}
        onRecord={handleRecord}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onExport={handleExport}
        onImport={handleImport}
        speed={playerState.speed}
        onSpeedChange={handleSpeedChange}
      />

      <div className="app-body">
        <div className="panel panel-editor">
          <MacroEditor actions={actions} onChange={handleActionsChange} />
        </div>

        <div className="panel panel-sandbox">
          <SandboxArea ref={sandboxRef} />
          <ActionLog log={playerState.log} />
        </div>
      </div>
    </div>
  );
}

export default App;
