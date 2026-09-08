import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';

type Mode = 'login' | 'signup';

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setToken = useAppStore(state => state.setToken);
  const setUser = useAppStore(state => state.setUser);
  const token = useAppStore(state => state.token);

  // Read mode from hash query string e.g. #/auth?mode=signup
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('mode=signup')) setMode('signup');
    else setMode('login');
  }, []);

  // Already logged in — go to studio
  useEffect(() => {
    if (token) {
      window.location.hash = '#/studio';
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (loginError) throw loginError;
        setToken(data.session?.access_token || null);
        const u = data.user;
        setUser(u ? {
          id: u.id,
          email: u.email || '',
          name: u.user_metadata?.name || '',
          credits: u.user_metadata?.credits || 0,
          videos_used: u.user_metadata?.videos_used || 0
        } : null);
      } else {
        if (!name.trim()) {
          setError('Please enter your name.');
          setIsLoading(false);
          return;
        }
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name
            }
          }
        });
        if (signupError) throw signupError;
        setToken(data.session?.access_token || null);
        const u = data.user;
        setUser(u ? {
          id: u.id,
          email: u.email || '',
          name: u.user_metadata?.name || '',
          credits: u.user_metadata?.credits || 0,
          videos_used: u.user_metadata?.videos_used || 0
        } : null);
      }

      // Redirect to Studio
      window.location.hash = '#/studio';
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const toggleMode = () => {
    setError(null);
    const next = mode === 'login' ? 'signup' : 'login';
    setMode(next);
    window.location.hash = `#/auth?mode=${next}`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0d0e12' }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,183,125,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#1a1b20',
          borderRadius: '1.25rem',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '2.5rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <a
            href="#/"
            style={{
              display: 'inline-block',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 900,
              fontSize: '1rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#ffb77d',
              textDecoration: 'none',
              marginBottom: '1.5rem',
            }}
          >
            MOTION SUBTITLE
          </a>

          <h1
            style={{
              color: '#e3e2e7',
              fontSize: '1.5rem',
              fontWeight: 700,
              marginTop: '1rem',
              marginBottom: '0.5rem',
            }}
          >
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem' }}>
            {mode === 'login'
              ? 'Log in to access the Studio'
              : 'Get started for free — 300 credits included'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '0.75rem',
              padding: '0.875rem 1rem',
              marginBottom: '1.25rem',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-name"
                style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: 500 }}
              >
                Name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '0.75rem',
                  color: '#e3e2e7',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#ffb77d')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: 500 }}
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '0.75rem',
                color: '#e3e2e7',
                fontSize: '0.9375rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = '#ffb77d')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: '0.4rem', fontWeight: 500 }}
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '0.75rem',
                color: '#e3e2e7',
                fontSize: '0.9375rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = '#ffb77d')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.875rem',
              background: isLoading ? 'rgba(255,183,125,0.5)' : '#ffb77d',
              color: '#4d2600',
              borderRadius: '0.75rem',
              fontWeight: 700,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
          >
            {isLoading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Toggle */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '0.875rem',
          }}
        >
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={toggleMode}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffb77d',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.875rem',
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
