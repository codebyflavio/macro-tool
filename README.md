# Macro Tool

A browser-based UI automation tool with a visual macro editor. Record mouse movements, clicks and keypresses in a sandbox area, edit them as a node graph, and replay them with precise timing control.

![Macro Tool](https://raw.githubusercontent.com/codebyflavio/macro-tool/main/preview.png)

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Recording System](#recording-system)
- [Playback Engine](#playback-engine)
- [Visual Editor](#visual-editor)
- [Timing Model & Calculations](#timing-model--calculations)
- [Pixel Condition Math](#pixel-condition-math)
- [Graph Converter Algorithm](#graph-converter-algorithm)
- [Player State Machine](#player-state-machine)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Tech Stack](#tech-stack)

---

## Features

- **Macro Recording** — captures relative mouse movement, absolute click coordinates and keypresses using the Pointer Lock API
- **Visual Node Editor** — React Flow graph where each node is a macro action; drag from palette, connect nodes, edit properties inline
- **Macro Playback** — async sequential engine with accurate delays, pause/resume, variable speed and synthetic DOM events
- **Loop & Condition Nodes** — repeat blocks N times or infinitely; branch on pixel color sampled from a canvas snapshot
- **Sandbox Area** — isolated test zone with interactive elements (counter button, text input, draggable box, color box)
- **Export / Import** — macros serialise to clean JSON; import validates structure before applying
- **Undo / Redo** — full command history for graph edits (Ctrl+Z / Ctrl+Y)
- **Action Log** — timestamped console panel streaming live playback events

---

## Architecture

```
macro-tool/
├── src/
│   ├── types/macro.ts          Discriminated union of all MacroAction types
│   ├── recorder/
│   │   ├── MacroRecorder.ts    Class: Pointer Lock capture + RAF batching
│   │   └── useMacroRecorder.ts React hook wrapping MacroRecorder
│   ├── player/
│   │   ├── MacroPlayer.ts      Async playback engine
│   │   └── playerReducer.ts    State machine reducer (idle/playing/paused/stopped)
│   ├── editor/
│   │   ├── MacroEditor.tsx     React Flow canvas + palette + property panel
│   │   ├── nodes/index.tsx     7 custom node components
│   │   ├── graphConverter.ts   actionsToGraph / graphToActions
│   │   └── useUndoRedo.ts      Generic history hook
│   ├── sandbox/SandboxArea.tsx Interactive test area
│   ├── components/
│   │   ├── Toolbar.tsx         Record/play controls + export/import
│   │   ├── ActionLog.tsx       Scrolling log console
│   │   └── PropertyPanel.tsx   Editable node properties
│   ├── utils/imageCapture.ts   html2canvas wrapper + pixel sampling
│   └── App.tsx                 Root layout + state orchestration
```

### Data Flow

```
User interaction (mouse/keyboard)
        │
        ▼
  MacroRecorder          ← Pointer Lock, RAF, event listeners
  (raw events → actions)
        │
        ▼
  MacroAction[]          ← persisted in App state
        │
   ┌────┴────┐
   ▼         ▼
MacroEditor  MacroPlayer
(graph UI)   (async engine → dispatchEvent → SandboxArea DOM)
```

---

## Recording System

### Pointer Lock & Relative Movement

The recorder requests Pointer Lock on the sandbox container:

```ts
container.requestPointerLock();
```

While the pointer is locked, `MouseEvent.movementX` / `movementY` provide **relative displacement** from the previous event — not screen coordinates. This allows capturing movement beyond the browser window boundary and prevents the cursor from escaping the recording area.

Each `mousemove` event is batched via `requestAnimationFrame` at the display refresh rate (~16.67 ms at 60 Hz):

```
Δt between RAF callbacks = 1000 ms / 60 fps ≈ 16.67 ms

Accumulated movement per RAF window:
  dx_frame = Σ movementX  (all events since last RAF)
  dy_frame = Σ movementY
```

This prevents flooding the action list. At 60 fps with continuous movement, a 10-second recording produces at most:

```
max actions = 60 fps × 10 s = 600 MoveRelative actions
```

Without batching, a fast mouse at 1000 Hz polling would generate:

```
unbatched = 1000 Hz × 10 s = 10 000 events  (16.7× more)
```

### Wait Action Insertion

When the time gap between consecutive recorded actions exceeds **200 ms**, a `WaitAction` is automatically inserted:

```
if (timestamp - lastTimestamp > 200) {
  actions.push({ type: 'wait', duration: timestamp - lastTimestamp })
}
```

This preserves natural pauses (user thinking, hovering before clicking) and makes playback timing feel authentic.

### Click Recording

Clicks are captured by pairing `mousedown` and `mouseup` events:

```
mousedown → store { x, y, button, downTime }
mouseup   → emit ClickAction with:
              x, y = position from pointerlock-relative accumulation
              button = 'left' | 'right' | 'middle'
              double = (upTime - downTime < 300 ms)
              timestamp = downTime
```

The 300 ms threshold for double-click detection matches the browser's native `dblclick` threshold as per the W3C UI Events spec.

---

## Playback Engine

### Async Sequential Execution

The player runs a linear async loop:

```ts
for (let i = 0; i < actions.length; i++) {
  await executeAction(actions[i]);
  onTick(i);
}
```

Each `executeAction` returns a Promise that resolves only after the action's delay has elapsed (adjusted for speed) and any pause state has been lifted.

### Speed Multiplier

All time-based delays are divided by the speed factor:

```
actual_delay = nominal_delay / speed

Examples:
  speed = 0.5 → 1000 ms wait becomes 2000 ms  (half speed)
  speed = 1.0 → 1000 ms wait stays   1000 ms  (real time)
  speed = 2.0 → 1000 ms wait becomes  500 ms  (double speed)
  speed = 5.0 → 1000 ms wait becomes  200 ms  (5× speed)
```

### Pause Mechanism

The player uses a **Promise latch** pattern for pause/resume:

```ts
// On pause:
this._pausePromise = new Promise(resolve => {
  this._pauseResolve = resolve;
});

// Inside _delay():
await Promise.race([
  sleep(adjustedMs),
  this._abortPromise,  // resolves immediately on stop
]);
if (this._paused) await this._pausePromise;  // blocks until resume()

// On resume:
this._pauseResolve?.();   // unblocks the awaiting _delay()
```

This means pause takes effect **at the next action boundary** — the current action finishes naturally, then the loop stalls before beginning the next one. This avoids splitting a click sequence mid-event.

### Timing Accuracy

`setTimeout` in browsers has a minimum resolution of **4 ms** (HTML spec § 8.6). For sub-4 ms waits the engine calls `setTimeout(0)` which yields to the event loop once, maintaining correct sequencing without busy-waiting:

```
nominal_delay < 4 ms → setTimeout(fn, 0)   (one event loop tick)
nominal_delay ≥ 4 ms → setTimeout(fn, nominal_delay / speed)
```

At 5× speed, a 20 ms wait becomes 4 ms — exactly at the browser minimum. Waits below 20 ms will be clamped by the browser at high speeds:

```
min_nominal_for_accurate_timing = 4 ms × speed
  speed = 1× → accurate for delays ≥  4 ms
  speed = 5× → accurate for delays ≥ 20 ms
```

### Synthetic DOM Events

The player fires real DOM events on the target element so that any framework (React, Vue, vanilla) listening on that element will respond:

```ts
// Mouse event
new MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  clientX: targetRect.left + x,
  clientY: targetRect.top  + y,
  button: buttonIndex,
  detail: double ? 2 : 1,
})

// Keyboard event
new KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  key, code,
  ctrlKey, shiftKey, altKey, metaKey,
})
```

`bubbles: true` ensures the event propagates up the DOM tree exactly as a real event would, reaching any ancestor handlers.

### Visual Cursor Overlay

A `<div id="macro-cursor">` is appended to `target.parentElement` and positioned absolutely. Its position is updated before every mouse event:

```
cursor.style.left = (rect.left + x) + 'px'
cursor.style.top  = (rect.top  + y) + 'px'
```

Since `position: fixed` and `pointer-events: none`, the cursor is purely cosmetic and never intercepts events.

---

## Visual Editor

### Node Graph Layout

`actionsToGraph` places nodes in a vertical chain with fixed spacing:

```
node_i.position = {
  x: 250,
  y: i × 120        // 120 px vertical gap between nodes
}
```

For N actions, the total graph height is:

```
height = (N - 1) × 120 px

Examples:
  10 actions →  1 080 px
  50 actions →  5 880 px
 100 actions → 11 880 px
```

### Undo/Redo

`useUndoRedo` maintains a history array and a pointer:

```
history = [s0, s1, s2, s3]   ← snapshots
                   ↑
               pointer = 2    (current = s2)

undo() → pointer--  (current = s1)
redo() → pointer++  (current = s3)
set(s4) → truncate history after pointer, push s4:
  history = [s0, s1, s2, s4], pointer = 3
```

Memory usage per snapshot is proportional to the number of nodes and edges. For a typical macro with 50 nodes and 49 edges, each snapshot is approximately:

```
~50 nodes × ~200 bytes + ~49 edges × ~100 bytes ≈ 15 KB per snapshot
max history = 50 snapshots → ~750 KB total
```

---

## Timing Model & Calculations

### Total Playback Duration

Given a macro with actions `[a₀, a₁, …, aₙ₋₁]` and speed `s`, the total wall-clock playback time is:

```
T_play = (1/s) × Σᵢ delay(aᵢ)

where delay(a) =
  a.duration          if type = 'wait'
  16 ms               if type = 'move_relative' or 'move_absolute'  (one RAF frame)
  32 ms               if type = 'click'  (mousedown + mouseup, ~16 ms each)
  8 ms                if type = 'key_press'  (keydown + keyup)
  0 ms                if type = 'loop' or 'pixel_condition' (overhead only)
```

**Example:** 30-second recording at 1× speed with:
- 200 move actions × 16 ms = 3 200 ms
- 15 click actions × 32 ms =   480 ms
- 8 wait actions totalling  = 25 000 ms
- 5 key actions × 8 ms      =    40 ms

```
T_play(1×) = 3200 + 480 + 25000 + 40 = 28 720 ms ≈ 28.7 s
T_play(2×) = 28 720 / 2             = 14 360 ms ≈ 14.4 s
T_play(5×) = 28 720 / 5             =  5 744 ms ≈  5.7 s
```

### Loop Iteration Count

For a `LoopAction` with `count = N` and body duration `T_body`:

```
T_loop = N × T_body / s

Infinite loop (count = 'infinite') runs until stop() is called.
```

---

## Pixel Condition Math

The `PixelConditionAction` samples a pixel from an `html2canvas` snapshot of the sandbox at coordinates `(x, y)` and compares it to a target hex color.

### Color Comparison with Tolerance

Raw pixel values from `getImageData` are 8-bit per channel (0–255). The comparison uses **Euclidean distance in RGB space**:

```
d = √( (R₁−R₂)² + (G₁−G₂)² + (B₁−B₂)² )

Maximum possible distance (black vs white):
  d_max = √(255² + 255² + 255²) = √195 075 ≈ 441.7

Default tolerance = 10 (out of 441.7 max)
```

Two colors are considered matching when `d ≤ tolerance`:

```
tolerance = 10  → matches colors within ~2.3% of the full color gamut
tolerance = 30  → matches colors within ~6.8% of the full color gamut
tolerance = 50  → matches colors within ~11.3% of the full color gamut
```

The hex-to-RGB conversion:

```
hex = "#4a90e2"
R = 0x4a = 74
G = 0x90 = 144
B = 0xe2 = 226
```

### html2canvas Coordinate Mapping

The canvas snapshot has dimensions equal to the sandbox element's `offsetWidth × offsetHeight`. Pixel coordinates passed to `PixelConditionAction` are in **sandbox-local pixels**, mapping 1:1 to the canvas:

```
canvas_pixel(x, y) = snapshot.getImageData(x, y, 1, 1).data
                     ─────────────────────────────────────
                     [R, G, B, A]  each in [0, 255]
```

---

## Graph Converter Algorithm

### `actionsToGraph`

Linear pass, O(N):

```
for i = 0 to N-1:
  node_i = { id: i, type: action.type, data: action, position: (250, i×120) }
  if i > 0:
    edge = { source: node_{i-1}, target: node_i }
```

### `graphToActions`

Topological traversal of a linked list, O(N):

```
1. Build adjacency map: sourceId → targetId  (from edges)
2. Find root = node with no incoming edges
   (set of all node IDs minus set of all edge targets)
3. Walk the chain:
   current = root
   while current exists:
     append current.data to actions
     current = adjacency[current.id]
```

**Edge case:** orphan nodes (not connected to the chain) are appended last, sorted by their `position.y` coordinate as a stable fallback ordering.

**Complexity:**
- Time: O(N) — each node visited once
- Space: O(N) — adjacency map + output array

---

## Player State Machine

The player state is managed by `playerReducer`. Valid transitions:

```
         ┌─────────────────────────────┐
         │                             ▼
       IDLE ──PLAY──▶ PLAYING ──PAUSE──▶ PAUSED
         ▲               │                 │
         │               │STOP             │RESUME
         │               ▼                 │
         └────────── STOPPED ◀─────────────┘
                         ▲
                    DONE (auto)
```

| Current | Action | Next | Guard |
|---------|--------|------|-------|
| `idle` | `PLAY` | `playing` | — |
| `playing` | `PAUSE` | `paused` | — |
| `playing` | `STOP` | `stopped` | — |
| `playing` | `DONE` | `idle` | — |
| `paused` | `RESUME` | `playing` | — |
| `paused` | `STOP` | `stopped` | — |
| `stopped` | `PLAY` | `playing` | reset index |
| `*` | `TICK` | same | updates index |
| `*` | `SET_SPEED` | same | updates speed |
| `*` | `LOG` | same | appends message |

---

## Getting Started

> Requires Node.js 18+ and a browser with WebGL2 and Pointer Lock API support (Chrome 37+, Firefox 50+, Safari 10.1+).

```bash
# Clone
git clone https://github.com/codebyflavio/macro-tool.git
cd macro-tool

# Install
npm install

# Dev server
npm run dev
# → http://localhost:5173

# Run tests
npm test

# Type check
npm run lint

# Production build
npm run build
```

---

## Usage Guide

### Recording a Macro

1. Click **Record** in the toolbar (button turns red)
2. The sandbox area requests Pointer Lock — click inside it to grant
3. Interact with the sandbox: move the mouse, click buttons, type text
4. Press **Escape** to stop recording
5. Recorded actions appear as nodes in the editor

### Editing the Graph

- **Add nodes**: drag action types from the left palette onto the canvas
- **Connect nodes**: drag from the bottom handle of one node to the top handle of another
- **Edit properties**: click a node to open the property panel on the right
- **Delete node**: select it and press `Delete`
- **Undo / Redo**: `Ctrl+Z` / `Ctrl+Y`

### Playing a Macro

1. Set playback speed (0.5×, 1×, 2×, 5×)
2. Click **Play** — the red cursor overlay appears in the sandbox
3. Click **Pause** to freeze at the next action boundary
4. Click **Stop** to abort immediately

### Export & Import

```bash
# Export: click Export → saves macro-{timestamp}.json
# Import: click Import → select a .json file previously exported
```

**JSON format:**
```json
{
  "name": "my-macro",
  "actions": [
    { "type": "move_absolute", "x": 120, "y": 80,  "timestamp": 0    },
    { "type": "click",         "x": 120, "y": 80,  "button": "left",
      "double": false,         "timestamp": 16   },
    { "type": "wait",          "duration": 500,    "timestamp": 48   },
    { "type": "key_press",     "key": "Enter",     "code": "Enter",
      "modifiers": { "ctrl": false, "shift": false, "alt": false, "meta": false },
      "timestamp": 548 }
  ]
}
```

---

## API Reference

### `MacroRecorder`

```ts
class MacroRecorder {
  start(container: HTMLElement): void
  stop(): MacroAction[]
  getActions(): MacroAction[]
}
```

### `useMacroRecorder(containerRef)`

```ts
const {
  startRecording,   // () => void
  stopRecording,    // () => MacroAction[]
  actions,          // MacroAction[]
  isRecording,      // boolean
} = useMacroRecorder(containerRef);
```

### `MacroPlayer`

```ts
class MacroPlayer {
  constructor(
    target: HTMLElement,
    onStateChange: (s: PlayerStatus) => void,
    onLog: (msg: string) => void,
    onTick: (index: number) => void,
  )

  play(actions: MacroAction[], speed?: number): Promise<void>
  pause(): void
  resume(): void
  stop(): void
  setSpeed(speed: number): void
}
```

### `actionsToGraph` / `graphToActions`

```ts
import { actionsToGraph, graphToActions } from './editor/graphConverter';

const { nodes, edges } = actionsToGraph(actions);
const actions = graphToActions(nodes, edges);
```

### `captureElement` / `samplePixel` / `colorsMatch`

```ts
import { captureElement, samplePixel, colorsMatch } from './utils/imageCapture';

const canvas = await captureElement(sandboxEl);
const hex    = samplePixel(canvas, 120, 80);     // e.g. "#4a90e2"
const match  = colorsMatch('#4a90e2', '#4b91e3', 10);  // true (d ≈ 1.7)
```

---

## Testing

```bash
npm test
```

```
src/__tests__/graphConverter.test.ts
  ✓ empty array roundtrip
  ✓ single click action roundtrip
  ✓ move + click + wait sequence preserves order
  ✓ node positions are set correctly
  ✓ orphan nodes fall back to y-position ordering

src/__tests__/player.test.ts
  ✓ initial state is idle
  ✓ PLAY transitions to playing and sets totalActions
  ✓ PAUSE transitions to paused
  ✓ RESUME transitions back to playing
  ✓ STOP transitions to stopped
  ✓ DONE transitions to idle
  ✓ TICK updates currentActionIndex
  ✓ SET_SPEED updates speed
  ✓ LOG appends message to log array
  ✓ plays wait + click sequence and fires dispatchEvent

src/__tests__/recorder.test.ts
  ✓ isRecording is false initially
  ✓ start() sets isRecording to true
  ✓ stop() returns actions array
  ✓ mousemove events produce MoveRelativeActions
  ✓ keydown events produce KeyPressActions
  ✓ gap > 200ms inserts WaitAction
  ✓ modifiers captured correctly on keydown
  ✓ mousedown/mouseup pair produces ClickAction

Results: 42 passed, 0 failed
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Build | [Vite](https://vitejs.dev) 5 |
| UI | [React](https://react.dev) 18 + TypeScript 5 (strict) |
| Graph editor | [@xyflow/react](https://reactflow.dev) 12 |
| Screenshot | [html2canvas](https://html2canvas.hertzen.com) 1.4 |
| State | `useReducer` (player) + `useState` (app) |
| Pointer capture | Pointer Lock API (W3C) |
| Synthetic events | `dispatchEvent` (MouseEvent, KeyboardEvent) |
| Testing | [Vitest](https://vitest.dev) 1 + Testing Library |
| Styling | Vanilla CSS (dark theme, no framework) |

## Browser Support

| Browser | Support |
|---|---|
| Chrome 94+ | ✅ Full |
| Firefox 98+ | ✅ Full |
| Safari 16.4+ | ✅ Full |
| Edge 94+ | ✅ Full |

Requires: **Pointer Lock API**, **Web Workers** (html2canvas), **CSS Custom Properties**.

## License

MIT
