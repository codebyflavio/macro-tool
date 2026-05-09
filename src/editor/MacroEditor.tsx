import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './nodes';
import { actionsToGraph, graphToActions } from './graphConverter';
import { useUndoRedo } from './useUndoRedo';
import { PropertyPanel } from '../components/PropertyPanel';
import type { MacroAction } from '../types/macro';

interface GraphState {
  nodes: Node[];
  edges: Edge[];
}

interface MacroEditorProps {
  actions: MacroAction[];
  onChange: (actions: MacroAction[]) => void;
}

const PALETTE_ITEMS: { type: string; label: string; color: string }[] = [
  { type: 'move_absolute', label: 'Move Absolute', color: '#3b82f6' },
  { type: 'move_relative', label: 'Move Relative', color: '#60a5fa' },
  { type: 'click', label: 'Click', color: '#ef4444' },
  { type: 'key_press', label: 'Key Press', color: '#a855f7' },
  { type: 'wait', label: 'Wait', color: '#f59e0b' },
  { type: 'loop', label: 'Loop', color: '#10b981' },
  { type: 'pixel_condition', label: 'Pixel Cond.', color: '#06b6d4' },
];

function defaultData(type: string): Record<string, unknown> {
  const ts = Date.now();
  switch (type) {
    case 'move_absolute': return { type, x: 0, y: 0, timestamp: ts };
    case 'move_relative': return { type, dx: 0, dy: 0, timestamp: ts };
    case 'click': return { type, x: 0, y: 0, button: 'left', double: false, timestamp: ts };
    case 'key_press': return { type, key: '', code: '', modifiers: { ctrl: false, shift: false, alt: false, meta: false }, timestamp: ts };
    case 'wait': return { type, duration: 1000, timestamp: ts };
    case 'loop': return { type, count: 1, body: [], timestamp: ts };
    case 'pixel_condition': return { type, x: 0, y: 0, color: '#000000', operator: '==', then: [], timestamp: ts };
    default: return { type, timestamp: ts };
  }
}

let nodeIdCounter = 1000;
function newNodeId() {
  return `node-${nodeIdCounter++}`;
}

function MacroEditorInner({ actions, onChange }: MacroEditorProps) {
  const { screenToFlowPosition } = useReactFlow();
  const initialGraph = actionsToGraph(actions);

  const { state: graphState, set: setGraphState, undo, redo, canUndo, canRedo } = useUndoRedo<GraphState>(initialGraph);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const dragTypeRef = useRef<string | null>(null);

  const selectedNode = graphState.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Sync incoming actions into graph
  const lastActionsRef = useRef<MacroAction[]>(actions);
  useEffect(() => {
    if (actions !== lastActionsRef.current) {
      lastActionsRef.current = actions;
      setGraphState(actionsToGraph(actions));
    }
  }, [actions, setGraphState]);

  const emitChange = useCallback(
    (state: GraphState) => {
      const newActions = graphToActions(state.nodes, state.edges);
      onChange(newActions);
    },
    [onChange]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const next: GraphState = {
        nodes: applyNodeChanges(changes, graphState.nodes),
        edges: graphState.edges,
      };
      setGraphState(next);
      emitChange(next);
    },
    [graphState, setGraphState, emitChange]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const next: GraphState = {
        nodes: graphState.nodes,
        edges: applyEdgeChanges(changes, graphState.edges),
      };
      setGraphState(next);
      emitChange(next);
    },
    [graphState, setGraphState, emitChange]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const next: GraphState = {
        nodes: graphState.nodes,
        edges: addEdge(connection, graphState.edges),
      };
      setGraphState(next);
      emitChange(next);
    },
    [graphState, setGraphState, emitChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = dragTypeRef.current;
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = newNodeId();
      const newNode: Node = {
        id,
        type,
        position,
        data: defaultData(type),
      };

      const next: GraphState = {
        nodes: [...graphState.nodes, newNode],
        edges: graphState.edges,
      };
      setGraphState(next);
      emitChange(next);
    },
    [graphState, setGraphState, emitChange, screenToFlowPosition]
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handlePropertyChange = useCallback(
    (data: Record<string, unknown>) => {
      const next: GraphState = {
        nodes: graphState.nodes.map((n) =>
          n.id === selectedNodeId ? { ...n, data } : n
        ),
        edges: graphState.edges,
      };
      setGraphState(next);
      emitChange(next);
    },
    [graphState, selectedNodeId, setGraphState, emitChange]
  );

  const handleClear = useCallback(() => {
    const next: GraphState = { nodes: [], edges: [] };
    setGraphState(next);
    emitChange(next);
    setSelectedNodeId(null);
  }, [setGraphState, emitChange]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const next: GraphState = {
      nodes: graphState.nodes.filter((n) => n.id !== selectedNodeId),
      edges: graphState.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      ),
    };
    setGraphState(next);
    emitChange(next);
    setSelectedNodeId(null);
  }, [graphState, selectedNodeId, setGraphState, emitChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedNodeId, handleDeleteSelected]);

  return (
    <div className="macro-editor-container">
      <div className="macro-editor-toolbar">
        <button
          className="editor-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="editor-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
        <button className="editor-btn editor-btn-danger" onClick={handleClear}>
          Clear
        </button>
        {selectedNode && (
          <button className="editor-btn editor-btn-danger" onClick={handleDeleteSelected}>
            Delete Node
          </button>
        )}
        <span className="editor-info">
          {graphState.nodes.length} nodes · {graphState.edges.length} edges
        </span>
      </div>

      <div className="macro-editor-body">
        <div className="macro-palette">
          <div className="palette-title">Actions</div>
          {PALETTE_ITEMS.map((item) => (
            <div
              key={item.type}
              className="palette-item"
              style={{ borderLeft: `3px solid ${item.color}` }}
              draggable
              onDragStart={() => {
                dragTypeRef.current = item.type;
              }}
              onDragEnd={() => {
                dragTypeRef.current = null;
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="macro-flow-area" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={graphState.nodes}
            edges={graphState.edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
          >
            <Background color="#2a2d3a" gap={16} />
            <Controls />
            <MiniMap nodeColor="#3b82f6" maskColor="rgba(0,0,0,0.6)" />
          </ReactFlow>
        </div>

        {selectedNode && (
          <PropertyPanel
            node={selectedNode}
            onChange={handlePropertyChange}
          />
        )}
      </div>
    </div>
  );
}

export function MacroEditor({ actions, onChange }: MacroEditorProps) {
  return (
    <ReactFlowProvider>
      <MacroEditorInner actions={actions} onChange={onChange} />
    </ReactFlowProvider>
  );
}
