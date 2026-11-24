import express, { ErrorRequestHandler, RequestHandler } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { connectToDatabase } from "./db";
import {
  AppServer,
  activeRoomsForHost,
  closeRoom,
  isLiveRoomCode,
  isLiveRoomHost,
  lobbyChannel,
  markLiveRoomOpened,
  registerSocketHandlers,
} from "./socket";
import { deletePastRoomForHost, pastRoomForHost, pastRoomsForHost } from "./pastRooms";
import { backfillRoomLogs, roomStatsForHost } from "./roomStats";
import {
  activityNoteFor,
  deleteActivityNote,
  notesForTeacher,
  parseNoteText,
  roomNotesFor,
  saveActivityNoteFor,
  saveRoomNoteFor,
} from "./notes";


import { generateRoomCode } from "./utils/roomCode";
import {Room} from "./models/Room"
import {PastRoom} from "./models/PastRoom"
import {Activity} from "./models/Activity"

import { authConfig } from "./auth/config";
import { parseActivityInput } from "./activityInput";
import { splitInitial } from "./parsons/parse";
import { isObjectIdOrHexString } from "mongoose";

import { sessionMiddleware } from "./auth/session";
import { accountRouter } from "./auth/account";
import { authRouter } from "./auth/routes";
import { requireLogin } from "./auth/requireLogin";


const PORT = Number(process.env.PORT) || 3000;
// The browser (running on your host machine) will connect from the Vite dev
// server's origin. We allow it explicitly so CORS doesn't block the connection.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Route scaffolding for the Server methods in the design diagram.
// Replace these handlers when Room, Participant, and authentication are ready.
function notImplemented(operation: string): RequestHandler {
  return (_req, res) => {
    res.status(501).json({ error: "Not implemented", operation });
  };
}

