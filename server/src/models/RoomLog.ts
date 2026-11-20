import { Schema, model, InferSchemaType } from "mongoose";

// One row per room a teacher ended, holding only what the dashboard stats need.
// It is written when a room ends and is never deleted by the teacher, so deleting
// a previous activity (PastRoom) does not change the dashboard numbers.
const RoomLogSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    hostID: { type: String, required: true, index: true },
    activityName: { type: String, default: null },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    studentCount: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  }
);

export type RoomLogDoc = InferSchemaType<typeof RoomLogSchema>;

// "RoomLog" -> Mongoose stores these in the "roomlogs" collection.
export const RoomLog = model("RoomLog", RoomLogSchema);
