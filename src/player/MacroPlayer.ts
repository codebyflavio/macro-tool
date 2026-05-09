import type { MacroAction, MouseButton, Modifiers } from '../types/macro';
import type { PlayerStatus } from './playerReducer';
import { captureElement, samplePixel, colorsMatch } from '../utils/imageCapture';

const CURSOR_ID = 'macro-cursor';

function buttonIndex(b: MouseButton): number {
  if (b === 'middle') return 1;
  if (b === 'right') return 2;
  return 0;
}

export class MacroPlayer {
  private _target: HTMLElement;
  private _onStateChange: (s: PlayerStatus) => void;
  private _onLog: (msg: string) => void;
  private _onTick: (i: number) => void;
  private _speed = 1;
  private _abortController: AbortController | null = null;
  private _pauseResolve: (() => void) | null = null;
  private _paused = false;
  private _cursor: HTMLElement | null = null;
  private _cursorX = 0;
  private _cursorY = 0;

  constructor(
    target: HTMLElement,
    onStateChange: (s: PlayerStatus) => void,
    onLog: (msg: string) => void,
    onTick: (i: number) => void
  ) {
    this._target = target;
    this._onStateChange = onStateChange;
    this._onLog = onLog;
    this._onTick = onTick;
  }

  setSpeed(n: number): void {
    this._speed = n;
  }

  async play(actions: MacroAction[], speed: number): Promise<void> {
    this._speed = speed;
    this._abortController = new AbortController();
    this._paused = false;
    this._pauseResolve = null;

    this._ensureCursor();
    this._onStateChange('playing');
    this._onLog(`Starting playback of ${actions.length} actions`);

    try {
      await this._runActions(actions, this._abortController.signal);
      this._onLog('Playback complete');
      this._onStateChange('idle');
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError');

      if (isAbort) {
        this._onLog('Playback stopped');
        this._onStateChange('stopped');
      } else {
        this._onLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
        this._onStateChange('idle');
      }
    } finally {
      this._removeCursor();
    }
  }

  pause(): void {
    if (!this._paused) {
      this._paused = true;
      this._onStateChange('paused');
      this._onLog('Playback paused');
    }
  }

  resume(): void {
    if (this._paused) {
      this._paused = false;
      this._onStateChange('playing');
      this._onLog('Playback resumed');
      if (this._pauseResolve) {
        const resolve = this._pauseResolve;
        this._pauseResolve = null;
        resolve();
      }
    }
  }

  stop(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    // Also resolve pause if waiting
    if (this._pauseResolve) {
      const resolve = this._pauseResolve;
      this._pauseResolve = null;
      this._paused = false;
      resolve();
    }
  }

  private async _runActions(actions: MacroAction[], signal: AbortSignal, baseIndex = 0): Promise<void> {
    for (let i = 0; i < actions.length; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      await this._waitIfPaused(signal);

      const action = actions[i];
      this._onTick(baseIndex + i);
      this._onLog(`Action ${baseIndex + i + 1}: ${action.type}`);

      await this._executeAction(action, signal);
    }
  }

