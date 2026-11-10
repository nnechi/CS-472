import type { ParsonsLine } from "../../types";

// The rules behind the Parsons widget's drag and drop, kept free of React and
// the DOM so they can be tested on their own.

// The furthest right a block is ever drawn, so deep indents stay on screen.
export const MAX_INDENT_PX = 300;

// The deepest indent the server accepts (MAX_INDENT_LEVEL in server/src/socket.ts).
const SERVER_MAX_INDENT = 20;

// During a drag, the page scrolls when the pointer is this close to the top or
// bottom of the scrolling area, by up to this many pixels each frame.
export const AUTO_SCROLL_ZONE_PX = 56;
export const AUTO_SCROLL_MAX_PX = 16;

// Keeps a number between min and max. Anything that isn't a number becomes min.
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

// The deepest indent a student can give a block: as many steps of xIndent as
// fit in MAX_INDENT_PX, at least 1 and never more than the server allows.
export function maxIndentLevel(xIndent: number): number {
  return clamp(Math.floor(MAX_INDENT_PX / Math.max(1, xIndent)), 1, SERVER_MAX_INDENT);
}

// How far right a block at this indent level is drawn, in pixels.
export function indentOffsetPx(indent: number, xIndent: number): number {
  const step = Number.isFinite(xIndent) ? Math.max(0, xIndent) : 0;
  return Math.min(Math.max(0, indent) * step, MAX_INDENT_PX);
}

// Gives every block an id that stays the same while it is dragged around.
// Pool line k is "p" + k. Each answer line takes the first unused pool line
// with the same code, so duplicate lines are matched one copy at a time. An
// answer line with no match gets "x" + its index. The trash holds the pool
// lines left over, in pool order.
export function matchLines(lines: string[], answer: ParsonsLine[]): { answerIds: string[]; trashIds: string[] } {
  const used = lines.map(() => false);
  const answerIds = answer.map((line, i) => {
    const k = lines.findIndex((code, j) => !used[j] && code === line.code);
    if (k === -1) return "x" + i;
    used[k] = true;
    return "p" + k;
  });
  const trashIds = lines.flatMap((_, k) => (used[k] ? [] : ["p" + k]));
  return { answerIds, trashIds };
}

// The pool index in a block id ("p3" is 3), or -1 for a line that isn't in the pool.
export function poolIndex(id: string): number {
  if (!/^p\d+$/.test(id)) return -1;
  return Number(id.slice(1));
}

// Where a dragged block lands in the answer: the number of blocks whose middle
// is above the pointer. midpoints are the other blocks' middles, top to bottom.
export function dropIndex(midpoints: number[], y: number): number {
  return midpoints.filter((middle) => middle < y).length;
}

// The indent a block gets from how far right of the answer's left edge it is
// dropped, rounded to the nearest step of xIndent.
export function dropIndent(offsetX: number, xIndent: number, maxIndent: number): number {
  return clamp(Math.round(offsetX / Math.max(1, xIndent)), 0, maxIndent);
}

// One indent step in or out from the keyboard. It never goes below 0, and an
// indent past the deepest allowed one can still come out but not go further.
export function stepIndent(indent: number, step: 1 | -1, maxIndent: number): number {
  if (step > 0) return indent < maxIndent ? indent + 1 : indent;
  return indent > 0 ? indent - 1 : 0;
}

// Where a dragged block came from: the trash (by its code) or a line of the answer.
export type DragSource = { list: "trash"; code: string } | { list: "answer"; index: number };

// Where a block is dropped: back in the trash, or in the answer at its final
// index (its place in the new answer) and indent.
export type DropTarget = { list: "trash" } | { list: "answer"; index: number; indent: number };

// Whether two drop targets are the same place.
export function sameTarget(a: DropTarget, b: DropTarget): boolean {
  if (a.list === "trash" || b.list === "trash") return a.list === b.list;
  return a.index === b.index && a.indent === b.indent;
}

// The answer after a block is dropped, or null when nothing changes (a line
// put back where it was, or a trash block dropped on the trash).
export function applyDrop(answer: ParsonsLine[], source: DragSource, target: DropTarget): ParsonsLine[] | null {
  if (source.list === "trash") {
    if (target.list === "trash") return null;
    return insertAt(answer, target.index, { code: source.code, indent: Math.max(0, target.indent) });
  }

  const line = answer[source.index];
  if (!line) return null;
  const rest = answer.filter((_, i) => i !== source.index);
  if (target.list === "trash") return rest;

  const indent = Math.max(0, target.indent);
  const index = clamp(target.index, 0, rest.length);
  if (index === source.index && indent === line.indent) return null;
  return insertAt(rest, index, { code: line.code, indent });
}

// A copy of items with item put at index (kept within the list).
function insertAt<T>(items: T[], index: number, item: T): T[] {
  const at = clamp(index, 0, items.length);
  return [...items.slice(0, at), item, ...items.slice(at)];
}

// The toolbar actions on a block in the answer.
export type BlockAction = "up" | "down" | "outdent" | "indent" | "back";

