import React, { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import { AuthPage } from './pages/AuthPage';
import { RenderView } from './components/studio/render-view';
import { useAppStore } from './lib/store';
import { api } from './lib/api';
import { supabase } from './lib/supabase';

function App() {
  const [route, setRoute] = useState(window.location.hash || '#/');
  const setUser = useAppStore(state => state.setUser);
  const setToken = useAppStore(state => state.setToken);
  const token = useAppStore(state => state.token);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Hydrate user from Supabase session
  useEffect(() => {
    // Initial fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null);
      if (session) {
        api.getMe()
          .then(res => setUser(res.user))
          .catch(() => {
            setToken(null);
            setUser(null);
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || null);
      if (session) {
        api.getMe()
          .then(res => setUser(res.user))
          .catch(() => {
            setToken(null);
            setUser(null);
          });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Studio route — requires authentication
  if (route.startsWith('#/studio')) {
    if (!token) {
      // No token: redirect to login
      window.location.hash = '#/auth?mode=login';
      return null;
    }
    return <StudioPage />;
  }

  // Auth route
  if (route.startsWith('#/auth')) {
    return <AuthPage />;
  }

  // Headless Render route
  if (route.startsWith('#/render')) {
    return <RenderView />;
  }

  // Fallback to Home
  return <HomePage />;
}

export default App;
