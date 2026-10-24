import express, { ErrorRequestHandler, RequestHandler } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { connectToDatabase } from "./db";
import {AppServer, closeRoom,  registerSocketHandlers } from "./socket";


import { generateRoomCode } from "./utils/roomCode"; 
import {Room} from "./models/Room"
import {Activity} from "./models/Activity"

import { authConfig } from "./auth/config";
import { parseActivityInput } from "./activityInput";
import { isObjectIdOrHexString } from "mongoose";

import { sessionMiddleware } from "./auth/session";
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
  app.use(sessionMiddleware);
  app.use(authRouter);
  // who is logged in?
  app.get("/api/me", requireLogin, (req, res) => {
    res.json({ user: req.session.user });
  });

  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());

  // A tiny health-check route so you can confirm the server is up in a browser.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({ name: "LITTLEPOINTERS API", health: "/health" });
  });

  // createRoom(host: RoomHost): string -- body: { host }
  // TODO: Verify the authenticated participant is a RoomHost. 
  app.post("/api/rooms", async (req, res) => { 
    
      const code : string = generateRoomCode(); // generate a random code <roomCode.ts> 
      let hostID = req.body.hostID;

      if (typeof(hostID) !== "string"){ 
        console.error("Invalid Value"); 
        res.status(400).json({error : "Room Creation Error: Invalid Value"}); 
        return; 
      }

      hostID = hostID.trim(); 

       if (!hostID){ 
          res.status(400).json({error: "Missing HostID. "}); 
          return; 
        }

      const expiresAt : Date =  new Date(Date.now() + 60 * 60 * 1000); // expires every 60 mins WE CAN CHANGE THIS BTW 
      
      try { 
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
  app.delete("/api/rooms/:roomCode", async (req, res) => { 
      const c : string = req.params.roomCode.trim().toUpperCase(); 
      let hostID : string = req.body.hostID; 

      if (typeof(hostID) !== "string"){
        res.status(400).json({error : "hostID must be a string."}); 
        return; 
      }
      hostID = hostID.trim(); 


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

        if (deleted === null){ 
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
  app.post("/api/activities", async (req, res) => {
    const parsed = parseActivityInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const created = await Activity.create(parsed.value);
      res.status(201).json({ id: String(created._id), name: created.name, type: created.type });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to save the activity." });
    }
  });

  // listActivities(teacherId): only that teacher's activities, A to Z.
  app.get("/api/activities", async (req, res) => {
    const teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId.trim() : "";

    if (!teacherId) {
      res.status(400).json({ error: "Missing teacher id." });
      return;
    }

    try {
      const found = await Activity.find({ teacherId }).sort({ name: 1 }).select("name type").lean();
      res.status(200).json(found.map((a) => ({ id: String(a._id), name: a.name, type: a.type })));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to load activities." });
    }
  });

  // Sets which activity a room uses. Only the room's host can change it, and
  // only with an activity they made, while the room is still open.
  app.put("/api/rooms/:roomCode/activity", async (req, res) => {
    const c : string = req.params.roomCode.trim().toUpperCase();
    const hostID = typeof req.body?.hostID === "string" ? req.body.hostID.trim() : "";
    const activityId = typeof req.body?.activityId === "string" ? req.body.activityId.trim() : "";

    if (!hostID) {
      res.status(400).json({ error: "Missing HostID." });
      return;
    }
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

  // joinRoom(ID: string, user: Participant): boolean -- body: { user }
  // TODO: Check the room code and capacity before adding the participant.
  app.post("/api/rooms/:roomCode/join", notImplemented("joinRoom"));

  // authenticate(user: string, password: string): boolean
  // Body: { user, password }. TODO: Validate credentials using the auth service.
  app.post("/api/auth/login", notImplemented("authenticate"));

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


const io : AppServer = new Server({ 
  cors : { origin : CLIENT_ORIGIN, methods : ["GET", "POST"]}, 
})

    const app = createApp(io);
    // Express only handles the HTTP handler; Socket.IO needs the raw http server.
    const server = createServer(app);
    io.attach(server); 


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
