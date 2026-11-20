import { PastRoom } from "./models/PastRoom";
import { RoomLog } from "./models/RoomLog";
import { RoomStatSummary } from "./types";

// Dashboard stats for a teacher. These read RoomLog, not PastRoom, so deleting a
// previous activity never changes them. See models/RoomLog.ts.

export interface RoomLogInput {
  code: string;
  hostID: string;
  activityName: string | null;
  startedAt: Date;
  endedAt: Date;
  studentCount: number;
}

// Called when a room ends, right after its PastRoom is saved.
export async function recordRoomLog(input: RoomLogInput): Promise<void> {
  await RoomLog.create(input);
}

// Every ended room of this teacher, most recently ended first.
export async function roomStatsForHost(hostID: string): Promise<RoomStatSummary[]> {
  const found = await RoomLog.find({ hostID }).sort({ endedAt: -1 }).lean();

  return found.map((room) => ({
    code: room.code,
    activityName: room.activityName ?? null,
    startedAt: room.startedAt.toISOString(),
    endedAt: room.endedAt.toISOString(),
    studentCount: room.studentCount,
  }));
}

// Copies rooms saved before RoomLog existed into it. Safe to run on every start:
// a room already in RoomLog is matched by host, code and start time and left alone.
// A PastRoom deleted before this ran is not copied, since it is no longer there.
export async function backfillRoomLogs(): Promise<number> {
  const rooms = await PastRoom.find({})
    .select("code hostID activityName startedAt endedAt students")
    .lean();
  if (rooms.length === 0) return 0;

  const operations = rooms.map((room) => ({
    updateOne: {
      filter: { hostID: room.hostID, code: room.code, startedAt: room.startedAt },
      update: {
        $setOnInsert: {
          code: room.code,
          hostID: room.hostID,
          activityName: room.activityName ?? null,
          startedAt: room.startedAt,
          endedAt: room.endedAt,
          studentCount: Array.isArray(room.students) ? room.students.length : 0,
        },
      },
      upsert: true,
    },
  }));

  const result = await RoomLog.bulkWrite(operations);
  return result.upsertedCount;
}
