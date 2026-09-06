'use client';
import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { request } from '@/lib/client';
export default function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-wrap">
      <section className="login-art">
        <div style={{ fontSize: 25, fontWeight: 800 }}>clever clouds.</div>
        <div>
          <div className="eyebrow" style={{ color: '#bcd0ff' }}>
            YOUR CONTENT WORKSPACE
          </div>
          <h1>
            LET’S MAKE
            <br />
            EVERY POST
            <br />
            <mark>AMAZING.</mark>
          </h1>
        </div>
        <p style={{ color: '#ccd9ff', fontSize: 14 }}>
          Plan with purpose. Create with confidence.
        </p>
      </section>
      <section className="login-form">
        <div>
          <LockKeyhole size={26} color="#1043db" />
          <h2 style={{ marginTop: 20, fontSize: 28 }}>Welcome back.</h2>
          <p>Sign in to the Clever Clouds workspace.</p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const data = new FormData(e.currentTarget);
              try {
                await request('/api/auth', 'POST', Object.fromEntries(data));
                onLogin();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                placeholder="Your workspace email"
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button disabled={busy} className="primary-button">
              {busy ? 'Signing in…' : 'Sign in'}
              <ArrowRight />
            </button>
          </form>
          <p className="small" style={{ marginTop: 28 }}>
            Private access · Clever Clouds team
          </p>
        </div>
      </section>
    </div>
  );
}