export function createApp(io : AppServer) {
  const app = express();

  // behind hosting proxy in prod, lets 'secure' cookies work
  if (authConfig.isProduction) {
    app.set("trust proxy", 1);
  }
  // Turn on sessions for every request.
  // Lets the frontend read our answers and send its login cookie. Keep this above every route.
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
  app.use(sessionMiddleware);
  app.use(authRouter);
  app.use(accountRouter);
  // who is logged in?
  app.get("/api/me", requireLogin, (req, res) => {
    res.json({ user: req.session.user });
  });

  app.use(express.json({ limit: "1mb" }));

  // A tiny health-check route so you can confirm the server is up in a browser.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({ name: "LITTLEPOINTERS API", health: "/health" });
  });

  // createRoom(host: RoomHost): string -- body: { host }
  // TODO: Verify the authenticated participant is a RoomHost. 
  // The host is the logged-in user, never an id the browser sends.
  app.post("/api/rooms", requireLogin, async (req, res) => {

      const hostID = String(req.session.user!.id ?? "").trim();

       if (!hostID){ 
          res.status(400).json({error: "Missing HostID. "}); 
          return; 
        }

      const expiresAt : Date =  new Date(Date.now() + 60 * 60 * 1000); // expires every 60 mins WE CAN CHANGE THIS BTW 
      
      try {
        // A random code <roomCode.ts> that no open, live, or saved room uses,
        // so a saved room's code never points at a new room.
        let code : string | null = null;
        for (let tries = 0; tries < 10 && code === null; tries++) {
          const candidate = generateRoomCode();
          if (isLiveRoomCode(candidate)) continue;
          const [inRooms, inPastRooms] = await Promise.all([
            Room.exists({ code: candidate }),
            PastRoom.exists({ code: candidate }),
          ]);
          if (!inRooms && !inPastRooms) code = candidate;
        }
        if (code === null) {
          res.status(500).json({error : "Failed to create room on server."});
          return;
        }

        const createdRoomDoc = await Room.create({
          code, 
          hostID, 
          expiresAt
        }); 
        console.log("Created Room successfully!"); 
        res.status(201).json({code : createdRoomDoc.code}); // return json createdRoom to the frontend. 
      } catch (e){
        console.error(e); 
        res.status(500).json({error : "Failed to create room on server."}); 

      }

  });

  // getRoom(roomCode: string): Room
  app.get("/api/rooms/:roomCode", async (req, res) => { 
    const c : string = req.params.roomCode.trim().toUpperCase(); 

    try { 
      const roomExists = await Room.findOne({code : c}); 
      if (roomExists === null || roomExists.expiresAt.getTime() <= Date.now()){ 
        res.status(404).json({error: "Cannot find room!"}); 
      } else if (!roomExists.isOpen){ 
        // The room exists, but the teacher hasn't clicked Open room yet.
        res.status(409).json({error : "This room isn't open yet."}); 
      } else { 
        res.status(200).json({message: "Joining room!"}); 
      }
    } catch (e){ 
      console.error(e); 
      res.status(500).json({error: "Failed to look up room."}); 
    }
  }
  );

  // deleteRoom(roomCode: string): boolean
  // TODO: Restrict deletion to the room host and disconnect its participants.
  // Only the logged-in user's own rooms can be ended.
  app.delete("/api/rooms/:roomCode", requireLogin, async (req, res) => {
      const c : string = req.params.roomCode.trim().toUpperCase();
      const hostID : string = String(req.session.user!.id ?? "").trim();


        if (!c){
        res.status(400).json({error: "Missing room code."}); 
        return; 
        }

        if (!hostID){ 
          res.status(400).json({error: "Missing HostID. "}); 
          return; 
        }

      try { 
        const deleted = await Room.findOneAndDelete({code : c, hostID : hostID});

        // A room past its 60 minutes has no Room doc but can still be live; its host can still end it.
        if (deleted === null && !isLiveRoomHost(c, hostID)){
          res.status(404).json({error : "Nothing to delete!"});
        } else {
          closeRoom(io,c); 
           res.status(200).json({message : "Successfully deleted room."});
           return; 
        }  
      } catch (e){ 
        console.error(e); 
        res.status(500).json({error: "Failed to delete room from server"}); 
      }

  });

  // Activities a teacher made. createActivity(teacherId, name, type, language, questions)
  app.post("/api/activities", requireLogin, async (req, res) => {
    // The activity belongs to whoever is logged in, never an id the browser sends.
    const parsed = parseActivityInput(req.body, req.session.user!.id);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const created = await Activity.create(parsed.value);
      res.status(201).json({ id: String(created._id), name: created.name, type: created.type, language: created.language ?? null, questionCount: created.questions.length, questions: created.questions.map((q) => q.question), createdAt: created.createdAt });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to save the activity." });
    }
  });

  // listActivities(teacherId): only that teacher's activities, A to Z.
  app.get("/api/activities", requireLogin, async (req, res) => {
    const teacherId = req.session.user!.id; // from the login, never from the browser

    try {
      // Sends only each question's text, for the dashboard's hover preview. Answers (output) and Parsons solutions (initial) stay on the server.
      const found = await Activity.aggregate([
        { $match: { teacherId } },
        { $sort: { name: 1 } },
        { $project: { name: 1, type: 1, language: 1, createdAt: 1, questionCount: { $size: "$questions" }, questions: "$questions.question" } },
      ]);
      res.status(200).json(found.map((a) => ({ id: String(a._id), name: a.name, type: a.type, language: a.language ?? null, questionCount: a.questionCount, questions: a.questions ?? [], createdAt: a.createdAt })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load activities." });
    }
  });

  // getActivity(activityId, teacherId): one activity with its answers, for the teacher who made it.
  //   coding: each question's correct output.
  //   parsons: each question's code and extra lines as the teacher typed them (the create form's
  //     shape, rebuilt from the stored problem), and its settings.
  // Students never reach this: it only answers the activity's own teacher.
  app.get("/api/activities/:activityId", requireLogin, async (req, res) => {
    const activityId = req.params.activityId.trim();
    const teacherId = req.session.user!.id; // from the login, never from the browser

    if (!isObjectIdOrHexString(activityId)) {
      res.status(400).json({ error: "Invalid activity id." });
      return;
    }

    try {
      const found = await Activity.findOne({ _id: activityId, teacherId }).lean();
      if (found === null) {
        res.status(404).json({ error: "Cannot find that activity." });
        return;
      }
      const questions = found.questions.map((q) => {
        if (found.type === "coding") return { question: q.question, output: q.output ?? "" };
        const { code, distractors } = splitInitial(q.initial ?? "");
        return { question: q.question, code, distractors, options: q.options ?? {} };
      });
      res.status(200).json({ id: String(found._id), name: found.name, type: found.type, language: found.language ?? null, createdAt: found.createdAt, questions });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load the activity." });
    }
  });

  // deleteActivity(activityId, teacherId): only the teacher who made it can delete it.
  // Rooms that were using it go back to having no activity.
  app.delete("/api/activities/:activityId", requireLogin, async (req, res) => {
    const activityId = req.params.activityId.trim();
    const teacherId = req.session.user!.id; // from the login, never from the browser

    if (!isObjectIdOrHexString(activityId)) {
      res.status(400).json({ error: "Invalid activity id." });
      return;
    }

    try {
      const deleted = await Activity.findOneAndDelete({ _id: activityId, teacherId });
      if (deleted === null) {
        res.status(404).json({ error: "Cannot find that activity." });
        return;
      }
      await Room.updateMany({ activityId }, { activityId: null });
      // The teacher's note on it goes with it.
      await deleteActivityNote(activityId, teacherId);
      res.status(200).json({ message: "Deleted activity." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to delete the activity." });
    }
  });

  // Sets which activity a room uses. Only the room's host can change it, and
  // only with an activity they made, while the room is still open.
  app.put("/api/rooms/:roomCode/activity", requireLogin, async (req, res) => {
    const c : string = req.params.roomCode.trim().toUpperCase();
    const hostID = req.session.user!.id; // from the login, never from the browser
    const activityId = typeof req.body?.activityId === "string" ? req.body.activityId.trim() : "";
    if (!isObjectIdOrHexString(activityId)) {
      res.status(400).json({ error: "Choose an activity." });
      return;
    }

    try {
      const owned = await Activity.exists({ _id: activityId, teacherId: hostID });
      if (!owned) {
        res.status(403).json({ error: "You can only use activities you made." });
        return;
      }

      const updated = await Room.findOneAndUpdate(
        { code: c, hostID, expiresAt: { $gt: new Date() } },
        { activityId }
      );
      if (updated === null) {
        res.status(404).json({ error: "Cannot find room!" });
      } else {
        res.status(200).json({ message: "Saved activity." });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to save activity." });
    }
  });

// toggle open flags on the room to prevent early student joins. teacher clicks open room, students can join afterwards. 
  app.put("/api/rooms/:roomCode/open", requireLogin, async (req, res) => { 
    const c : string = req.params.roomCode.trim().toUpperCase();
    const hostID = req.session.user!.id; // from the login, never from the browser
    const activityId = typeof req.body?.activityId === "string" ? req.body.activityId.trim() : "";
    if (!isObjectIdOrHexString(activityId)) {
      res.status(400).json({ error: "Choose an activity." });
      return;
    }

    try { 
      const updated = await Room.findOneAndUpdate( 
        {code : c, hostID, expiresAt: { $gt: new Date() }, activityId}, { isOpen : true }
      ); 
      if (updated === null){
        res.status(404).json({error : "Cannot find room!"});

      } else {
        // The room now counts as running (dashboard, saving when it ends).
        markLiveRoomOpened(c);
        res.status(200).json({ message : "Opened room."});
        io.to(lobbyChannel(c)).emit("room opened");
      }
    } catch (e){ 
      console.error(e); 
      res.status(500).json({error: "Failed to open room."}); 
    }
  }); 


  // joinRoom(ID: string, user: Participant): boolean -- body: { user }
  // TODO: Check the room code and capacity before adding the participant.
  app.post("/api/rooms/:roomCode/join", notImplemented("joinRoom"));

  // authenticate(user: string, password: string): boolean
  // Body: { user, password }. TODO: Validate credentials using the auth service.
  app.post("/api/auth/login", notImplemented("authenticate"));

  // The logged-in teacher's rooms that are still running (opened and not
  // ended), newest first, so the dashboard can offer to rejoin or end them.
  // A room keeps running when the teacher closes their tab or loses their
  // connection; only End room (DELETE /api/rooms/:code) or expiry ends it.
  app.get("/api/active-rooms", requireLogin, async (req, res) => {
    try {
      res.status(200).json(await activeRoomsForHost(io, req.session.user!.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load your running rooms." });
    }
  });

  // Previous activities: the rooms the logged-in teacher ran that have ended,
  // newest first. Uses the session's user id, never one the browser sends.
  app.get("/api/past-rooms", requireLogin, async (req, res) => {
    try {
      res.status(200).json(await pastRoomsForHost(req.session.user!.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load previous activities." });
    }
  });

  // Dashboard stats: every room the logged-in teacher ended. Read from RoomLog, so deleting
  // a previous activity does not change these.
  app.get("/api/room-stats", requireLogin, async (req, res) => {
    try {
      res.status(200).json(await roomStatsForHost(req.session.user!.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load your room stats." });
    }
  });

  // One ended room of the logged-in teacher, with every student's saved work and the chats.
  app.get("/api/past-rooms/:roomCode", requireLogin, async (req, res) => {
    try {
      const room = await pastRoomForHost(req.params.roomCode, req.session.user!.id);
      if (room === null) {
        res.status(404).json({ error: "Cannot find that room." });
        return;
      }
      res.status(200).json(room);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load that room." });
    }
  });

  // Deletes one ended room of the logged-in teacher. A teacher can only delete their own rooms.
  app.delete("/api/past-rooms/:roomCode", requireLogin, async (req, res) => {
    try {
      const deleted = await deletePastRoomForHost(req.params.roomCode, req.session.user!.id);
      if (!deleted) {
        res.status(404).json({ error: "Cannot find that room." });
        return;
      }
      res.status(200).json({ message: "Deleted." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to delete that room." });
    }
  });

  // ---------- Teacher notes (see notes.ts) ----------
  // Private to the logged-in teacher: every route uses the session's user id,
  // never one the browser sends, and checks the activity or room is theirs.

  // Every note of the logged-in teacher, most recently changed first.
  app.get("/api/notes", requireLogin, async (req, res) => {
    try {
      res.status(200).json(await notesForTeacher(req.session.user!.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load your notes." });
    }
  });

  // The note on one of the logged-in teacher's activities.
  app.get("/api/notes/activities/:activityId", requireLogin, async (req, res) => {
    try {
      const note = await activityNoteFor(req.params.activityId.trim(), req.session.user!.id);
      if (note === null) {
        res.status(404).json({ error: "Cannot find that activity." });
        return;
      }
      res.status(200).json(note);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load your note." });
    }
  });

  // Saves the note on one of the logged-in teacher's activities. Body: { text }.
  // Empty text deletes the note.
  app.put("/api/notes/activities/:activityId", requireLogin, async (req, res) => {
    const parsed = parseNoteText(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      const saved = await saveActivityNoteFor(req.params.activityId.trim(), req.session.user!.id, parsed.text);
      if (saved === null) {
        res.status(404).json({ error: "Cannot find that activity." });
        return;
      }
      res.status(200).json(saved);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to save your note." });
    }
  });

  // A room's notes: the room's own note, and the note on the activity it uses.
  // Works while the room is being set up, while it's live, and once it's saved.
  app.get("/api/notes/rooms/:roomCode", requireLogin, async (req, res) => {
    try {
      const notes = await roomNotesFor(req.params.roomCode, req.session.user!.id);
      if (notes === null) {
        res.status(404).json({ error: "Cannot find that room." });
        return;
      }
      res.status(200).json(notes);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load your notes." });
    }
  });

  // Saves a room's own note. Body: { text }. Empty text deletes the note.
  app.put("/api/notes/rooms/:roomCode", requireLogin, async (req, res) => {
    const parsed = parseNoteText(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      const saved = await saveRoomNoteFor(req.params.roomCode, req.session.user!.id, parsed.text);
      if (saved === null) {
        res.status(404).json({ error: "Cannot find that room." });
        return;
      }
      res.status(200).json(saved);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to save your note." });
    }
  });

  // onConnect/onDisconnect are registered in socket.ts. generateRoomCode and
  // logEvent are internal helpers, not public HTTP endpoints.
  app.use(express.static("client"));

  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
    console.error("[server] request failed:", err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(handleError);

  return app;
}

async function main() {
  await connectToDatabase();

  // Copies rooms saved before RoomLog existed. Rooms already copied are skipped.
  try {
    const copied = await backfillRoomLogs();
    if (copied > 0) console.log(`[room-stats] copied ${copied} earlier room(s) into the room log`);
  } catch (err) {
    console.error("[room-stats] failed to copy earlier rooms:", err);
  }


const io : AppServer = new Server({ 
  // credentials lets the browser send the login cookie with the socket.
  cors : { origin : CLIENT_ORIGIN, methods : ["GET", "POST"], credentials : true }, 
})
  const app = createApp(io);
  // Express only handles the HTTP handler; Socket.IO needs the raw http server.
  const server = createServer(app);
  io.attach(server); 
  // Sockets read the same login session as HTTP routes, e.g. a teacher's picture.
  // io.engine only exists after attach(), so this must come after it.
  io.engine.use(sessionMiddleware); 

  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[server] startup failed:", err);
    process.exitCode = 1;
  });
}