import { AppServer, closeRoom, liveRoomCodesOfHost } from "./socket";
import { Activity } from "./models/Activity";
import { Message } from "./models/Message";
import { Note } from "./models/Note";
import { PastRoom } from "./models/PastRoom";
import { Room } from "./models/Room";
import { RoomLog } from "./models/RoomLog";

export async function deleteTeacherData(io: AppServer, teacherId: string): Promise<void> {
  const openCodes = new Set([...liveRoomCodesOfHost(teacherId), ...(await Room.distinct("code", { hostID: teacherId }))]);
  for (const code of openCodes) closeRoom(io, code, "ended", false);

  const [pastCodes, logCodes] = await Promise.all([
    PastRoom.distinct("code", { hostID: teacherId }),
    RoomLog.distinct("code", { hostID: teacherId }),
  ]);
  const codes = [...new Set([...openCodes, ...pastCodes, ...logCodes])];

  await Promise.all([
    Activity.deleteMany({ teacherId }),
    Note.deleteMany({ teacherId }),
    Room.deleteMany({ hostID: teacherId }),
    PastRoom.deleteMany({ hostID: teacherId }),
    RoomLog.deleteMany({ hostID: teacherId }),
    Message.deleteMany({ room: { $in: codes } }),
  ]);
}
