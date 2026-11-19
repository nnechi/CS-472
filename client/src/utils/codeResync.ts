// How a student's page sends code the server may not have after it rejoins a
// room (typed while offline, or edits whose answer never came back).
//
// It sends one edit, { before, code: what the page has }, and the server
// merges it into its own code (mergeCodeEdit in server/src/codeEdit.ts):
// unchanged since `before`, the server takes the page's code as it is;
// changed elsewhere since (by the teacher), the student's change is applied
// on top. So `before` must be text the server has already taken in, or the
// student's typing would be applied twice.

// See RestoreMode in useRoomSocket: whether the server kept the student's seat
// ("continue") or made a new one ("reupload").
export type ResyncMode = "continue" | "reupload";

// One question's typing since the page last heard back from the server: the
// server's code it started from, and every text the page sent since.
export interface EditRun {
  base: string;
  sent: Set<string>;
}

// The `before` to send with the page's code for one question.
// - A new seat has none of the typing: from the server's code, so all of it goes.
// - The server's code is the page's own (where the typing started, or a text
//   the page sent): from there, so the server just moves forward.
// - Otherwise the teacher changed it meanwhile: from the latest text of the
//   student's the server took in (applied), if it's from this typing, or else
//   from where the typing started, so only what the server lacks is applied
//   on top of the teacher's change.
export function replayFrom(mode: ResyncMode, server: string, run: EditRun | undefined, applied: string | null): string {
  if (mode === "reupload" || !run || server === run.base || run.sent.has(server)) return server;
  return applied !== null && run.sent.has(applied) ? applied : run.base;
}
