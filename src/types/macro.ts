export type MouseButton = 'left' | 'right' | 'middle';

export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export interface MoveRelativeAction {
  type: 'move_relative';
  dx: number;
  dy: number;
  timestamp: number;
}

export interface MoveAbsoluteAction {
  type: 'move_absolute';
  x: number;
  y: number;
  timestamp: number;
}

export interface ClickAction {
  type: 'click';
  x: number;
  y: number;
  button: MouseButton;
  double: boolean;
  timestamp: number;
}

export interface KeyPressAction {
  type: 'key_press';
  key: string;
  code: string;
  modifiers: Modifiers;
  timestamp: number;
}

export interface WaitAction {
  type: 'wait';
  duration: number;
  timestamp: number;
}

export interface LoopAction {
  type: 'loop';
  count: number | 'infinite';
  body: MacroAction[];
  timestamp: number;
}

export interface PixelConditionAction {
  type: 'pixel_condition';
  x: number;
  y: number;
  color: string;
  operator: '==' | '!=';
  then: MacroAction[];
  timestamp: number;
}

export type MacroAction =
  | MoveRelativeAction
  | MoveAbsoluteAction
  | ClickAction
  | KeyPressAction
  | WaitAction
  | LoopAction
  | PixelConditionAction;

export interface Macro {
  id: string;
  name: string;
  actions: MacroAction[];
  createdAt: number;
}
