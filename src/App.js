import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Header from './components/Header';
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
      const { data, error } = await supabase.from('streamers').select('*').limit(1);
      console.log('✅ Tables créées !', data);
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
  const SCOPES = 'user:read:email user:read:subscriptions';

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
    <div className="App">
      <Header 
        user={user}
        onLogout={handleLogout}
        onLogin={handleTwitchLogin}
        isLoading={authLoading}
        authError={authError}
      />

      <main className="main-content">
        {/* Section d'accueil */}
        <section className="hero-section">
          <div className="hero-content">
            <h2>Bienvenue sur Pauvrathon !</h2>
            <p>La plateforme dédiée aux streamers et à leur communauté</p>
            
            {/* Status de connexion */}
            <div className="status-cards">
              <div className={`status-card ${connected ? 'success' : 'error'}`}>
                <div className="status-icon">
                  {loading ? '⏳' : connected ? '✅' : '❌'}
                </div>
                <div className="status-text">
                  <h4>Base de données</h4>
                  <p>{loading ? 'Connexion...' : connected ? 'Connectée' : 'Erreur'}</p>
                </div>
              </div>
              
              <div className={`status-card ${isAuthenticated ? 'success' : 'neutral'}`}>
                <div className="status-icon">
                  {authLoading ? '⏳' : isAuthenticated ? '🎮' : '👤'}
                </div>
                <div className="status-text">
                  <h4>Authentification</h4>
                  <p>
                    {authLoading ? 'Connexion...' : 
                     isAuthenticated ? `Connecté en tant que ${user?.display_name}` : 
                     'Non connecté'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu conditionnel */}
            {isAuthenticated ? (
              <div className="user-dashboard">
                <h3>Tableau de bord</h3>
                <div className="dashboard-cards">
                  <div className="dashboard-card">
                    <h4>Profil Twitch</h4>
                    <div className="profile-info">
                      <img src={user.profile_image_url} alt={user.display_name} className="profile-image" />
                      <div>
                        <p><strong>Nom :</strong> {user.display_name}</p>
                        <p><strong>Type :</strong> {user.type}</p>
                        <p><strong>Créé le :</strong> {new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="dashboard-card">
                    <h4>Statistiques</h4>
                    <p>Vos stats apparaîtront ici...</p>
                  </div>
                  
                  <div className="dashboard-card">
                    <h4>Événements récents</h4>
                    <p>Aucun événement pour le moment</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="welcome-message">
                <h3>Rejoignez la communauté !</h3>
                <p>Connectez-vous avec votre compte Twitch pour accéder à toutes les fonctionnalités.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;