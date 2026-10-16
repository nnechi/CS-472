// Room codes are short, uppercase, alphanumeric strings. The server uppercases
// whatever it receives, so we normalize the same way on the client to keep
// URLs and the chat banner consistent.
export const ROOM_CODE_MAX_LENGTH = 8;


export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().slice(0, ROOM_CODE_MAX_LENGTH);
}
