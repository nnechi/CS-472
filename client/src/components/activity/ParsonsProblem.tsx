import {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ListIndentDecrease, ListIndentIncrease, LucideIcon, Plus, Undo2 } from "lucide-react";
import { AnswerFeedback, ParsonsDisplayOptions, ParsonsLine } from "../../types";
import LineBox, { ANSWER_FRAME_STYLE, LineState, TRASH_FRAME_STYLE, lineStates } from "./LineBox";
import {
  Block,
  BlockAction,
  DragSource,
  DropTarget,
  MAX_INDENT_PX,
  addToAnswer,
  applyDrop,
  blockAction,
  clamp,
  dropIndent,
  dropIndex,
  indentOffsetPx,
  listRows,
  matchLines,
  maxIndentLevel,
  placeBlock,
  returnedId,
  sameAnswer,
  sameLines,
  sameTarget,
  stepIndent,
  toBlocks,
  trashGapIndex,
} from "./parsonsDrag";
import { Grab, useParsonsDrag } from "./useParsonsDrag";

interface ParsonsProblemProps {
  // Every line the student can use: the solution's lines and any extra lines, shuffled.
  lines: string[];
  // The student's answer, top to bottom, with each line's indent level.
  answer: ParsonsLine[];
  options: ParsonsDisplayOptions;
  // null until the student checks, then whether the answer is right.
  result: boolean | null;
  feedback: AnswerFeedback | null;
  onChange: (answer: ParsonsLine[]) => void;
  onCheck: () => void;
  onReset: () => void;
}

// The two lists: the trash ("Drag from here") and the answer ("Construct your solution here").
type ListName = "trash" | "answer";

// The parts of a block that can hold focus: its handle and its toolbar buttons.
type Control = "handle" | "add" | BlockAction;

// Where focus goes after the next render: a block by its place in a list, and which part of it.
interface FocusSpot {
  list: ListName;
  index: number;
  control: Control;
}

// The block a press or key is about: its list, id and place in the list.
interface Pressed {
  list: ListName;
  id: string;
  position: number;
}

// The ghost's size and starting place, measured when a pointer drag starts.
interface GhostBox {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: string;
}

// A drag under way. "pointer" drags show a ghost and a gap where the block
// will land; "keyboard" holds move the block itself.
interface Drag {
  mode: "pointer" | "keyboard";
  // The block as it was picked up.
  block: Block;
  source: DragSource;
  target: DropTarget;
  ghost: GhostBox | null;
  // Whether the block had focus when it was picked up, so focus can follow it.
  hadFocus: boolean;
  // The lines and answer it started from. If they change, the drag is over.
  lines: string[];
  answer: ParsonsLine[];
}

// What a block calls back into the widget. One object that never changes, so
// blocks only re-render when their own props do.
interface BlockCallbacks {
  register: (id: string, part: Control | "box", element: HTMLElement | null) => void;
  pointerDown: (event: ReactPointerEvent<HTMLDivElement>, pressed: Pressed) => void;
  keyDown: (event: KeyboardEvent<HTMLDivElement>, pressed: Pressed) => void;
  blur: (event: FocusEvent<HTMLDivElement>, id: string) => void;
  toolbar: (control: Control, pressed: Pressed) => void;
}

const primaryButton =
  "rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100";
const toolButton =
  "inline-flex size-7 items-center justify-center rounded-md text-gray-800 cursor-pointer hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35";
const listLabel = "text-sm font-semibold text-gray-700";
const emptyHint = "p-2 text-sm text-gray-600";
// A ring around the whole block while its handle has keyboard focus.
const blockFocusRing =
  "has-[.parsons-handle:focus-visible]:outline-3 has-[.parsons-handle:focus-visible]:outline-offset-2 has-[.parsons-handle:focus-visible]:outline-brand";
// Keeps a long press from opening the iOS callout over a block.
const noCallout: CSSProperties = { WebkitTouchCallout: "none" };

