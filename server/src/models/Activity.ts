import { Schema, model, InferSchemaType } from "mongoose";
import { ACTIVITY_MAX_LENGTH, ACTIVITY_NAME_MAX_LENGTH } from "../types";

// An activity a teacher made. Only the teacher in teacherId can use it in a room.
const activitySchema = new Schema(
  {
    // The teacher's id, the same one they sign in with.
    teacherId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: ACTIVITY_NAME_MAX_LENGTH },
    // The activity itself. Students start from this text.
    data: { type: String, default: "", maxlength: ACTIVITY_MAX_LENGTH },
  },
  {
    // Automatically adds createdAt and updatedAt Date fields.
    timestamps: true,
  }
);

export type ActivityDoc = InferSchemaType<typeof activitySchema>;

// "Activity" -> Mongoose stores these in the "activities" collection.
export const Activity = model("Activity", activitySchema);
