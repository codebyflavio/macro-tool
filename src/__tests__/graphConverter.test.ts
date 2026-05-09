import { describe, it, expect } from 'vitest';
import { actionsToGraph, graphToActions } from '../editor/graphConverter';
import type { MacroAction, ClickAction, MoveRelativeAction, WaitAction } from '../types/macro';

describe('graphConverter', () => {
  describe('actionsToGraph', () => {
    it('returns empty nodes and edges for empty actions', () => {
      const { nodes, edges } = actionsToGraph([]);
      expect(nodes).toHaveLength(0);
      expect(edges).toHaveLength(0);
    });

    it('creates one node per action', () => {
      const actions: MacroAction[] = [
        { type: 'wait', duration: 500, timestamp: 1 },
        { type: 'wait', duration: 1000, timestamp: 2 },
      ];
      const { nodes } = actionsToGraph(actions);
      expect(nodes).toHaveLength(2);
    });

    it('creates N-1 edges for N actions', () => {
      const actions: MacroAction[] = [
        { type: 'wait', duration: 100, timestamp: 1 },
        { type: 'wait', duration: 200, timestamp: 2 },
        { type: 'wait', duration: 300, timestamp: 3 },
      ];
      const { edges } = actionsToGraph(actions);
      expect(edges).toHaveLength(2);
    });

    it('sets node type from action type', () => {
      const actions: MacroAction[] = [
        {
          type: 'click',
          x: 10,
          y: 20,
          button: 'left',
          double: false,
          timestamp: 1,
        },
      ];
      const { nodes } = actionsToGraph(actions);
      expect(nodes[0].type).toBe('click');
    });

    it('positions nodes vertically', () => {
      const actions: MacroAction[] = [
        { type: 'wait', duration: 100, timestamp: 1 },
        { type: 'wait', duration: 200, timestamp: 2 },
      ];
      const { nodes } = actionsToGraph(actions);
      expect(nodes[0].position.y).toBeLessThan(nodes[1].position.y);
    });

    it('stores all action fields in node data', () => {
      const action: ClickAction = {
        type: 'click',
        x: 42,
        y: 99,
        button: 'right',
        double: true,
        timestamp: 100,
      };
      const { nodes } = actionsToGraph([action]);
      const data = nodes[0].data as Record<string, unknown>;
      expect(data['x']).toBe(42);
      expect(data['y']).toBe(99);
      expect(data['button']).toBe('right');
      expect(data['double']).toBe(true);
    });
  });

  describe('graphToActions', () => {
    it('returns empty array for empty nodes', () => {
      const actions = graphToActions([], []);
      expect(actions).toHaveLength(0);
    });

    it('roundtrips a single click action', () => {
      const original: MacroAction[] = [
        {
          type: 'click',
          x: 10,
          y: 20,
          button: 'left',
          double: false,
          timestamp: 1,
        },
      ];
      const { nodes, edges } = actionsToGraph(original);
      const result = graphToActions(nodes, edges);
      expect(result).toHaveLength(1);
      const click = result[0] as ClickAction;
      expect(click.type).toBe('click');
      expect(click.x).toBe(10);
      expect(click.y).toBe(20);
    });

    it('roundtrips a sequence of move + click + wait', () => {
      const original: MacroAction[] = [
        { type: 'move_relative', dx: 5, dy: 10, timestamp: 1 },
        { type: 'click', x: 50, y: 60, button: 'left', double: false, timestamp: 2 },
        { type: 'wait', duration: 500, timestamp: 3 },
      ];
      const { nodes, edges } = actionsToGraph(original);
      const result = graphToActions(nodes, edges);
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('move_relative');
      expect(result[1].type).toBe('click');
      expect(result[2].type).toBe('wait');
    });

    it('preserves order through graph roundtrip', () => {
      const types: MacroAction['type'][] = [
        'wait',
        'click',
        'move_relative',
        'key_press',
        'wait',
      ];
      const original: MacroAction[] = types.map((t, i) => {
        if (t === 'wait') return { type: 'wait', duration: i * 100, timestamp: i } as WaitAction;
        if (t === 'click') return { type: 'click', x: i, y: i, button: 'left' as const, double: false, timestamp: i } as ClickAction;
        if (t === 'move_relative') return { type: 'move_relative', dx: i, dy: i, timestamp: i } as MoveRelativeAction;
        return { type: 'key_press', key: 'a', code: 'KeyA', modifiers: { ctrl: false, shift: false, alt: false, meta: false }, timestamp: i };
      });

      const { nodes, edges } = actionsToGraph(original);
      const result = graphToActions(nodes, edges);
      expect(result).toHaveLength(original.length);
      result.forEach((action, i) => {
        expect(action.type).toBe(original[i].type);
      });
    });

    it('preserves move_relative dx/dy values', () => {
      const original: MacroAction[] = [
        { type: 'move_relative', dx: 42, dy: -7, timestamp: 1 },
      ];
      const { nodes, edges } = actionsToGraph(original);
      const result = graphToActions(nodes, edges);
      const move = result[0] as MoveRelativeAction;
      expect(move.dx).toBe(42);
      expect(move.dy).toBe(-7);
    });

    it('preserves wait duration values', () => {
      const original: MacroAction[] = [
        { type: 'wait', duration: 1234, timestamp: 1 },
        { type: 'wait', duration: 5678, timestamp: 2 },
      ];
      const { nodes, edges } = actionsToGraph(original);
      const result = graphToActions(nodes, edges);
      expect((result[0] as WaitAction).duration).toBe(1234);
      expect((result[1] as WaitAction).duration).toBe(5678);
    });

    it('links edges correctly between nodes', () => {
      const original: MacroAction[] = [
        { type: 'wait', duration: 100, timestamp: 1 },
        { type: 'wait', duration: 200, timestamp: 2 },
      ];
      const { nodes, edges } = actionsToGraph(original);
      expect(edges[0].source).toBe(nodes[0].id);
      expect(edges[0].target).toBe(nodes[1].id);
    });
  });
});
