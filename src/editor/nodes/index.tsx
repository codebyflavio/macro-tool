import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MacroAction } from '../../types/macro';

const headerColors: Record<string, string> = {
  move_absolute: '#3b82f6',
  move_relative: '#60a5fa',
  click: '#ef4444',
  key_press: '#a855f7',
  wait: '#f59e0b',
  loop: '#10b981',
  pixel_condition: '#06b6d4',
};

const actionLabels: Record<string, string> = {
  move_absolute: 'Move Absolute',
  move_relative: 'Move Relative',
  click: 'Click',
  key_press: 'Key Press',
  wait: 'Wait',
  loop: 'Loop',
  pixel_condition: 'Pixel Condition',
};

function NodeWrapper({
  type,
  children,
  hasInput = true,
  hasOutput = true,
}: {
  type: string;
  children: React.ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
}) {
  const color = headerColors[type] ?? '#666';
  return (
    <div className="macro-node">
      {hasInput && (
        <Handle type="target" position={Position.Top} id="in" className="macro-handle" />
      )}
      <div className="macro-node-header" style={{ background: color }}>
        <span className="macro-node-label">{actionLabels[type] ?? type}</span>
      </div>
      <div className="macro-node-body">{children}</div>
      {hasOutput && (
        <Handle type="source" position={Position.Bottom} id="out" className="macro-handle" />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="macro-node-field">
      <span className="macro-node-field-label">{label}:</span>
      <span className="macro-node-field-value">{String(value)}</span>
    </div>
  );
}

type NodeData = MacroAction & Record<string, unknown>;

function MoveAbsoluteNode({ data }: NodeProps) {
  const d = data as NodeData;
  return (
    <NodeWrapper type="move_absolute">
      <Field label="X" value={d['x'] as number ?? 0} />
      <Field label="Y" value={d['y'] as number ?? 0} />
    </NodeWrapper>
  );
}

function MoveRelativeNode({ data }: NodeProps) {
  const d = data as NodeData;
  return (
    <NodeWrapper type="move_relative">
      <Field label="ΔX" value={d['dx'] as number ?? 0} />
      <Field label="ΔY" value={d['dy'] as number ?? 0} />
    </NodeWrapper>
  );
}

function ClickNode({ data }: NodeProps) {
  const d = data as NodeData;
  return (
    <NodeWrapper type="click">
      <Field label="X" value={d['x'] as number ?? 0} />
      <Field label="Y" value={d['y'] as number ?? 0} />
      <Field label="Button" value={d['button'] as string ?? 'left'} />
      <Field label="Double" value={d['double'] as boolean ?? false} />
    </NodeWrapper>
  );
}

function KeyPressNode({ data }: NodeProps) {
  const d = data as NodeData;
  const modifiers: string[] = [];
  const mods = d['modifiers'] as { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } | undefined;
  if (mods?.ctrl) modifiers.push('Ctrl');
  if (mods?.shift) modifiers.push('Shift');
  if (mods?.alt) modifiers.push('Alt');
  if (mods?.meta) modifiers.push('Meta');
  modifiers.push((d['key'] as string) ?? '');
  return (
    <NodeWrapper type="key_press">
      <Field label="Key" value={modifiers.join('+')} />
      <Field label="Code" value={d['code'] as string ?? ''} />
    </NodeWrapper>
  );
}

function WaitNode({ data }: NodeProps) {
  const d = data as NodeData;
  return (
    <NodeWrapper type="wait">
      <Field label="Duration" value={`${d['duration'] as number ?? 0}ms`} />
    </NodeWrapper>
  );
}

function LoopNode({ data }: NodeProps) {
  const d = data as NodeData;
  const count = d['count'] as number | 'infinite';
  return (
    <NodeWrapper type="loop">
      <Field label="Count" value={count === 'infinite' ? '∞' : count ?? 1} />
    </NodeWrapper>
  );
}

function PixelConditionNode({ data }: NodeProps) {
  const d = data as NodeData;
  const color = (d['color'] as string) ?? '#000000';
  return (
    <NodeWrapper type="pixel_condition">
      <Field label="X" value={d['x'] as number ?? 0} />
      <Field label="Y" value={d['y'] as number ?? 0} />
      <div className="macro-node-field">
        <span className="macro-node-field-label">Color:</span>
        <span
          className="macro-node-color-swatch"
          style={{ background: color }}
          title={color}
        />
        <span className="macro-node-field-value">{color}</span>
      </div>
      <Field label="Op" value={d['operator'] as string ?? '=='} />
    </NodeWrapper>
  );
}

export const nodeTypes = {
  move_absolute: MoveAbsoluteNode,
  move_relative: MoveRelativeNode,
  click: ClickNode,
  key_press: KeyPressNode,
  wait: WaitNode,
  loop: LoopNode,
  pixel_condition: PixelConditionNode,
};
