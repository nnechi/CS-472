import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './../routes/auth.css';

type AuthCardProps = {
  title: string;
  children: ReactNode; 
};

export default function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Link to="/" className="auth-wordmark">LittlePointers</Link>
        </div>
        <h1 className="auth-title">{title}</h1>
        {children}
      </div>
    </div>
  );
}