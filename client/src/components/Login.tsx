import { FormEvent, useState } from "react";
import { Role } from "../types";

interface LoginProps {
  onJoin: (payload: { username: string; role: Role; room: string }) => void;
}

export default function Login({ onJoin }: LoginProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student"); // student by default
  const [room, setRoom] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    // Students must supply a room code; teachers get one generated for them.
    if (role === "student" && !room.trim()) return;
    onJoin({
      username: trimmedName,
      role,
      room: room.trim().toUpperCase(),
    });
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>CS HELP TOOL</h1>
        <p>Pick a username to join the room.</p>

        {/* Role toggle: Student (default) or Teacher */}
        <div className="role-toggle">
          <button
            type="button"
            className={role === "student" ? "role active" : "role"}
            onClick={() => setRole("student")}
          >
            Student
          </button>
          <button
            type="button"
            className={role === "teacher" ? "role active" : "role"}
            onClick={() => setRole("teacher")}
          >
            Teacher
          </button>
        </div>

        <input
          className="login-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your username"
          maxLength={32}
          autoFocus
        />

        {role === "student" && (
          <input
            className="login-input"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Room code"
            maxLength={8}
          />
        )}

        <button className="login-button" type="submit">
          {role === "teacher" ? "Create room" : "Join room"}
        </button>
      </form>
    </div>
  );
}
