// Room codes are short, uppercase, alphanumeric strings. The server uppercases
// whatever it receives, so we normalize the same way on the client to keep
// URLs and the chat banner consistent.
export const ROOM_CODE_MAX_LENGTH = 8;

export function generateRoomCode(): string {
  return normalizeRoomCode(Math.random().toString(36).substring(2, 8).toUpperCase());
}

function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().slice(0, ROOM_CODE_MAX_LENGTH);
}
