import type { Node, Edge } from '@xyflow/react';
import type { MacroAction } from '../types/macro';

const NODE_X = 250;
const NODE_Y_STEP = 120;

export function actionsToGraph(actions: MacroAction[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = actions.map((action, i) => ({
    id: `node-${i}`,
    type: action.type,
    position: { x: NODE_X, y: i * NODE_Y_STEP + 50 },
    data: { ...action },
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}-${i + 1}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
      sourceHandle: 'out',
      targetHandle: 'in',
    });
  }

  return { nodes, edges };
}

export function graphToActions(nodes: Node[], edges: Edge[]): MacroAction[] {
  if (nodes.length === 0) return [];

  // Build adjacency: outgoing edges per node
  const outgoing = new Map<string, string>();
  const hasIncoming = new Set<string>();

  for (const edge of edges) {
    outgoing.set(edge.source, edge.target);
    hasIncoming.add(edge.target);
  }

  // Find root node (no incoming edges)
  const rootCandidates = nodes.filter((n) => !hasIncoming.has(n.id));

  // If no root found, fall back to node order by position
  if (rootCandidates.length === 0) {
    return nodes
      .slice()
      .sort((a, b) => a.position.y - b.position.y)
      .map((n) => n.data as unknown as MacroAction);
  }

  // Pick the root with the lowest y position
  rootCandidates.sort((a, b) => a.position.y - b.position.y);
  const root = rootCandidates[0];

  // Traverse linked list
  const result: MacroAction[] = [];
  const visited = new Set<string>();
  let current: string | undefined = root.id;

  while (current && !visited.has(current)) {
    visited.add(current);
    const node = nodes.find((n) => n.id === current);
    if (node) {
      result.push(node.data as unknown as MacroAction);
    }
    current = outgoing.get(current);
  }

  // Add any orphan nodes not in the chain (sorted by y)
  const orphans = nodes
    .filter((n) => !visited.has(n.id))
    .sort((a, b) => a.position.y - b.position.y);

  for (const orphan of orphans) {
    result.push(orphan.data as unknown as MacroAction);
  }

  return result;
}
