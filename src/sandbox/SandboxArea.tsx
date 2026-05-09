import { forwardRef, useCallback, useRef, useState } from 'react';

interface DragState {
  dragging: boolean;
  x: number;
  y: number;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
}

export const SandboxArea = forwardRef<HTMLDivElement>((_, ref) => {
  const [counter, setCounter] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [boxColor, setBoxColor] = useState('#3b82f6');
  const [boxPos, setBoxPos] = useState({ x: 20, y: 20 });
  const [keyLog, setKeyLog] = useState<string[]>([]);
  const dragRef = useRef<DragState>({
    dragging: false,
    x: 20,
    y: 20,
    startMouseX: 0,
    startMouseY: 0,
    startX: 20,
    startY: 20,
  });

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#a855f7', '#06b6d4'];

  const handleCounterClick = useCallback(() => {
    setCounter((c) => c + 1);
  }, []);

  const handleColorBoxClick = useCallback(() => {
    setBoxColor((prev) => {
      const idx = COLORS.indexOf(prev);
      return COLORS[(idx + 1) % COLORS.length];
    });
  }, [COLORS]);

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const state = dragRef.current;
    state.dragging = true;
    state.startMouseX = e.clientX;
    state.startMouseY = e.clientY;
    state.startX = state.x;
    state.startY = state.y;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const state = dragRef.current;
    if (!state.dragging) return;
    const dx = e.clientX - state.startMouseX;
    const dy = e.clientY - state.startMouseY;
    const newX = Math.max(0, state.startX + dx);
    const newY = Math.max(0, state.startY + dy);
    state.x = newX;
    state.y = newY;
    setBoxPos({ x: newX, y: newY });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    parts.push(e.key);
    const combo = parts.join('+');
    setKeyLog((prev) => [...prev.slice(-9), combo]);
  }, []);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    parts.push(e.key);
    const combo = parts.join('+');
    setKeyLog((prev) => [...prev.slice(-9), combo]);
  }, []);

  return (
    <div
      className="sandbox-area"
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="sandbox-title">Sandbox Area</div>
      <div className="sandbox-subtitle">Interact here or record/playback macros</div>

      <div className="sandbox-section">
        <div className="sandbox-section-title">Counter</div>
        <button
          className="sandbox-btn sandbox-counter-btn"
          onClick={handleCounterClick}
          data-testid="counter-btn"
        >
          Count: {counter}
        </button>
        <button
          className="sandbox-btn sandbox-reset-btn"
          onClick={() => setCounter(0)}
        >
          Reset
        </button>
      </div>

      <div className="sandbox-section">
        <div className="sandbox-section-title">Text Input</div>
        <input
          className="sandbox-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type something here..."
          data-testid="sandbox-input"
        />
        {inputValue && (
          <div className="sandbox-input-echo">Echo: {inputValue}</div>
        )}
      </div>

      <div className="sandbox-section">
        <div className="sandbox-section-title">Color Box (click to change)</div>
        <div
          className="sandbox-color-box"
          style={{ background: boxColor }}
          onClick={handleColorBoxClick}
          data-testid="color-box"
        >
          <span className="sandbox-color-label">{boxColor}</span>
        </div>
      </div>

      <div className="sandbox-drag-area">
        <div className="sandbox-section-title">Draggable Box</div>
        <div className="sandbox-drag-container">
          <div
            className="sandbox-draggable"
            style={{ left: boxPos.x, top: boxPos.y }}
            onMouseDown={handleDragMouseDown}
            data-testid="draggable-box"
          >
            Drag me
          </div>
        </div>
      </div>

      <div className="sandbox-section">
        <div className="sandbox-section-title">Key Log</div>
        <div className="sandbox-key-log">
          {keyLog.length === 0 ? (
            <span className="sandbox-key-log-empty">Press keys in sandbox to see them here</span>
          ) : (
            keyLog.map((k, i) => (
              <span key={i} className="sandbox-key-badge">
                {k}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

SandboxArea.displayName = 'SandboxArea';
