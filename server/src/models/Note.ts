import { Schema, model, InferSchemaType } from "mongoose";
import { NOTE_MAX_LENGTH } from "../types";

// A teacher's private note on one of their activities or rooms. Kept in its own
// collection, not inside Activity or Room, so code that sends those to students
// can never include a note by accident.
const noteSchema = new Schema(
  {
    // The teacher who wrote it: always the session user's id, never one from the browser.
    teacherId: { type: String, required: true, trim: true },
    // "activity" or "room".
    kind: { type: String, required: true, enum: ["activity", "room"] },
    // The activity's id, or the room's code.
    targetId: { type: String, required: true, trim: true },
    text: { type: String, required: true, maxlength: NOTE_MAX_LENGTH },
  },
  {
    // Automatically adds createdAt and updatedAt Date fields.
    timestamps: true,
  }
);

// One note per teacher per activity or room. This index also makes looking a note up fast.
noteSchema.index({ teacherId: 1, kind: 1, targetId: 1 }, { unique: true });
// For listing one teacher's notes, most recently changed first.
noteSchema.index({ teacherId: 1, updatedAt: -1 });

export type NoteDoc = InferSchemaType<typeof noteSchema>;

// "Note" -> Mongoose stores these in the "notes" collection.
export const Note = model("Note", noteSchema);
