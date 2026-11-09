// Represent an edit as the changed range between the common prefix and suffix.
function changedRange(before: string, after: string) {
  let start = 0;
  while (start < Math.min(before.length, after.length) && before[start] === after[start]) start++;
  let end = before.length;
  let newEnd = after.length;
  while (end > start && newEnd > start && before[end - 1] === after[newEnd - 1]) {
    end--;
    newEnd--;
  }
  return { start, end, text: after.slice(start, newEnd) };
}

// Rebase an edit onto the shared text when the changed ranges are disjoint.
// An overlapping replacement needs the editor to refresh before trying again.
export function mergeCodeEdit(before: string, after: string, current: string): string | null {
  if (before === current) return after;
  if (before === after || after === current) return current;

  const edit = changedRange(before, after);
  const concurrent = changedRange(before, current);
  let offset = 0;
  if (concurrent.end <= edit.start) {
    offset = concurrent.text.length - (concurrent.end - concurrent.start);
  } else if (edit.end > concurrent.start) {
    return null;
  }

  return current.slice(0, edit.start + offset) + edit.text + current.slice(edit.end + offset);
}
