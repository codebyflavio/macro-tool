import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playerReducer, initialPlayerState } from '../player/playerReducer';
import type { PlayerState } from '../player/playerReducer';

// ─── playerReducer tests ──────────────────────────────────────────────────────

describe('playerReducer', () => {
  it('has correct initial state', () => {
    expect(initialPlayerState.status).toBe('idle');
    expect(initialPlayerState.speed).toBe(1);
    expect(initialPlayerState.currentActionIndex).toBe(0);
    expect(initialPlayerState.totalActions).toBe(0);
    expect(initialPlayerState.log).toEqual([]);
  });

  it('handles PLAY action', () => {
    const state = playerReducer(initialPlayerState, { type: 'PLAY', total: 5 });
    expect(state.status).toBe('playing');
    expect(state.totalActions).toBe(5);
    expect(state.currentActionIndex).toBe(0);
    expect(state.log).toEqual([]);
  });

  it('handles PAUSE action from playing', () => {
    const playing: PlayerState = { ...initialPlayerState, status: 'playing' };
    const state = playerReducer(playing, { type: 'PAUSE' });
    expect(state.status).toBe('paused');
  });

  it('PAUSE does nothing when not playing', () => {
    const state = playerReducer(initialPlayerState, { type: 'PAUSE' });
    expect(state.status).toBe('idle');
  });

  it('handles RESUME action from paused', () => {
    const paused: PlayerState = { ...initialPlayerState, status: 'paused' };
    const state = playerReducer(paused, { type: 'RESUME' });
    expect(state.status).toBe('playing');
  });

  it('RESUME does nothing when not paused', () => {
    const state = playerReducer(initialPlayerState, { type: 'RESUME' });
    expect(state.status).toBe('idle');
  });

  it('handles STOP action', () => {
    const playing: PlayerState = { ...initialPlayerState, status: 'playing', currentActionIndex: 3 };
    const state = playerReducer(playing, { type: 'STOP' });
    expect(state.status).toBe('stopped');
    expect(state.currentActionIndex).toBe(0);
  });

  it('handles TICK action', () => {
    const playing: PlayerState = { ...initialPlayerState, status: 'playing' };
    const state = playerReducer(playing, { type: 'TICK', index: 4 });
    expect(state.currentActionIndex).toBe(4);
  });

  it('handles SET_SPEED action', () => {
    const state = playerReducer(initialPlayerState, { type: 'SET_SPEED', speed: 2.5 });
    expect(state.speed).toBe(2.5);
  });

  it('handles LOG action', () => {
    const state = playerReducer(initialPlayerState, { type: 'LOG', message: 'Test message' });
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toContain('Test message');
  });

  it('LOG action appends to existing log', () => {
    let state = playerReducer(initialPlayerState, { type: 'LOG', message: 'First' });
    state = playerReducer(state, { type: 'LOG', message: 'Second' });
    expect(state.log).toHaveLength(2);
    expect(state.log[0]).toContain('First');
    expect(state.log[1]).toContain('Second');
  });

  it('LOG action caps at 500 entries', () => {
    let state = initialPlayerState;
    for (let i = 0; i < 510; i++) {
      state = playerReducer(state, { type: 'LOG', message: `msg ${i}` });
    }
    expect(state.log.length).toBeLessThanOrEqual(500);
  });

  it('handles DONE action', () => {
    const playing: PlayerState = { ...initialPlayerState, status: 'playing', currentActionIndex: 5 };
    const state = playerReducer(playing, { type: 'DONE' });
    expect(state.status).toBe('idle');
    expect(state.currentActionIndex).toBe(0);
  });
});

// ─── MacroPlayer integration tests ───────────────────────────────────────────

