import type { PlayerStatus } from '../player/playerReducer';

interface ToolbarProps {
  isRecording: boolean;
  playerStatus: PlayerStatus;
  onRecord: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5];

export function Toolbar({
  isRecording,
  playerStatus,
  onRecord,
  onPlay,
  onPause,
  onStop,
  onExport,
  onImport,
  speed,
  onSpeedChange,
}: ToolbarProps) {
  const isPlaying = playerStatus === 'playing';
  const isPaused = playerStatus === 'paused';
  const isActive = isPlaying || isPaused;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-logo">⬡</span>
        <span className="toolbar-title">Macro Tool</span>
      </div>

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isRecording ? 'toolbar-btn-recording' : 'toolbar-btn-record'}`}
          onClick={onRecord}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
          disabled={isActive}
        >
          <span className={`toolbar-icon ${isRecording ? 'blink' : ''}`}>●</span>
          {isRecording ? 'Stop Rec' : 'Record'}
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn toolbar-btn-play"
          onClick={onPlay}
          disabled={isPlaying || isRecording}
          title="Play macro"
        >
          ▶ Play
        </button>

        <button
          className="toolbar-btn toolbar-btn-pause"
          onClick={isPaused ? onPlay : onPause}
          disabled={!isActive || isRecording}
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button
          className="toolbar-btn toolbar-btn-stop"
          onClick={onStop}
          disabled={!isActive || isRecording}
          title="Stop playback"
        >
          ■ Stop
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group toolbar-speed">
        <span className="toolbar-label">Speed:</span>
        <div className="speed-options">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`speed-btn ${speed === s ? 'speed-btn-active' : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn toolbar-btn-export"
          onClick={onExport}
          title="Export macro as JSON"
        >
          ↑ Export
        </button>

        <label className="toolbar-btn toolbar-btn-import" title="Import macro from JSON">
          ↓ Import
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </label>
      </div>

      <div className="toolbar-status">
        <span
          className={`status-dot status-${playerStatus}`}
          title={`Status: ${playerStatus}`}
        />
        <span className="status-text">{playerStatus}</span>
        {isRecording && <span className="status-recording blink">● REC</span>}
      </div>
    </div>
  );
}
