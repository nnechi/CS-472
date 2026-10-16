export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// api middleware to communicate to room service. 
export async function createRoom(hostID : string) : Promise<string>{ 
    const res = await fetch( `${SERVER_URL}/api/rooms`,  { 
        method:"POST", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify({hostID})
    }); 


    if (res.ok){
        const data = await res.json(); 
        return data.code; 
    } 
     return "";  // dunno what to return here TBD 


}