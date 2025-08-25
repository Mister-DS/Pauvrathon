import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import LoginModal from "./LoginModal";
import "./Header.css";

const Header = ({ user, onLogout, onLogin, isLoading, authError, isAdmin }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Déterminer le rôle de l'utilisateur
  const getUserRole = () => {
    if (!user) return null;
    if (isAdmin && isAdmin(user)) {
      return "admin";
    }
    return "viewer";
  };

  const userRole = getUserRole();

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleModalLogin = () => {
    setShowLoginModal(false);
    onLogin(); // ✅ utilise la fonction de login réelle
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleUserDropdown = () => setShowUserDropdown(!showUserDropdown);

  const handleLogout = () => {
    setShowUserDropdown(false);
    onLogout();
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <div className="header-logo">
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <h1>🎮 Pauvrathon</h1>
          </Link>
        </div>

        {/* Navigation Desktop */}
        <nav className="header-nav desktop-nav">
          <a href="/" className="nav-link">Accueil</a>
          <a href="/streamers" className="nav-link">Streamers</a>
          <a href="/discover" className="nav-link">Découvrir</a>
          <a href="/leaderboard" className="nav-link">Classement</a>
        </nav>

        {/* Section utilisateur */}
        <div className="header-user">
          {user ? (
            <div className="user-section" ref={dropdownRef}>
              <div className="user-profile" onClick={toggleUserDropdown}>
                <img
                  src={user.profile_image_url}
                  alt={user.display_name}
                  className="user-avatar"
                />
                <span className="user-name">{user.display_name}</span>
                <svg
                  className={`dropdown-arrow ${showUserDropdown ? "rotated" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {showUserDropdown && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <img
                      src={user.profile_image_url}
                      alt={user.display_name}
                      className="dropdown-avatar"
                    />
                    <div className="dropdown-user-info">
                      <span className="dropdown-name">{user.display_name}</span>
                      <span className="dropdown-role">
                        {userRole === "admin"
                          ? "👑 Administrateur"
                          : userRole === "streamer"
                          ? "🎬 Streamer"
                          : "👤 Viewer"}
                      </span>
                    </div>
                  </div>

                  <div className="dropdown-divider"></div>

                  <div className="dropdown-menu">
                    <Link to="/profile/stats" className="dropdown-item" onClick={() => setShowUserDropdown(false)}>
                      <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Mes statistiques
                    </Link>

                    {userRole === "viewer" && (
                      <Link to="/request-streamer" className="dropdown-item" onClick={() => setShowUserDropdown(false)}>
                        <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Devenir streamer
                      </Link>
                    )}

                    {userRole === "admin" && (
                      <>
                        <Link to="/admin" className="dropdown-item" onClick={() => setShowUserDropdown(false)}>
                          <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Mon panneau Pauvrathon
                        </Link>
                        <Link to="/admin/requests" className="dropdown-item" onClick={() => setShowUserDropdown(false)}>
                          <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Demandes streamers
                        </Link>
                      </>
                    )}

                    <div className="dropdown-divider"></div>

                    <button className="dropdown-item logout-item" onClick={handleLogout}>
                      <svg className="dropdown-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="login-btn" onClick={onLogin} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="spinner"></div> Connexion...
                </>
              ) : (
                <>
                  <svg className="twitch-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                  </svg>
                  Connexion Twitch
                </>
              )}
            </button>
          )}
        </div>

        <button className="menu-toggle" onClick={toggleMenu} aria-label="Toggle menu">
          <span className={`burger-line ${isMenuOpen ? "active" : ""}`}></span>
          <span className={`burger-line ${isMenuOpen ? "active" : ""}`}></span>
          <span className={`burger-line ${isMenuOpen ? "active" : ""}`}></span>
        </button>
      </div>

      <nav className={`mobile-nav ${isMenuOpen ? "active" : ""}`}>
        <Link to="/" className="mobile-nav-link" onClick={toggleMenu}>Accueil</Link>
        <Link to="/streamers" className="mobile-nav-link" onClick={toggleMenu}>Streamers</Link>
        <Link to="/leaderboard" className="mobile-nav-link" onClick={toggleMenu}>Classement</Link>
        <Link to="/game" className="mobile-nav-link" onClick={toggleMenu}>Jeux</Link>
      </nav>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleModalLogin}
        isLoading={isLoading}
        error={authError}
      />
    </header>
  );
};

export default Header;