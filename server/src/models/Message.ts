import { Schema, model, InferSchemaType } from "mongoose";

// A Schema describes the shape of documents in a MongoDB collection.
// Mongoose validates data against it and gives us a typed model.
const messageSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    // The sender's role, useful for future UI for roles
    role: { type: String, enum: ["student", "teacher"], required: true },
    text: { type: String, required: true, trim: true },
    // Which room this message belongs to.
    room: { type: String, required: true, trim: true, index: true },
    // The sender's profile picture URL, if they have one (signed-in teachers).
    avatarUrl: { type: String, default: null },
    // A student's pup avatar id (for example "corgi"), so chat history shows it too.
    pup: { type: String, default: null },
  },
  {
    // Automatically adds createdAt and updatedAt Date fields.
    timestamps: true,
  }
);

// Let TypeScript derive the document type from the schema.
export type MessageDoc = InferSchemaType<typeof messageSchema>;

// "Message" -> Mongoose stores these in the "messages" collection.
export const Message = model("Message", messageSchema);
