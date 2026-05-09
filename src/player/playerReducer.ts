export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'stopped';

export interface PlayerState {
  status: PlayerStatus;
  speed: number;
  currentActionIndex: number;
  totalActions: number;
  log: string[];
}

export type PlayerAction =
  | { type: 'PLAY'; total: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'TICK'; index: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'LOG'; message: string }
  | { type: 'DONE' };

export const initialPlayerState: PlayerState = {
  status: 'idle',
  speed: 1,
  currentActionIndex: 0,
  totalActions: 0,
  log: [],
};

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'PLAY':
      return {
        ...state,
        status: 'playing',
        currentActionIndex: 0,
        totalActions: action.total,
        log: [],
      };

    case 'PAUSE':
      if (state.status !== 'playing') return state;
      return { ...state, status: 'paused' };

    case 'RESUME':
      if (state.status !== 'paused') return state;
      return { ...state, status: 'playing' };

    case 'STOP':
      return {
        ...state,
        status: 'stopped',
        currentActionIndex: 0,
      };

    case 'TICK':
      return { ...state, currentActionIndex: action.index };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'LOG': {
      const timestamp = new Date().toLocaleTimeString();
      const entry = `[${timestamp}] ${action.message}`;
      const log = [...state.log, entry];
      // Keep last 500 entries
      if (log.length > 500) log.splice(0, log.length - 500);
      return { ...state, log };
    }

    case 'DONE':
      return {
        ...state,
        status: 'idle',
        currentActionIndex: 0,
      };

    default:
      return state;
  }
}
