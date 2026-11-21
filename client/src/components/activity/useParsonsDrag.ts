import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { autoScrollStep } from "./parsonsDrag";

// A mouse or pen press turns into a drag once it moves this far.
const MOUSE_DRAG_PX = 5;
// A finger picks a block up by resting on it this long without moving more
// than TOUCH_SLOP_PX. Moving sooner means the student is scrolling.
const TOUCH_HOLD_MS = 200;
const TOUCH_SLOP_PX = 8;

// Where a block was grabbed, measured as the drag starts.
export interface Grab {
  // The block's box on screen.
  rect: DOMRect;
  // The pointer's distance from the box's top left corner.
  offsetX: number;
  offsetY: number;
  // Where the pointer is now.
  x: number;
  y: number;
  // The block's font size, for a ghost drawn outside the widget.
  fontSize: string;
}

// What the widget does as a drag goes along.
export interface PointerDragHandlers<T> {
  // The press became a drag. Returning false turns it down.
  onStart: (item: T, grab: Grab) => boolean;
  // The pointer moved, or the page scrolled under it. At most once a frame.
  onMove: (x: number, y: number, ghostLeft: number) => void;
  onDrop: () => void;
  onCancel: () => void;
}

// The body's inline styles from before a drag, put back when it ends.
interface SavedBodyStyle {
  userSelect: string;
  webkitUserSelect: string;
  cursor: string;
}

// One press, from pointerdown until it ends as a drop, a click or a scroll.
interface Session<T> {
  item: T;
  element: HTMLElement;
  pointerId: number;
  touch: boolean;
  dragging: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  holdTimer: number | null;
  frame: number | null;
  scroller: HTMLElement | null;
  body: SavedBodyStyle | null;
}

// Drags blocks with Pointer Events, so mouse, pen and touch all work. The
// widget passes each press on a block to press(). The ghost element (ghostRef)
// is moved directly, once a frame, and the widget only hears about the
// pointer through onMove, so it can re-render just when the drop target
// changes. Near the top or bottom edge the page scrolls by itself.
export function useParsonsDrag<T>(handlers: PointerDragHandlers<T>, rootRef: RefObject<HTMLElement>) {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const ghostRef = useRef<HTMLDivElement>(null);
  const [engine] = useState(() => createDragEngine(handlersRef, ghostRef, rootRef));
  useEffect(() => engine.mount(), [engine]);
  return { ghostRef, press: engine.press, stop: engine.stop };
}

