import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import StreamersPage from './pages/StreamersPage';
import LeaderboardPage from './pages/LeaderboardPage';
import GamePage from './pages/GamePage';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    testConnection();
    checkAuthStatus();
    handleAuthCallback();
  }, []);

  const testConnection = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').limit(1);
      console.log('✅ Base de données connectée !', data);
      setConnected(true);
    } catch (err) {
      console.log('Erreur:', err.message);
    }
    setLoading(false);
  };

  // Vérifier si l'utilisateur est connecté via Twitch
  const checkAuthStatus = () => {
    const twitchToken = localStorage.getItem('twitch_access_token');
    const twitchUser = localStorage.getItem('twitch_user');
    
    if (twitchToken && twitchUser) {
      setUser(JSON.parse(twitchUser));
      setIsAuthenticated(true);
    }
  };

  // Configuration Twitch OAuth
  const TWITCH_CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;
  const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;
  const SCOPES = 'user:read:email user:read:subscriptions user:read:follows';

  // Générer l'URL d'autorisation Twitch
  const generateTwitchAuthUrl = () => {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('twitch_auth_state', state);
    
    const params = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      state: state
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  };

  // Gérer la connexion Twitch
  const handleTwitchLogin = () => {
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const authUrl = generateTwitchAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Erreur lors de la redirection vers Twitch:', err);
      setAuthError('Erreur lors de la redirection vers Twitch');
      setAuthLoading(false);
    }
  };

  // Traiter le callback d'authentification
  const handleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('twitch_auth_state');

    if (code && state && state === storedState) {
      setAuthLoading(true);
      
      try {
        // Échanger le code contre un token d'accès
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: TWITCH_CLIENT_ID,
            client_secret: process.env.REACT_APP_TWITCH_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
          })
        });

        if (!tokenResponse.ok) {
          throw new Error('Erreur lors de l\'échange du token');
        }

        const tokenData = await tokenResponse.json();
        
        // Récupérer les informations utilisateur
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Client-Id': TWITCH_CLIENT_ID
          }
        });

        if (!userResponse.ok) {
          throw new Error('Erreur lors de la récupération des données utilisateur');
        }

        const userData = await userResponse.json();
        const twitchUser = userData.data[0];

        // Stocker les informations utilisateur
        localStorage.setItem('twitch_access_token', tokenData.access_token);
        localStorage.setItem('twitch_user', JSON.stringify(twitchUser));
        
        setUser(twitchUser);
        setIsAuthenticated(true);
        
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
      } catch (err) {
        console.error('Erreur lors de la connexion:', err);
        setAuthError('Erreur lors de la connexion : ' + err.message);
      } finally {
        setAuthLoading(false);
        localStorage.removeItem('twitch_auth_state');
      }
    }
  };

  // Fonction de déconnexion
  const handleLogout = () => {
    localStorage.removeItem('twitch_access_token');
    localStorage.removeItem('twitch_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className="App">
        <Header 
          user={user}
          onLogout={handleLogout}
          onLogin={handleTwitchLogin}
          isLoading={authLoading}
          authError={authError}
        />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage user={user} />} />
            <Route path="/streamers" element={<StreamersPage user={user} />} />
            <Route path="/leaderboard" element={<LeaderboardPage user={user} />} />
            <Route path="/game" element={<GamePage user={user} />} />
            <Route path="/auth/callback" element={<HomePage user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;