import type {
  MacroAction,
  MoveRelativeAction,
  ClickAction,
  KeyPressAction,
  WaitAction,
  Modifiers,
  MouseButton,
} from '../types/macro';

const WAIT_THRESHOLD_MS = 200;
const MOVE_BATCH_MS = 16;

function buttonName(b: number): MouseButton {
  if (b === 1) return 'middle';
  if (b === 2) return 'right';
  return 'left';
}

export class MacroRecorder {
  private _actions: MacroAction[] = [];
  private _recording = false;
  private _lastTimestamp = 0;
  private _pendingDx = 0;
  private _pendingDy = 0;
  private _hasPendingMove = false;
  private _rafId: number | null = null;
  private _downInfo: { x: number; y: number; button: number; time: number } | null = null;
  private _lastFlushTime = 0;

  private readonly _onPointerLockChange: () => void;
  private readonly _onMouseMove: (e: MouseEvent) => void;
  private readonly _onMouseDown: (e: MouseEvent) => void;
  private readonly _onMouseUp: (e: MouseEvent) => void;
  private readonly _onKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
  }

  start(container: HTMLElement): void {
    if (this._recording) return;
    this._actions = [];
    this._recording = true;
    this._lastTimestamp = performance.now();
    this._lastFlushTime = this._lastTimestamp;
    this._hasPendingMove = false;
    this._pendingDx = 0;
    this._pendingDy = 0;

    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);

    container.requestPointerLock().catch(() => {
      // Pointer lock may be denied in some environments; continue recording without it
    });
  }

  stop(): MacroAction[] {
    if (!this._recording) return this._actions;
    this._recording = false;

    this._flushPendingMove();

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('keydown', this._onKeyDown);

    this._downInfo = null;
    return this._actions;
  }

  getActions(): MacroAction[] {
    return this._actions;
  }

  private _handlePointerLockChange(): void {
    if (!document.pointerLockElement && this._recording) {
      // Pointer lock was released externally — stop recording
      this.stop();
    }
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this._recording) return;
    const now = performance.now();

    this._checkWait(now);

    this._pendingDx += e.movementX;
    this._pendingDy += e.movementY;
    this._hasPendingMove = true;

    if (now - this._lastFlushTime >= MOVE_BATCH_MS) {
      this._flushPendingMove();
      this._lastFlushTime = now;
    } else if (this._rafId === null) {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        this._flushPendingMove();
        this._lastFlushTime = performance.now();
      });
    }

    this._lastTimestamp = now;
  }

  private _handleMouseDown(e: MouseEvent): void {
    if (!this._recording) return;
    const now = performance.now();
    this._checkWait(now);
    this._flushPendingMove();

    this._downInfo = {
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      time: now,
    };
    this._lastTimestamp = now;
  }

  private _handleMouseUp(e: MouseEvent): void {
    if (!this._recording) return;
    const now = performance.now();
    this._checkWait(now);
    this._flushPendingMove();

    if (this._downInfo) {
      const isDouble = e.detail >= 2;
      const action: ClickAction = {
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        button: buttonName(this._downInfo.button),
        double: isDouble,
        timestamp: now,
      };
      this._actions.push(action);
      this._downInfo = null;
    }

    this._lastTimestamp = now;
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this._recording) return;
    const now = performance.now();
    this._checkWait(now);
    this._flushPendingMove();

    const modifiers: Modifiers = {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey,
    };

    const action: KeyPressAction = {
      type: 'key_press',
      key: e.key,
      code: e.code,
      modifiers,
      timestamp: now,
    };
    this._actions.push(action);
    this._lastTimestamp = now;
  }

  private _checkWait(now: number): void {
    const gap = now - this._lastTimestamp;
    if (this._lastTimestamp > 0 && gap > WAIT_THRESHOLD_MS) {
      const waitAction: WaitAction = {
        type: 'wait',
        duration: Math.round(gap),
        timestamp: now,
      };
      this._actions.push(waitAction);
    }
  }

  private _flushPendingMove(): void {
    if (!this._hasPendingMove) return;
    if (this._pendingDx !== 0 || this._pendingDy !== 0) {
      const action: MoveRelativeAction = {
        type: 'move_relative',
        dx: this._pendingDx,
        dy: this._pendingDy,
        timestamp: performance.now(),
      };
      this._actions.push(action);
    }
    this._pendingDx = 0;
    this._pendingDy = 0;
    this._hasPendingMove = false;
  }
}
