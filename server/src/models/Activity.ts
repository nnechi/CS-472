import { Schema, model, InferSchemaType } from "mongoose";
import { ACTIVITY_MAX_LENGTH, ACTIVITY_NAME_MAX_LENGTH, PROGRAMMING_LANGUAGES } from "../types";

// An activity a teacher made. Only the teacher in teacherId can use it in a room.
const activitySchema = new Schema(
  {
    // The teacher's id, the same one they sign in with.
    teacherId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: ACTIVITY_NAME_MAX_LENGTH },
    // The programming language every question in the activity uses.
    language: { type: String, required: true, enum: [...PROGRAMMING_LANGUAGES] },
    // The questions students work on, each with the output a correct answer produces.
    // Only the question text is sent to students; the output stays on the server.
    questions: {
      type: [
        {
          question: { type: String, required: true, maxlength: ACTIVITY_MAX_LENGTH },
          output: { type: String, required: true, maxlength: ACTIVITY_MAX_LENGTH },
        },
      ],
      default: [],
    },
  },
  {
    // Automatically adds createdAt and updatedAt Date fields.
    timestamps: true,
  }
);

export type ActivityDoc = InferSchemaType<typeof activitySchema>;

// "Activity" -> Mongoose stores these in the "activities" collection.
export const Activity = model("Activity", activitySchema);