// The Parsons problem, drawn and dragged the way js-parsons does it: blocks
// are dragged from the trash ("Drag from here") into the answer ("Construct
// your solution here"), reordered there, and indented by dragging sideways,
// with a mouse, a pen or a finger. Every block can also be picked up and
// moved from the keyboard, and a toolbar on each block does the same things
// with buttons.
export default function ParsonsProblem({
  lines,
  answer,
  options,
  result,
  feedback,
  onChange,
  onCheck,
  onReset,
}: ParsonsProblemProps) {
  const { requireDragging, canIndent, xIndent } = options;
  const maxIndent = maxIndentLevel(xIndent);
  const baseId = useId();
  const instructionsId = `${baseId}-instructions`;
  const trashLabelId = `${baseId}-trash`;
  const solutionLabelId = `${baseId}-solution`;

  const rootRef = useRef<HTMLDivElement>(null);
  const trashColumnRef = useRef<HTMLDivElement>(null);
  const solutionColumnRef = useRef<HTMLDivElement>(null);
  const solutionListRef = useRef<HTMLUListElement>(null);
  // Every block's box, handle and toolbar buttons, by block id.
  const elements = useRef(new Map<string, Partial<Record<Control | "box", HTMLElement>>>());
  // Where focus goes once the next render is on screen.
  const focusNext = useRef<FocusSpot[] | null>(null);
  // An element focus moved to, to give it back if a re-render took it away.
  const refocus = useRef<HTMLElement | null>(null);
  const blurCheck = useRef<number | null>(null);

  const [drag, setDragState] = useState<Drag | null>(null);
  // The same drag, for event listeners that run between renders.
  const dragRef = useRef<Drag | null>(null);
  // The last message for screen readers. The count makes a repeat read again.
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });

  // A drag only counts while the lines and answer are the ones it started from.
  const liveDrag = drag && sameLines(drag.lines, lines) && sameAnswer(drag.answer, answer) ? drag : null;
  const held = liveDrag?.mode === "keyboard" ? liveDrag : null;
  const pointer = liveDrag?.mode === "pointer" ? liveDrag : null;

  const blocks = useMemo(() => toBlocks(lines, answer), [lines, answer]);

  // What each list shows. A held block is drawn at the place it would be
  // dropped. A block dragged with the pointer stays in its list, hidden, and
  // a gap opens where it would land.
  let solutionBlocks = blocks.solution;
  let trashBlocks = requireDragging ? blocks.trash : [];
  if (held && held.target.list === "answer") {
    solutionBlocks = placeBlock(blocks.solution, { ...held.block, indent: held.target.indent }, held.target.index);
    trashBlocks = trashBlocks.filter((block) => block.id !== held.block.id);
  }
  const solution = listRows(
    solutionBlocks,
    pointer?.source.list === "answer" ? pointer.block.id : null,
    pointer?.target.list === "answer" ? pointer.target.index : null
  );
  const trash = listRows(
    trashBlocks,
    pointer?.source.list === "trash" ? pointer.block.id : null,
    pointer?.target.list === "trash" ? trashGapIndex(lines, answer, pointer.source, pointer.block.id) : null
  );
  const solutionIds = solution.rows.filter((row) => !row.hidden).map((row) => row.id);
  const trashIds = trash.rows.filter((row) => !row.hidden).map((row) => row.id);
  const gapIndent = pointer?.target.list === "answer" ? pointer.target.indent : 0;
  const gapHeight = pointer?.ghost?.height ?? 0;

  // The feedback colors. js-parsons clears them when a drag starts; if the
  // drop changes nothing they come back.
  const states = liveDrag ? null : lineStates(result, feedback?.marks ?? null, answer.length);
  const answerFrame = liveDrag ? "neutral" : result === true ? "correct" : result === false ? "incorrect" : "neutral";
  const showErrors = result === false && options.showFeedback && feedback !== null && feedback.errors.length > 0;

  // Keeps the drag in state for rendering and in the ref for listeners.
  function setDrag(next: Drag | null) {
    dragRef.current = next;
    setDragState(next);
  }

  // Tells screen readers what just happened.
  function announce(text: string) {
    if (text) setAnnouncement((previous) => ({ text, count: previous.count + 1 }));
  }

  // Asks for focus to move after the next render, to the first of these spots that exists.
  function focusAfterRender(...spots: FocusSpot[]) {
    focusNext.current = spots;
  }

  // Focuses one part of a block (its handle if that button is disabled) and
  // scrolls the block into view. Returns whether it found the block.
  function focusPart(id: string, control: Control): boolean {
    const found = elements.current.get(id);
    const handle = found?.handle;
    if (!found || !handle) return false;
    let element = found[control] ?? handle;
    if (element instanceof HTMLButtonElement && element.disabled) element = handle;
    // A toolbar only shows while focus is inside its block, and hidden buttons
    // can't take focus, so the handle goes first.
    if (element !== handle && getComputedStyle(element).visibility === "hidden") handle.focus({ preventScroll: true });
    element.focus({ preventScroll: true });
    (found.box ?? handle).scrollIntoView({ block: "nearest" });
    return true;
  }

  // The block a press or key is about, checked against the lists as they are
  // now, with where a drag of it comes from.
  function pick({ list, id, position }: Pressed): { block: Block; source: DragSource } | null {
    if (list === "trash") {
      const block = blocks.trash.find((other) => other.id === id);
      return block ? { block, source: { list: "trash", code: block.code } } : null;
    }
    const block = blocks.solution[position];
    return block && block.id === id ? { block, source: { list: "answer", index: position } } : null;
  }

  // Where a cancelled drag's block is back at.
  function homeSpot(current: Drag): FocusSpot {
    if (current.source.list === "answer") return { list: "answer", index: current.source.index, control: "handle" };
    return { list: "trash", index: blocks.trash.findIndex((block) => block.id === current.block.id), control: "handle" };
  }

  // Where a dropped block ends up, given the new answer (null if nothing changed).
  function landingSpots(current: Drag, next: ParsonsLine[] | null): FocusSpot[] {
    const { source, target } = current;
    if (target.list === "answer") return [{ list: "answer", index: target.index, control: "handle" }];
    if (source.list === "trash" || next === null) return [homeSpot(current)];
    const freed = returnedId(lines, answer, source.index);
    const index = freed === null ? -1 : matchLines(lines, next).trashIds.indexOf(freed);
    return [{ list: "trash", index, control: "handle" }];
  }

  // ", indent 2" when indenting is on.
  function indentText(indent: number): string {
    return canIndent ? `, indent ${indent}` : "";
  }

  // Ends the drag. A drop applies it (onChange runs only when the answer
  // changes); otherwise the block goes back where it was. Focus follows the
  // block when it had focus, unless the student moved focus elsewhere.
  function finishDrag(drop: boolean, restoreFocus = true) {
    const current = dragRef.current;
    if (!current) return;
    setDrag(null);
    pointerDrag.stop();
    const { block, source, target } = current;
    const followFocus = restoreFocus && (current.mode === "keyboard" || current.hadFocus);
    if (!drop) {
      if (followFocus) focusAfterRender(homeSpot(current));
      announce(`Cancelled. ${block.code} is back where it was.`);
      return;
    }
    const next = applyDrop(answer, source, target);
    if (followFocus) focusAfterRender(...landingSpots(current, next));
    if (next) onChange(next);
    if (target.list === "answer") {
      const count = (next ?? answer).length;
      announce(`Dropped ${block.code} on line ${target.index + 1} of ${count}${indentText(target.indent)}.`);
    } else if (source.list === "answer") {
      announce(`Sent ${block.code} back to the blocks to drag from.`);
    }
  }

  // Drops a drag without a word, when the lines or answer changed under it.
  function abandonDrag() {
    setDrag(null);
    pointerDrag.stop();
  }

  // A pointer drag starts: the block is hidden, a gap opens in its place, and
  // a ghost copy follows the pointer.
  function startPointerDrag(pressed: Pressed, grab: Grab): boolean {
    if (dragRef.current) return false;
    const picked = pick(pressed);
    if (!picked) return false;
    const box = elements.current.get(pressed.id)?.box;
    setDrag({
      mode: "pointer",
      ...picked,
      target:
        picked.source.list === "trash"
          ? { list: "trash" }
          : { list: "answer", index: pressed.position, indent: picked.block.indent },
      ghost: {
        left: grab.x - grab.offsetX,
        top: grab.y - grab.offsetY,
        width: grab.rect.width,
        height: grab.rect.height,
        fontSize: grab.fontSize,
      },
      hadFocus: !!box && box.contains(document.activeElement),
      lines,
      answer,
    });
    return true;
  }

  // The drop target under the pointer. Over the answer, the height picks the
  // place and the ghost's left edge the indent. Over the trash, the block goes
  // back to its own slot. Anywhere else the target stays as it was.
  function pointerTarget(current: Drag, x: number, y: number, ghostLeft: number): DropTarget {
    if (inside(solutionColumnRef.current, x, y)) {
      const middles = blocks.solution
        .filter((block) => block.id !== current.block.id)
        .flatMap((block) => {
          const box = elements.current.get(block.id)?.box;
          if (!box) return [];
          const rect = box.getBoundingClientRect();
          return [(rect.top + rect.bottom) / 2];
        });
      const list = solutionListRef.current;
      const indent = canIndent && list ? dropIndent(ghostLeft - contentLeft(list), xIndent, maxIndent) : 0;
      return { list: "answer", index: dropIndex(middles, y), indent };
    }
    if (requireDragging && inside(trashColumnRef.current, x, y)) return { list: "trash" };
    return current.target;
  }

  // Updates the drop target as the pointer moves. Only a new target re-renders.
  function trackPointer(x: number, y: number, ghostLeft: number) {
    const current = dragRef.current;
    if (current?.mode !== "pointer") return;
    const target = pointerTarget(current, x, y, ghostLeft);
    if (!sameTarget(target, current.target)) setDrag({ ...current, target });
  }

  const pointerDrag = useParsonsDrag<Pressed>(
    {
      onStart: startPointerDrag,
      onMove: trackPointer,
      onDrop: () => finishDrag(true),
      onCancel: () => finishDrag(false),
    },
    rootRef
  );

  // A press on a block may become a drag. Presses on the toolbar are just clicks.
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>, pressed: Pressed) {
    if (dragRef.current) return;
    if (event.target instanceof Element && event.target.closest("[data-toolbar]")) return;
    pointerDrag.press(event, event.currentTarget, pressed);
  }

  // Picks a block up from the keyboard. A trash block goes straight to the end
  // of the answer, the only useful place for it.
  function pickUp(pressed: Pressed) {
    const picked = pick(pressed);
    if (!picked) return;
    pointerDrag.stop();
    const fromTrash = picked.source.list === "trash";
    const index = fromTrash ? answer.length : pressed.position;
    const count = answer.length + (fromTrash ? 1 : 0);
    setDrag({
      mode: "keyboard",
      ...picked,
      target: { list: "answer", index, indent: picked.block.indent },
      ghost: null,
      hadFocus: true,
      lines,
      answer,
    });
    focusAfterRender({ list: "answer", index, control: "handle" });
    announce(`Picked up ${picked.block.code}. Line ${index + 1} of ${count}${indentText(picked.block.indent)}.`);
  }

  // The keys for a held block: arrows move and indent it, Space or Enter drops
  // it, Escape puts it back.
  function holdKey(event: KeyboardEvent<HTMLDivElement>, current: Drag) {
    if (current.target.list !== "answer") return;
    const { index, indent } = current.target;
    const count = answer.length + (current.source.list === "trash" ? 1 : 0);
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown": {
        event.preventDefault();
        const next = clamp(index + (event.key === "ArrowUp" ? -1 : 1), 0, count - 1);
        setDrag({ ...current, target: { list: "answer", index: next, indent } });
        focusAfterRender({ list: "answer", index: next, control: "handle" });
        announce(`Line ${next + 1} of ${count}.`);
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        event.preventDefault();
        if (!canIndent) break;
        const next = stepIndent(indent, event.key === "ArrowRight" ? 1 : -1, maxIndent);
        setDrag({ ...current, target: { list: "answer", index, indent: next } });
        focusAfterRender({ list: "answer", index, control: "handle" });
        announce(`Indent ${next}.`);
        break;
      }
      case " ":
      case "Enter":
        event.preventDefault();
        if (!event.repeat) finishDrag(true);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        finishDrag(false);
        break;
    }
  }

  // The keys on a block's handle. Not holding it: Space or Enter picks it up,
  // the up and down arrows move to the next block, Delete sends it back.
  function keyDown(event: KeyboardEvent<HTMLDivElement>, pressed: Pressed) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = dragRef.current;
    if (current?.mode === "keyboard") return holdKey(event, current);
    if (current) return;
    switch (event.key) {
      case " ":
      case "Enter":
        event.preventDefault();
        if (!event.repeat) pickUp(pressed);
        break;
      case "ArrowUp":
      case "ArrowDown": {
        event.preventDefault();
        const ids = pressed.list === "answer" ? solutionIds : trashIds;
        const id = ids[pressed.position + (event.key === "ArrowUp" ? -1 : 1)];
        if (id !== undefined) focusPart(id, "handle");
        break;
      }
      case "Delete":
      case "Backspace":
        if (pressed.list !== "answer" || !requireDragging) break;
        event.preventDefault();
        runAction("back", pressed, "handle");
        break;
    }
  }

  // Focus leaving a held block cancels the hold. Moving a block also blurs it
  // for a moment (with nowhere to go), so that case is checked once focus has
  // had the chance to come back.
  function blur(event: FocusEvent<HTMLDivElement>, id: string) {
    const current = dragRef.current;
    if (current?.mode !== "keyboard" || current.block.id !== id) return;
    const to = event.relatedTarget;
    if (to instanceof HTMLElement) {
      refocus.current = to;
      finishDrag(false, false);
      return;
    }
    if (blurCheck.current !== null) cancelAnimationFrame(blurCheck.current);
    blurCheck.current = requestAnimationFrame(() => {
      blurCheck.current = null;
      const still = dragRef.current;
      if (still?.mode !== "keyboard" || still.block.id !== id) return;
      if (document.activeElement !== elements.current.get(id)?.handle) finishDrag(false, false);
    });
  }

  // A toolbar button (or Delete on a handle), with focus kept on the same
  // control of the same line afterwards.
  function runAction(control: Control, pressed: Pressed, focusAs: Control = control) {
    if (dragRef.current) return;
    if (control === "add") {
      const block = blocks.trash.find((other) => other.id === pressed.id);
      if (!block) return;
      const next = addToAnswer(answer, block.code);
      focusAfterRender(
        { list: "trash", index: pressed.position, control: focusAs },
        { list: "trash", index: pressed.position - 1, control: focusAs },
        { list: "answer", index: answer.length, control: "handle" }
      );
      onChange(next);
      announce(`Added ${block.code} to your solution on line ${next.length} of ${next.length}.`);
      return;
    }
    if (control === "handle") return;
    const block = blocks.solution[pressed.position];
    if (!block || block.id !== pressed.id) return;
    const next = blockAction(answer, pressed.position, control, maxIndent);
    if (!next) return;
    if (control === "up" || control === "down") {
      const index = pressed.position + (control === "up" ? -1 : 1);
      focusAfterRender({ list: "answer", index, control: focusAs });
      announce(`Moved ${block.code} to line ${index + 1} of ${next.length}.`);
    } else if (control === "indent" || control === "outdent") {
      focusAfterRender({ list: "answer", index: pressed.position, control: focusAs });
      announce(`Indent ${next[pressed.position].indent}.`);
    } else {
      const freed = returnedId(lines, answer, pressed.position);
      const trashIndex = freed === null ? -1 : matchLines(lines, next).trashIds.indexOf(freed);
      focusAfterRender(
        { list: "answer", index: pressed.position, control: focusAs },
        { list: "answer", index: pressed.position - 1, control: focusAs },
        { list: "trash", index: trashIndex, control: "handle" }
      );
      announce(`Sent ${block.code} back to the blocks to drag from.`);
    }
    onChange(next);
  }

  // Remembers a block's elements as they mount, and forgets them as they go.
  const register = useCallback((id: string, part: Control | "box", element: HTMLElement | null) => {
    const entry = elements.current.get(id) ?? {};
    if (element) entry[part] = element;
    else delete entry[part];
    if (Object.keys(entry).length > 0) elements.current.set(id, entry);
    else elements.current.delete(id);
  }, []);

  // The newest handlers, for the callbacks below. Kept up to date before the
  // focus effect runs, since moving focus can call them.
  const handlersRef = useRef({ pointerDown, keyDown, blur, runAction });
  useLayoutEffect(() => {
    handlersRef.current = { pointerDown, keyDown, blur, runAction };
  });
  const callbacks = useMemo<BlockCallbacks>(
    () => ({
      register,
      pointerDown: (event, pressed) => handlersRef.current.pointerDown(event, pressed),
      keyDown: (event, pressed) => handlersRef.current.keyDown(event, pressed),
      blur: (event, id) => handlersRef.current.blur(event, id),
      toolbar: (control, pressed) => handlersRef.current.runAction(control, pressed),
    }),
    [register]
  );

  // Puts focus where the last action asked, once the blocks are in their new places.
  useLayoutEffect(() => {
    const spots = focusNext.current;
    const element = refocus.current;
    focusNext.current = null;
    refocus.current = null;
    if (spots) {
      for (const spot of spots) {
        const id = (spot.list === "answer" ? solutionIds : trashIds)[spot.index];
        if (id !== undefined && focusPart(id, spot.control)) return;
      }
    }
    if (element && element.isConnected && document.activeElement !== element) element.focus({ preventScroll: true });
  });

  // A change from outside (Reset Problem, a new activity) ends any drag.
  useEffect(() => {
    if (drag && !liveDrag) abandonDrag();
  });

  // Nothing is left waiting when the widget goes away.
  useEffect(
    () => () => {
      if (blurCheck.current !== null) cancelAnimationFrame(blurCheck.current);
    },
    []
  );

  const ghostStyle = useMemo<CSSProperties | null>(() => {
    const ghost = pointer?.ghost;
    if (!ghost) return null;
    return {
      position: "fixed",
      left: 0,
      top: 0,
      marginTop: 0,
      marginLeft: 0,
      width: ghost.width,
      fontSize: ghost.fontSize,
      transform: `translate3d(${ghost.left}px, ${ghost.top}px, 0)`,
      zIndex: 1000,
      pointerEvents: "none",
    };
  }, [pointer?.ghost]);

  const busy = liveDrag !== null;
  const grabbing = pointer !== null;
  const blockProps = { busy, grabbing, canIndent, requireDragging, xIndent, maxIndent, instructionsId, callbacks };
  const solutionFrame: CSSProperties = {
    ...ANSWER_FRAME_STYLE[answerFrame],
    ...(liveDrag && canIndent ? indentGuides(xIndent, maxIndent) : undefined),
  };

  return (
    <div ref={rootRef} className="@container mt-3 flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        {requireDragging ? "Drag blocks into your solution" : "Drag the blocks into the right order"}
        {canIndent ? " and drag them sideways to indent them" : ""}. On a touch screen, press and hold a block to pick
        it up.
      </p>
      <p id={instructionsId} hidden>
        Press Space or Enter to pick up this block. Then use the up and down arrow keys to move it
        {canIndent ? ", the left and right arrow keys to indent it," : ""} and Space or Enter to drop it. Press Escape to
        cancel.
      </p>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement.text}
        {announcement.count % 2 === 1 ? " " : ""}
      </div>

      <div className="flex flex-col gap-4 @2xl:flex-row">
        {requireDragging && (
          <div ref={trashColumnRef} className="flex min-w-0 flex-col gap-1 @2xl:w-2/5 @2xl:shrink-0">
            <h3 id={trashLabelId} className={listLabel}>
              Drag from here
            </h3>
            <div className="min-h-16 flex-1 px-2" style={TRASH_FRAME_STYLE}>
              {trash.count === 0 && !busy && <p className={emptyHint}>Every block is in your solution.</p>}
              <ul role="list" aria-labelledby={trashLabelId} className="m-0 list-none p-0">
                {trash.rows.map((row) => (
                  <BlockItem
                    key={row.id}
                    list="trash"
                    id={row.id}
                    code={row.code}
                    indent={0}
                    position={row.position}
                    count={trash.count}
                    state="plain"
                    hidden={row.hidden}
                    lifted={false}
                    gapHeight={row.gapBefore ? gapHeight : null}
                    gapIndent={0}
                    {...blockProps}
                  />
                ))}
                {trash.gapAtEnd && <GapItem height={gapHeight} indent={0} xIndent={xIndent} />}
              </ul>
            </div>
          </div>
        )}

        <div ref={solutionColumnRef} className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={solutionLabelId} className={listLabel}>
            Construct your solution here
          </h3>
          <div className="min-h-16 flex-1 px-2" style={solutionFrame}>
            {solution.count === 0 && !solution.gapAtEnd && (
              <p className={emptyHint}>
                {requireDragging ? "Drag blocks here to build your solution." : "Your blocks will appear here."}
              </p>
            )}
            <ul ref={solutionListRef} role="list" aria-labelledby={solutionLabelId} className="m-0 list-none p-0">
              {solution.rows.map((row) => (
                <BlockItem
                  key={row.id}
                  list="answer"
                  id={row.id}
                  code={row.code}
                  indent={row.indent}
                  position={row.position}
                  count={solution.count}
                  state={states?.[row.position] ?? "plain"}
                  hidden={row.hidden}
                  lifted={held?.block.id === row.id}
                  gapHeight={row.gapBefore ? gapHeight : null}
                  gapIndent={gapIndent}
                  {...blockProps}
                />
              ))}
              {solution.gapAtEnd && <GapItem height={gapHeight} indent={gapIndent} xIndent={xIndent} />}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButton} disabled={answer.length === 0} onClick={onCheck}>
          Get Feedback
        </button>
        <button type="button" className={secondaryButton} onClick={onReset}>
          Reset Problem
        </button>
        <div role="status" className={showErrors ? "w-full" : undefined}>
          {result === true && <span className="font-semibold text-green-700">Correct!</span>}
          {showErrors && (
            <ul className="list-disc pl-6 text-sm text-red-700">
              {feedback.errors.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          )}
          {result === false && !showErrors && <span className="font-semibold text-red-600">Not quite. Keep trying.</span>}
        </div>
      </div>

      {pointer &&
        ghostStyle &&
        createPortal(
          <LineBox
            ref={pointerDrag.ghostRef}
            aria-hidden="true"
            code={pointer.block.code}
            indent={0}
            xIndent={xIndent}
            look="ghost"
            className="cursor-grabbing select-none"
            style={ghostStyle}
          />,
          document.body
        )}
    </div>
  );
}

