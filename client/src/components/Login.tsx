import { FormEvent, useState } from "react";

interface LoginProps {
  onJoin: (username: string) => void;
}

export default function Login({ onJoin }: LoginProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onJoin(trimmed);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>CS HELP TOOL</h1>
        <p>Pick a username to join the room.</p>
        <input
          className="login-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your username"
          maxLength={32}
          autoFocus
        />
        <button className="login-button" type="submit">
          Join chat
        </button>
      </form>
    </div>
  );
}
