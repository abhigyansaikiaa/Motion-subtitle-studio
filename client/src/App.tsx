import React, { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import { AuthPage } from './pages/AuthPage';
import { RenderView } from './components/studio/render-view';
import { useAppStore } from './lib/store';
import { api } from './lib/api';

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

  // Hydrate user from persisted token on startup
  useEffect(() => {
    if (token) {
      api.getMe()
        .then(res => setUser(res.user))
        .catch(() => {
          // Token is invalid/expired — clear it so user is prompted to log in again
          setToken(null);
          setUser(null);
        });
    }
  }, []); // Run once on mount only

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