// The answer after a toolbar action on the line at index, or null when the
// action can't be done (moving the top line up, outdenting at 0...).
export function blockAction(
  answer: ParsonsLine[],
  index: number,
  action: BlockAction,
  maxIndent: number
): ParsonsLine[] | null {
  const line = answer[index];
  if (!line) return null;
  const source: DragSource = { list: "answer", index };
  switch (action) {
    case "up":
      if (index === 0) return null;
      return applyDrop(answer, source, { list: "answer", index: index - 1, indent: line.indent });
    case "down":
      if (index === answer.length - 1) return null;
      return applyDrop(answer, source, { list: "answer", index: index + 1, indent: line.indent });
    case "outdent":
    case "indent": {
      const indent = stepIndent(line.indent, action === "indent" ? 1 : -1, maxIndent);
      return applyDrop(answer, source, { list: "answer", index, indent });
    }
    case "back":
      return applyDrop(answer, source, { list: "trash" });
  }
}

// The answer with a trash block added to the end, as "Add to solution" does.
export function addToAnswer(answer: ParsonsLine[], code: string): ParsonsLine[] {
  return [...answer, { code, indent: 0 }];
}

// The id a line of the answer has in the trash once it is sent back: the pool
// line it frees. null when it frees none (a line that isn't in the pool).
export function returnedId(lines: string[], answer: ParsonsLine[], index: number): string | null {
  const before = new Set(matchLines(lines, answer).trashIds);
  const after = matchLines(lines, answer.filter((_, i) => i !== index)).trashIds;
  return after.find((id) => !before.has(id)) ?? null;
}

// A block's home slot in the trash: how many of the other trash blocks come
// before it. The trash keeps the pool's order, so a block always goes back to
// the same place.
export function trashSlot(trashIds: string[], id: string): number {
  const k = poolIndex(id);
  if (k === -1) return trashIds.filter((other) => other !== id).length;
  return trashIds.filter((other) => other !== id && poolIndex(other) < k).length;
}

// Where the drop gap shows in the trash for a dragged block: its home slot,
// counting only the trash blocks that are showing.
export function trashGapIndex(lines: string[], answer: ParsonsLine[], source: DragSource, id: string): number {
  const { trashIds } = matchLines(lines, answer);
  if (source.list === "trash") return trashSlot(trashIds, id);
  const freed = returnedId(lines, answer, source.index);
  return freed === null ? trashIds.length : trashSlot(trashIds, freed);
}

// A block as the widget draws it.
export interface Block {
  id: string;
  code: string;
  indent: number;
}

// The answer's blocks and the trash's blocks, with their ids.
export function toBlocks(lines: string[], answer: ParsonsLine[]): { solution: Block[]; trash: Block[] } {
  const { answerIds, trashIds } = matchLines(lines, answer);
  return {
    solution: answer.map((line, i) => ({ id: answerIds[i], code: line.code, indent: line.indent })),
    trash: trashIds.map((id) => ({ id, code: lines[poolIndex(id)], indent: 0 })),
  };
}

// A list's blocks with block taken out and put back at index, as a block held
// from the keyboard is shown at the place it would be dropped.
export function placeBlock(blocks: Block[], block: Block, index: number): Block[] {
  return insertAt(blocks.filter((other) => other.id !== block.id), index, block);
}

// One block of a list as drawn during a pointer drag.
export interface Row extends Block {
  // Its place among the blocks that show (-1 for the hidden one).
  position: number;
  // The dragged block stays in its list, hidden, until the drag ends.
  hidden: boolean;
  // The drop gap opens just above it.
  gapBefore: boolean;
}

// A list as drawn during a drag: the dragged block stays in the list but is
// hidden, and the drop gap opens before the block at gapIndex (counting only
// the blocks that show), or after the last one.
export function listRows(
  blocks: Block[],
  hiddenId: string | null,
  gapIndex: number | null
): { rows: Row[]; count: number; gapAtEnd: boolean } {
  const rows: Row[] = [];
  let position = 0;
  let gapPlaced = gapIndex === null;
  for (const block of blocks) {
    const hidden = block.id === hiddenId;
    const gapBefore = !hidden && !gapPlaced && position === gapIndex;
    if (gapBefore) gapPlaced = true;
    rows.push({ ...block, position: hidden ? -1 : position, hidden, gapBefore });
    if (!hidden) position++;
  }
  return { rows, count: position, gapAtEnd: !gapPlaced };
}

// How far to scroll this frame while dragging at height y, for a scrolling
// area from top to bottom: negative scrolls up, positive down, 0 not at all.
// The closer to the edge, the faster.
export function autoScrollStep(
  y: number,
  top: number,
  bottom: number,
  zone = AUTO_SCROLL_ZONE_PX,
  maxStep = AUTO_SCROLL_MAX_PX
): number {
  const height = bottom - top;
  if (!(height > 0) || !(zone > 0)) return 0;
  // In a short area the two zones share the middle instead of overlapping.
  const size = Math.min(zone, height / 2);
  if (y < top + size) return -Math.ceil(maxStep * Math.min(1, (top + size - y) / size));
  if (y > bottom - size) return Math.ceil(maxStep * Math.min(1, (y - (bottom - size)) / size));
  return 0;
}

// Whether two lists of lines are the same, line by line.
export function sameLines(a: string[], b: string[]): boolean {
  return a === b || (a.length === b.length && a.every((code, i) => code === b[i]));
}

// Whether two answers are the same, line by line.
export function sameAnswer(a: ParsonsLine[], b: ParsonsLine[]): boolean {
  return a === b || (a.length === b.length && a.every((line, i) => line.code === b[i].code && line.indent === b[i].indent));
}
