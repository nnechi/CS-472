import { Schema, model, InferSchemaType } from "mongoose";
import {
  ACTIVITY_MAX_LENGTH,
  ACTIVITY_NAME_MAX_LENGTH,
  ACTIVITY_TYPES,
  PROGRAMMING_LANGUAGES,
} from "../types";

// An activity a teacher made. Only the teacher in teacherId can use it in a room.
const activitySchema = new Schema(
  {
    // The teacher's id, the same one they sign in with.
    teacherId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: ACTIVITY_NAME_MAX_LENGTH },
    // "coding" or "parsons". Every question in an activity has the same type.
    type: { type: String, required: true, enum: [...ACTIVITY_TYPES] },
    // The programming language of a coding activity. Not used for Parsons.
    language: { type: String, enum: [...PROGRAMMING_LANGUAGES], default: null },
    // The questions students work on.
    //   coding: output is the correct output.
    //   parsons: initial is the problem in the generator's format (see
    //     server/src/parsons/parse.ts), and options are its settings.
    // Only the question text, and for Parsons the shuffled lines, go to students.
    questions: {
      type: [
        {
          question: { type: String, required: true, maxlength: ACTIVITY_MAX_LENGTH },
          output: { type: String, default: "", maxlength: ACTIVITY_MAX_LENGTH },
          initial: { type: String, default: "", maxlength: ACTIVITY_MAX_LENGTH * 60 },
          options: { type: Schema.Types.Mixed, default: {} },
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