// The drag engine itself, outside React: one press at a time, tracked with
// listeners on window that live only as long as the press.
function createDragEngine<T>(
  handlers: { readonly current: PointerDragHandlers<T> },
  ghost: RefObject<HTMLElement>,
  root: RefObject<HTMLElement>
) {
  let session: Session<T> | null = null;

  // Starts watching a press on a block (the main button of the primary pointer).
  function press(event: ReactPointerEvent, element: HTMLElement, item: T) {
    if (session || !event.isPrimary || event.button !== 0) return;
    const touch = event.pointerType === "touch";
    session = {
      item,
      element,
      pointerId: event.pointerId,
      touch,
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: 0,
      offsetY: 0,
      holdTimer: touch ? window.setTimeout(begin, TOUCH_HOLD_MS) : null,
      frame: null,
      scroller: null,
      body: null,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", cancel);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  }

  // Turns the press into a drag: measures the block and tells the widget.
  function begin() {
    const s = session;
    if (!s || s.dragging) return;
    clearHold(s);
    if (!s.element.isConnected) return end();
    const rect = s.element.getBoundingClientRect();
    const grab: Grab = {
      rect,
      offsetX: s.startX - rect.left,
      offsetY: s.startY - rect.top,
      x: s.x,
      y: s.y,
      fontSize: getComputedStyle(s.element).fontSize,
    };
    if (!handlers.current.onStart(s.item, grab)) return end();
    s.dragging = true;
    s.offsetX = grab.offsetX;
    s.offsetY = grab.offsetY;
    s.scroller = scrollParent(root.current);
    s.body = lockBody();
    schedule();
  }

  // Follows the pointer. Before the drag starts it decides between a drag, a
  // click and (for touch) a scroll.
  function onPointerMove(event: PointerEvent) {
    const s = session;
    if (!s || event.pointerId !== s.pointerId) return;
    s.x = event.clientX;
    s.y = event.clientY;
    // A mouse button let go outside the window: finish as if it came up here.
    if (!s.touch && event.buttons === 0) return s.dragging ? drop() : end();
    if (!s.dragging) {
      const moved = Math.hypot(s.x - s.startX, s.y - s.startY);
      if (s.touch) {
        if (moved > TOUCH_SLOP_PX) end();
      } else if (moved >= MOUSE_DRAG_PX) {
        begin();
      }
      return;
    }
    schedule();
  }

  // Drops the block, or ends a press that never became a drag (a click or a tap).
  function onPointerUp(event: PointerEvent) {
    const s = session;
    if (!s || event.pointerId !== s.pointerId) return;
    s.x = event.clientX;
    s.y = event.clientY;
    if (s.dragging) drop();
    else end();
  }

  // The browser took the pointer over, usually to scroll.
  function onPointerCancel(event: PointerEvent) {
    if (session && event.pointerId === session.pointerId) cancel();
  }

  // Escape cancels the drag.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !session) return;
    if (session.dragging) event.preventDefault();
    cancel();
  }

  // A long press on a touch screen would open the context menu.
  function onContextMenu(event: Event) {
    if (session?.touch) event.preventDefault();
  }

  // Blocks move under the pointer when anything scrolls, so the target is worked out again.
  function onScroll() {
    if (session?.dragging) schedule();
  }

  // Asks for a frame to move the ghost, scroll, and update the target in.
  function schedule() {
    const s = session;
    if (s && s.frame === null) s.frame = requestAnimationFrame(tick);
  }

  // One frame of a drag.
  function tick() {
    const s = session;
    if (!s || !s.dragging) return;
    s.frame = null;
    const left = s.x - s.offsetX;
    const node = ghost.current;
    if (node) node.style.transform = `translate3d(${left}px, ${s.y - s.offsetY}px, 0)`;
    const scrolled = autoScroll(s);
    handlers.current.onMove(s.x, s.y, left);
    // Keep scrolling while the pointer rests near the edge.
    if (scrolled && session === s) schedule();
  }

  // Scrolls the nearest scrolling area (or the page) when the pointer is near
  // its top or bottom edge. Returns whether anything scrolled.
  function autoScroll(s: Session<T>): boolean {
    const area = s.scroller ?? document.scrollingElement ?? document.documentElement;
    const rect = s.scroller?.getBoundingClientRect();
    const top = rect ? Math.max(rect.top, 0) : 0;
    const bottom = rect ? Math.min(rect.bottom, window.innerHeight) : window.innerHeight;
    const step = autoScrollStep(s.y, top, bottom);
    if (step === 0) return false;
    const before = area.scrollTop;
    area.scrollTop = before + step;
    return area.scrollTop !== before;
  }

  // Finishes a drag where the pointer is now.
  function drop() {
    const s = session;
    if (!s) return;
    handlers.current.onMove(s.x, s.y, s.x - s.offsetX);
    end();
    handlers.current.onDrop();
  }

  // Stops a press. A drag that was under way is cancelled, with no change.
  function cancel() {
    const s = session;
    if (!s) return;
    end();
    if (s.dragging) handlers.current.onCancel();
  }

  // Forgets the press and undoes everything it set up: listeners, the hold
  // timer, the next frame and the body's styles. Calls nothing back.
  function end() {
    const s = session;
    if (!s) return;
    session = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("scroll", onScroll, { capture: true });
    clearHold(s);
    if (s.frame !== null) cancelAnimationFrame(s.frame);
    if (s.body) unlockBody(s.body);
  }

  // Stops a touch from scrolling the page while it drags a block. It must be
  // listening before the touch starts (iOS decides then), so it is added when
  // the widget mounts, but it only blocks during a drag.
  function blockTouchScroll(event: TouchEvent) {
    if (session?.dragging && event.cancelable) event.preventDefault();
  }

  // Sets up the touch listener; the returned cleanup removes it and ends any press.
  function mount() {
    window.addEventListener("touchmove", blockTouchScroll, { passive: false });
    return () => {
      window.removeEventListener("touchmove", blockTouchScroll);
      end();
    };
  }

  return { press, stop: end, mount };
}

// Stops waiting for a touch to rest on a block.
function clearHold(session: { holdTimer: number | null }) {
  if (session.holdTimer !== null) window.clearTimeout(session.holdTimer);
  session.holdTimer = null;
}

// The nearest element around start that really scrolls up and down, or null
// for the page itself.
function scrollParent(start: HTMLElement | null): HTMLElement | null {
  for (let element = start; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element);
    const scrolls = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (scrolls && element.scrollHeight > element.clientHeight) return element;
  }
  return null;
}

// While dragging, text can't be selected and the cursor is a closed hand everywhere.
function lockBody(): SavedBodyStyle {
  const style = document.body.style;
  const saved = {
    userSelect: style.userSelect,
    webkitUserSelect: style.getPropertyValue("-webkit-user-select"),
    cursor: style.cursor,
  };
  style.setProperty("-webkit-user-select", "none");
  style.userSelect = "none";
  style.cursor = "grabbing";
  return saved;
}

// Puts the body's styles back as they were before the drag.
function unlockBody(saved: SavedBodyStyle) {
  const style = document.body.style;
  style.setProperty("-webkit-user-select", saved.webkitUserSelect);
  style.userSelect = saved.userSelect;
  style.cursor = saved.cursor;
}