interface BlockItemProps {
  list: ListName;
  id: string;
  code: string;
  indent: number;
  // Its place among the blocks that show in its list, and how many show.
  position: number;
  count: number;
  state: LineState;
  // Dragged with the pointer: kept in the list but hidden until the drop.
  hidden: boolean;
  // Held from the keyboard.
  lifted: boolean;
  // The height of the drop gap just above it, or null for none.
  gapHeight: number | null;
  gapIndent: number;
  // A drag or hold is under way, so the toolbars are put away.
  busy: boolean;
  // A pointer drag is under way: the cursor is a closed hand.
  grabbing: boolean;
  canIndent: boolean;
  requireDragging: boolean;
  xIndent: number;
  maxIndent: number;
  instructionsId: string;
  callbacks: BlockCallbacks;
}

// One block in a list: the js-parsons box, a handle across it that takes
// focus and the keyboard, and a toolbar that shows on hover or focus.
const BlockItem = memo(function BlockItem({
  list,
  id,
  code,
  indent,
  position,
  count,
  state,
  hidden,
  lifted,
  gapHeight,
  gapIndent,
  busy,
  grabbing,
  canIndent,
  requireDragging,
  xIndent,
  maxIndent,
  instructionsId,
  callbacks,
}: BlockItemProps) {
  const pressed = useMemo(() => ({ list, id, position }), [list, id, position]);
  const boxRef = useCallback((element: HTMLDivElement | null) => callbacks.register(id, "box", element), [callbacks, id]);
  const handleRef = useCallback((element: HTMLDivElement | null) => callbacks.register(id, "handle", element), [callbacks, id]);
  const name = list === "trash" ? code : `${code}, line ${position + 1} of ${count}${canIndent ? `, indent ${indent}` : ""}`;

  return (
    <li style={hidden ? { display: "none" } : undefined}>
      {gapHeight !== null && <DropGap height={gapHeight} indent={gapIndent} xIndent={xIndent} />}
      <LineBox
        ref={boxRef}
        code={code}
        indent={indent}
        xIndent={xIndent}
        state={state}
        look={lifted ? "lifted" : "flat"}
        className={`group/block touch-manipulation select-none ${blockFocusRing} ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
        style={noCallout}
        onPointerDown={(event) => callbacks.pointerDown(event, pressed)}
        codeProps={{
          ref: handleRef,
          role: "button",
          tabIndex: 0,
          "aria-roledescription": "draggable block",
          "aria-label": name,
          "aria-describedby": instructionsId,
          className: "parsons-handle outline-none",
          onKeyDown: (event) => callbacks.keyDown(event, pressed),
          onBlur: (event) => callbacks.blur(event, id),
        }}
      >
        {!busy && (
          <Toolbar
            list={list}
            id={id}
            pressed={pressed}
            first={position === 0}
            last={position === count - 1}
            indent={indent}
            canIndent={canIndent}
            requireDragging={requireDragging}
            maxIndent={maxIndent}
            callbacks={callbacks}
          />
        )}
      </LineBox>
    </li>
  );
});

interface ToolbarProps {
  list: ListName;
  id: string;
  pressed: Pressed;
  first: boolean;
  last: boolean;
  indent: number;
  canIndent: boolean;
  requireDragging: boolean;
  maxIndent: number;
  callbacks: BlockCallbacks;
}

// The block's buttons, for students who can't or don't want to drag. Hidden
// until the block is hovered or has focus. A press here doesn't move focus,
// so the toolbar stays open; the action then puts focus on the button.
function Toolbar({ list, id, pressed, first, last, indent, canIndent, requireDragging, maxIndent, callbacks }: ToolbarProps) {
  const button = (control: Control, label: string, icon: LucideIcon, disabled = false) => (
    <ToolButton
      key={control}
      id={id}
      control={control}
      label={label}
      icon={icon}
      disabled={disabled}
      pressed={pressed}
      callbacks={callbacks}
    />
  );
  return (
    <div
      data-toolbar
      className="invisible absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-300 bg-white/95 p-0.5 shadow-sm group-focus-within/block:visible group-hover/block:visible"
      onMouseDown={(event) => event.preventDefault()}
    >
      {list === "trash" ? (
        button("add", "Add to solution", Plus)
      ) : (
        <>
          {button("up", "Move up", ArrowUp, first)}
          {button("down", "Move down", ArrowDown, last)}
          {canIndent && button("outdent", "Outdent", ListIndentDecrease, indent <= 0)}
          {canIndent && button("indent", "Indent", ListIndentIncrease, indent >= maxIndent)}
          {requireDragging && button("back", "Send back", Undo2)}
        </>
      )}
    </div>
  );
}

interface ToolButtonProps {
  id: string;
  control: Control;
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  pressed: Pressed;
  callbacks: BlockCallbacks;
}

// One icon button of a block's toolbar.
function ToolButton({ id, control, label, icon: Icon, disabled, pressed, callbacks }: ToolButtonProps) {
  const ref = useCallback((element: HTMLButtonElement | null) => callbacks.register(id, control, element), [callbacks, id, control]);
  return (
    <button
      ref={ref}
      type="button"
      className={toolButton}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => callbacks.toolbar(control, pressed)}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

// The dashed outline where a dragged block will land, as tall as the block.
function DropGap({ height, indent, xIndent }: { height: number; indent: number; xIndent: number }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-[10px] border-2 border-dashed border-brand/60 bg-brand/5"
      style={{ height, marginTop: 5, marginLeft: indentOffsetPx(indent, xIndent) }}
    />
  );
}

// The drop gap after the last block of a list.
function GapItem({ height, indent, xIndent }: { height: number; indent: number; xIndent: number }) {
  return (
    <li aria-hidden="true">
      <DropGap height={height} indent={indent} xIndent={xIndent} />
    </li>
  );
}

// Whether a point is inside an element's box on screen.
function inside(element: Element | null, x: number, y: number): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// The left edge of a list's content on screen: where a block at indent 0 starts.
function contentLeft(list: HTMLElement): number {
  const paddingLeft = parseFloat(getComputedStyle(list).paddingLeft) || 0;
  return list.getBoundingClientRect().left + list.clientLeft + paddingLeft;
}

// Faint lines at each indent step behind the answer during a drag, so students
// can see where a block will snap to.
function indentGuides(xIndent: number, maxIndent: number): CSSProperties | undefined {
  if (xIndent < 8) return undefined;
  const width = Math.min(maxIndent * xIndent, MAX_INDENT_PX);
  return {
    backgroundImage: `repeating-linear-gradient(to right, rgba(34, 21, 116, 0.2) 0 1px, transparent 1px ${xIndent}px)`,
    backgroundSize: `${width + 1}px 100%`,
    backgroundRepeat: "no-repeat",
    backgroundOrigin: "content-box",
  };
}
