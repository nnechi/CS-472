import { Schema, model, InferSchemaType } from "mongoose";

// A room a teacher ran, saved when it ended. Unlike Room it has no TTL, so the
// teacher can look back at it under Previous activities.
const PastRoomSchema = new Schema(
  {
    // unique already makes an index, so no separate index: true (Mongoose warns on duplicates).
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // The teacher who ran the room (same id as Room.hostID and the session user id).
    hostID: { type: String, required: true, index: true },
    activityName: { type: String, default: null },
    activityType: { type: String, enum: ["coding", "parsons"], default: null },
    // The teacher's view of the activity (answers included), as the room used it.
    activity: { type: Schema.Types.Mixed, default: null },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    // Every student who joined: { id, username, pup, joinedAt (Date), hasPrivateChat,
    // progress (or null), privateMessages }.
    students: { type: [Schema.Types.Mixed], default: [] },
    // The group chat, oldest first (ChatMessage shape).
    messages: { type: [Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true,
  }
).index({ hostID: 1, endedAt: -1 });

export type PastRoomDoc = InferSchemaType<typeof PastRoomSchema>;

export const PastRoom = model("PastRoom", PastRoomSchema);
