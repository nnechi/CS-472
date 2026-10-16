import { Schema, model, InferSchemaType } from "mongoose";

// Room has a code, host, and TTL configuration. Automatic timestamp tracking.  

const RoomSchema = new Schema( 
 { 
    code : { type : String, required : true, trim : true, uppercase : true, unique:true},
    hostID : { type : String, required : true}, 
    expiresAt : { type : Date, required : true}

 }, 

 { 
    timestamps : true

 }
).index( { expiresAt: 1}, {expireAfterSeconds : 0}); 


export type RoomDoc = InferSchemaType<typeof RoomSchema>;


export const Room = model("Room", RoomSchema);