  private async _executeAction(action: MacroAction, signal: AbortSignal): Promise<void> {
    switch (action.type) {
      case 'move_absolute': {
        this._moveCursorTo(action.x, action.y);
        this._dispatchMouse('mousemove', action.x, action.y, 0, 0);
        this._onLog(`Move to (${action.x}, ${action.y})`);
        break;
      }

      case 'move_relative': {
        const newX = this._cursorX + action.dx;
        const newY = this._cursorY + action.dy;
        this._moveCursorTo(newX, newY);
        this._dispatchMouse('mousemove', newX, newY, 0, 0);
        this._onLog(`Move by (${action.dx}, ${action.dy})`);
        break;
      }

      case 'click': {
        this._moveCursorTo(action.x, action.y);
        const btn = buttonIndex(action.button);
        this._dispatchMouse('mousedown', action.x, action.y, btn, 1);
        this._dispatchMouse('mouseup', action.x, action.y, btn, 1);
        if (action.double) {
          this._dispatchMouse('mousedown', action.x, action.y, btn, 2);
          this._dispatchMouse('mouseup', action.x, action.y, btn, 2);
          this._dispatchMouse('dblclick', action.x, action.y, btn, 2);
        } else {
          this._dispatchMouse('click', action.x, action.y, btn, 1);
        }
        this._onLog(`Click ${action.button}${action.double ? ' (double)' : ''} at (${action.x}, ${action.y})`);
        break;
      }

      case 'key_press': {
        const target = (document.activeElement as HTMLElement) || this._target;
        this._dispatchKey('keydown', action.key, action.code, action.modifiers, target);
        this._dispatchKey('keyup', action.key, action.code, action.modifiers, target);
        this._onLog(`Key: ${this._formatKey(action.key, action.modifiers)}`);
        break;
      }

      case 'wait': {
        this._onLog(`Wait ${action.duration}ms`);
        await this._delay(action.duration, signal);
        break;
      }

      case 'loop': {
        if (action.count === 'infinite') {
          let iteration = 0;
          while (!signal.aborted) {
            await this._waitIfPaused(signal);
            if (signal.aborted) break;
            this._onLog(`Loop iteration ${++iteration}`);
            await this._runActions(action.body, signal, 0);
          }
        } else {
          for (let n = 0; n < action.count; n++) {
            if (signal.aborted) break;
            this._onLog(`Loop ${n + 1}/${action.count}`);
            await this._runActions(action.body, signal, 0);
          }
        }
        break;
      }

      case 'pixel_condition': {
        try {
          const canvas = await captureElement(this._target);
          const actual = samplePixel(canvas, action.x, action.y);
          const matches = colorsMatch(actual, action.color);
          const conditionMet = action.operator === '==' ? matches : !matches;
          this._onLog(`Pixel at (${action.x},${action.y}): ${actual} ${action.operator} ${action.color} → ${conditionMet}`);
          if (conditionMet) {
            await this._runActions(action.then, signal, 0);
          }
        } catch (err) {
          this._onLog(`Pixel condition error: ${err instanceof Error ? err.message : String(err)}`);
        }
        break;
      }
    }
  }

  private _delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const adjusted = ms / this._speed;
      const id = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, adjusted);

      const onAbort = () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private _waitIfPaused(signal: AbortSignal): Promise<void> {
    if (!this._paused) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const onAbort = () => {
        this._pauseResolve = null;
        reject(new DOMException('Aborted', 'AbortError'));
      };

      signal.addEventListener('abort', onAbort, { once: true });
      this._pauseResolve = () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
    });
  }

  private _dispatchMouse(type: string, x: number, y: number, button: number, detail: number): void {
    const rect = this._target.getBoundingClientRect();
    const clientX = rect.left + x;
    const clientY = rect.top + y;

    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button,
      buttons: button === 0 ? 1 : button === 2 ? 2 : 4,
      clientX,
      clientY,
      detail,
    });

    const el = document.elementFromPoint(clientX, clientY) || this._target;
    el.dispatchEvent(event);
  }

  private _dispatchKey(
    type: string,
    key: string,
    code: string,
    modifiers: Modifiers,
    target: HTMLElement
  ): void {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key,
      code,
      ctrlKey: modifiers.ctrl,
      shiftKey: modifiers.shift,
      altKey: modifiers.alt,
      metaKey: modifiers.meta,
    });
    target.dispatchEvent(event);
  }

  private _formatKey(key: string, modifiers: Modifiers): string {
    const parts: string[] = [];
    if (modifiers.ctrl) parts.push('Ctrl');
    if (modifiers.shift) parts.push('Shift');
    if (modifiers.alt) parts.push('Alt');
    if (modifiers.meta) parts.push('Meta');
    parts.push(key);
    return parts.join('+');
  }

  private _ensureCursor(): void {
    let cursor = document.getElementById(CURSOR_ID);
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = CURSOR_ID;
      cursor.style.cssText = [
        'position:absolute',
        'width:12px',
        'height:12px',
        'border-radius:50%',
        'border:2px solid #ff0000',
        'background:rgba(255,0,0,0.3)',
        'pointer-events:none',
        'z-index:9999',
        'transform:translate(-50%,-50%)',
        'transition:left 0.05s,top 0.05s',
      ].join(';');

      const parent = this._target.parentElement || document.body;
      parent.style.position = parent.style.position || 'relative';
      parent.appendChild(cursor);
    }
    this._cursor = cursor as HTMLElement;
    this._moveCursorTo(0, 0);
  }

  private _removeCursor(): void {
    if (this._cursor) {
      this._cursor.remove();
      this._cursor = null;
    }
  }

  private _moveCursorTo(x: number, y: number): void {
    this._cursorX = x;
    this._cursorY = y;
    if (this._cursor) {
      const rect = this._target.getBoundingClientRect();
      const parentRect = (this._target.parentElement || document.body).getBoundingClientRect();
      const left = rect.left - parentRect.left + x;
      const top = rect.top - parentRect.top + y;
      this._cursor.style.left = `${left}px`;
      this._cursor.style.top = `${top}px`;
    }
  }
}
