import "./global-variables.css";
import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { supabase } from "./lib/supabase";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import StreamersPage from "./pages/StreamersPage";
import DiscoverPage from "./pages/DiscoverPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import GamePage from "./pages/GamePage";
import ParticipationPage from "./pages/ParticipationPage";
import StreamerRequestsPage from "./pages/StreamerRequestsPage";
import StreamerRequestForm from "./pages/StreamerRequestForm";
import "./App.css";
import AdminPanel from "./components/AdminPanel";
import UserStatsPage from "./pages/UserStatsPage";

// ===== FONCTIONS DE SÉCURITÉ DES TOKENS =====
const storeSecureTokens = (tokenData, twitchUser) => {
  const expirationTime = Date.now() + 3600 * 1000; // 1 heure

  const secureTokenData = {
    access_token: tokenData.access_token,
    expires_at: expirationTime,
    user: twitchUser,
    stored_at: Date.now(),
  };

  localStorage.setItem("twitch_session", JSON.stringify(secureTokenData));
  console.log("🔒 Token stocké avec expiration:", new Date(expirationTime));
};

const getSecureTokens = () => {
  try {
    const storedData = localStorage.getItem("twitch_session");
    if (!storedData) return null;

    const sessionData = JSON.parse(storedData);

    if (Date.now() > sessionData.expires_at) {
      console.log("⏰ Session expirée, nettoyage...");
      localStorage.removeItem("twitch_session");
      return null;
    }

    if (!sessionData.access_token || !sessionData.user) {
      console.log("❌ Session corrompue, nettoyage...");
      localStorage.removeItem("twitch_session");
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error("Erreur lecture session:", error);
    localStorage.removeItem("twitch_session");
    return null;
  }
};

const clearSecureTokens = () => {
  localStorage.removeItem("twitch_session");
  localStorage.removeItem("twitch_access_token");
  localStorage.removeItem("twitch_user");
  localStorage.removeItem("twitch_auth_state");
  console.log("🧹 Session nettoyée");
};

function App() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  useEffect(() => {
    testConnection();
    checkAuthStatus();
    handleAuthCallback();
  }, []);

  useEffect(() => {
    if (user) {
      checkUserRole(user);
    } else {
      setUserRole(null);
    }
  }, [user]);

  const testConnection = async () => {
    try {
      const { data } = await supabase.from("users").select("*").limit(1);
      console.log("✅ Base de données connectée !", data);
      setConnected(true);
    } catch (err) {
      console.log("Erreur:", err.message);
    }
    setLoading(false);
  };

  // Vérifier si l'utilisateur est connecté via Twitch (VERSION SÉCURISÉE)
  const checkAuthStatus = () => {
    const sessionData = getSecureTokens();
    if (sessionData) {
      setUser(sessionData.user);
      setIsAuthenticated(true);
      console.log("✅ Session valide trouvée");
    } else {
      setUser(null);
      setIsAuthenticated(false);
      console.log("❌ Aucune session valide");
    }
  };

  // Configuration Twitch OAuth
  const TWITCH_CLIENT_ID = process.env.REACT_APP_TWITCH_CLIENT_ID;
  const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;
  const SCOPES = "user:read:email user:read:follows";

  // Générer l'URL d'autorisation Twitch
  const generateTwitchAuthUrl = () => {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem("twitch_auth_state", state);

    const params = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      state: state,
    });

    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  };

  // Gérer la connexion Twitch
  const handleTwitchLogin = () => {
    setAuthLoading(true);
    setAuthError("");

    try {
      const authUrl = generateTwitchAuthUrl();
      console.log("🚀 Redirection vers Twitch:", authUrl);
      window.location.href = authUrl;
    } catch (err) {
      console.error("Erreur lors de la redirection vers Twitch:", err);
      setAuthError("Erreur lors de la redirection vers Twitch");
      setAuthLoading(false);
    }
  };

  // Échanger le code d'autorisation contre un token d'accès
  const exchangeCodeForToken = async (code) => {
    const response = await fetch("/api/auth/twitch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    return await response.json();
  };

  // Récupérer les informations utilisateur de l'API Twitch
  const fetchTwitchUser = async (accessToken) => {
    const response = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": TWITCH_CLIENT_ID,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API Twitch: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0];
  };

  // Créer ou mettre à jour l'utilisateur en base de données
  const upsertUser = async (twitchUser, accessToken) => {
    const userData = {
      twitch_user_id: twitchUser.id,
      twitch_username: twitchUser.login,
      twitch_display_name: twitchUser.display_name,
      profile_image_url: twitchUser.profile_image_url,
      email: twitchUser.email,
      access_token: accessToken,
      last_login: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("users").upsert(userData, {
      onConflict: "twitch_user_id",
      returning: "minimal",
    });

    if (error) {
      console.error("Erreur lors de la sauvegarde utilisateur:", error);
      throw error;
    }

    return userData;
  };

  // Traiter le callback d'authentification
  const handleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const storedState = localStorage.getItem("twitch_auth_state");

    if (code && state && state === storedState) {
      setAuthLoading(true);
      setAuthError("");

      try {
        console.log("🔄 Code d'autorisation reçu:", code);

        // 1. Échanger le code contre un token d'accès
        console.log("🔄 Échange du code contre un token...");
        const tokenData = await exchangeCodeForToken(code);

        // 2. Récupérer les informations utilisateur
        console.log("🔄 Récupération des données utilisateur...");
        const twitchUser = await fetchTwitchUser(tokenData.access_token);

        // 3. Sauvegarder en base de données
        console.log("🔄 Sauvegarde en base de données...");
        await upsertUser(twitchUser, tokenData.access_token);

        // 4. Stocker la session localement
        console.log("🔄 Création de la session locale...");
        storeSecureTokens(tokenData, twitchUser);

        // 5. Mettre à jour l'état de l'application
        setUser(twitchUser);
        setIsAuthenticated(true);

        console.log("✅ Connexion réussie !");
        console.log("👤 Utilisateur connecté:", twitchUser.display_name);

        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error("❌ Erreur lors de la connexion:", err);
        setAuthError("Erreur lors de la connexion : " + err.message);
      } finally {
        setAuthLoading(false);
        localStorage.removeItem("twitch_auth_state");
      }
    }
  };

  // Fonction de déconnexion (VERSION SÉCURISÉE)
  const handleLogout = () => {
    clearSecureTokens();
    setUser(null);
    setIsAuthenticated(false);
    setUserRole(null);
    console.log("👋 Déconnexion sécurisée effectuée");
  };

  // Fonction pour vérifier le rôle depuis la base de données
  const checkUserRole = async (user) => {
    if (!user) {
      setUserRole(null);
      return false;
    }

    setIsAdminLoading(true);

    try {
      const { data: userData, error } = await supabase
        .from("users")
        .select("role")
        .eq("twitch_user_id", user.id)
        .single();

      if (error || !userData) {
        console.log("❌ Utilisateur non trouvé en base:", error);
        setUserRole("viewer");
        return false;
      }

      console.log("🔍 Rôle utilisateur depuis la base:", userData.role);
      setUserRole(userData.role);
      return userData.role === "admin";
    } catch (error) {
      console.error("Erreur vérification rôle:", error);
      setUserRole("viewer");
      return false;
    } finally {
      setIsAdminLoading(false);
    }
  };

  const isAdmin = () => {
    return userRole === "admin";
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
          isAdmin={isAdmin}
        />

        <main className="main-content">
          <Routes>
            {/* Pages publiques */}
            <Route path="/" element={<HomePage user={user} />} />
            <Route path="/streamers" element={<StreamersPage user={user} />} />
            <Route path="/discover" element={<DiscoverPage user={user} />} />
            <Route
              path="/leaderboard"
              element={<LeaderboardPage user={user} />}
            />
            <Route path="/game" element={<GamePage user={user} />} />
            {/* Page de participation */}
            <Route
              path="/participate/:streamerId"
              element={<ParticipationPage user={user} />}
            />
            {/* Pages d'authentification */}
            <Route path="/auth/callback" element={<HomePage user={user} />} />
            {/* Pages utilisateur */}
            <Route
              path="/profile/stats"
              element={<UserStatsPage user={user} />}
            />
            <Route
              path="/request-streamer"
              element={<StreamerRequestForm user={user} />}
            />
            {/* Pages admin */}
            <Route
              path="/admin"
              element={
                isAdmin() ? (
                  <AdminPanel user={user} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/admin/requests"
              element={
                isAdmin() ? (
                  <StreamerRequestsPage user={user} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            {/* Redirection par défaut */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;