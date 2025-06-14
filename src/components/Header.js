import React, { useState } from 'react';
import LoginModal from './LoginModal';
import './Header.css';

const Header = ({ user, onLogout, onLogin, isLoading, authError }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  const handleModalLogin = () => {
    setShowLoginModal(false);
    onLogin();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <div className="header-logo">
          <h1>🎮 Pauvrathon</h1>
        </div>

        {/* Navigation Desktop */}
        <nav className="header-nav desktop-nav">
          <a href="#home" className="nav-link">Accueil</a>
          <a href="#streamers" className="nav-link">Streamers</a>
          <a href="#events" className="nav-link">Événements</a>
          <a href="#leaderboard" className="nav-link">Classement</a>
        </nav>

        {/* Section utilisateur */}
        <div className="header-user">
          {user ? (
            <div className="user-section">
              <div className="user-info">
                <img 
                  src={user.profile_image_url} 
                  alt={user.display_name}
                  className="user-avatar"
                />
                <span className="user-name">{user.display_name}</span>
              </div>
              <button 
                className="logout-btn"
                onClick={onLogout}
              >
                <svg className="logout-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Déconnexion
              </button>
            </div>
          ) : (
            <button 
              className="login-btn"
              onClick={handleLoginClick}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  Connexion...
                </>
              ) : (
                <>
                  <svg className="twitch-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                  </svg>
                  Connexion Twitch
                </>
              )}
            </button>
          )}
        </div>

        {/* Menu burger pour mobile */}
        <button 
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className={`burger-line ${isMenuOpen ? 'active' : ''}`}></span>
          <span className={`burger-line ${isMenuOpen ? 'active' : ''}`}></span>
          <span className={`burger-line ${isMenuOpen ? 'active' : ''}`}></span>
        </button>
      </div>

      {/* Navigation Mobile */}
      <nav className={`mobile-nav ${isMenuOpen ? 'active' : ''}`}>
        <a href="#home" className="mobile-nav-link" onClick={toggleMenu}>Accueil</a>
        <a href="#streamers" className="mobile-nav-link" onClick={toggleMenu}>Streamers</a>
        <a href="#events" className="mobile-nav-link" onClick={toggleMenu}>Événements</a>
        <a href="#leaderboard" className="mobile-nav-link" onClick={toggleMenu}>Classement</a>
      </nav>

      {/* Modal de connexion */}
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