describe('MacroPlayer integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom doesn't implement elementFromPoint — provide a stub
    if (!document.elementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', {
        value: (_x: number, _y: number) => document.body,
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('dispatches events for a wait + click sequence', async () => {
    const { MacroPlayer } = await import('../player/MacroPlayer');

    const target = document.createElement('div');
    target.style.width = '400px';
    target.style.height = '300px';
    document.body.appendChild(target);

    const dispatchedTypes: string[] = [];
    target.addEventListener('mousedown', (e) => dispatchedTypes.push(e.type));
    target.addEventListener('mouseup', (e) => dispatchedTypes.push(e.type));
    target.addEventListener('click', (e) => dispatchedTypes.push(e.type));

    // Patch elementFromPoint to return our target
    Object.defineProperty(document, 'elementFromPoint', {
      value: () => target,
      writable: true,
      configurable: true,
    });

    const onStateChange = vi.fn();
    const onLog = vi.fn();
    const onTick = vi.fn();

    const player = new MacroPlayer(target, onStateChange, onLog, onTick);

    const playPromise = player.play(
      [
        { type: 'wait', duration: 100, timestamp: 0 },
        { type: 'click', x: 50, y: 50, button: 'left', double: false, timestamp: 100 },
      ],
      1
    );

    // Advance past the wait
    await vi.advanceTimersByTimeAsync(200);
    await playPromise;

    expect(dispatchedTypes).toContain('mousedown');
    expect(dispatchedTypes).toContain('mouseup');
    expect(dispatchedTypes).toContain('click');

    document.body.removeChild(target);
  });

  it('calls onLog for each action', async () => {
    const { MacroPlayer } = await import('../player/MacroPlayer');

    const target = document.createElement('div');
    document.body.appendChild(target);

    Object.defineProperty(document, 'elementFromPoint', {
      value: () => target,
      writable: true,
      configurable: true,
    });

    const onLog = vi.fn();
    const player = new MacroPlayer(target, vi.fn(), onLog, vi.fn());

    const playPromise = player.play(
      [{ type: 'wait', duration: 50, timestamp: 0 }],
      1
    );
    await vi.advanceTimersByTimeAsync(100);
    await playPromise;

    expect(onLog).toHaveBeenCalled();
    const messages: string[] = onLog.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(messages.some((m) => m.toLowerCase().includes('wait'))).toBe(true);

    document.body.removeChild(target);
  });

  it('stop() aborts playback', async () => {
    const { MacroPlayer } = await import('../player/MacroPlayer');

    const target = document.createElement('div');
    document.body.appendChild(target);

    const statuses: string[] = [];
    const player = new MacroPlayer(
      target,
      (s) => statuses.push(s),
      vi.fn(),
      vi.fn()
    );

    const playPromise = player.play(
      [{ type: 'wait', duration: 5000, timestamp: 0 }],
      1
    );

    // Let the play() start and enter the wait
    await vi.advanceTimersByTimeAsync(10);

    // Stop it — this calls abortController.abort()
    player.stop();

    // Run all pending microtasks and timers
    await vi.runAllTimersAsync();

    // Await the play promise (it should resolve now since abort was triggered)
    await playPromise;

    // Status should contain 'stopped' (set by the AbortError handler)
    expect(statuses).toContain('stopped');

    document.body.removeChild(target);
  });

  it('calls onTick with action index', async () => {
    const { MacroPlayer } = await import('../player/MacroPlayer');

    const target = document.createElement('div');
    document.body.appendChild(target);

    Object.defineProperty(document, 'elementFromPoint', {
      value: () => target,
      writable: true,
      configurable: true,
    });

    const onTick = vi.fn();
    const player = new MacroPlayer(target, vi.fn(), vi.fn(), onTick);

    const playPromise = player.play(
      [
        { type: 'wait', duration: 10, timestamp: 0 },
        { type: 'wait', duration: 10, timestamp: 1 },
      ],
      1
    );

    await vi.advanceTimersByTimeAsync(200);
    await playPromise;

    const indices: number[] = onTick.mock.calls.map((c: unknown[]) => c[0] as number);
    expect(indices).toContain(0);
    expect(indices).toContain(1);

    document.body.removeChild(target);
  });

  it('setSpeed affects playback timing', async () => {
    const { MacroPlayer } = await import('../player/MacroPlayer');

    const target = document.createElement('div');
    document.body.appendChild(target);

    const onLog = vi.fn();
    const player = new MacroPlayer(target, vi.fn(), onLog, vi.fn());

    // At 2x speed, 100ms wait should complete in ~50ms real time
    const playPromise = player.play(
      [{ type: 'wait', duration: 100, timestamp: 0 }],
      2
    );

    await vi.advanceTimersByTimeAsync(60);
    await playPromise;

    // Completed within 60ms at 2x speed (100ms / 2 = 50ms)
    const messages: string[] = onLog.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(messages.some((m) => m.includes('complete') || m.includes('Wait'))).toBe(true);

    document.body.removeChild(target);
  });
});
