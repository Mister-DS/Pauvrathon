import React, { useState, useEffect } from 'react';
import './LoginModal.css';

const LoginModal = ({ isOpen, onClose, onLogin, isLoading, error }) => {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowModal(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      const timer = setTimeout(() => setShowModal(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!showModal) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Bouton de fermeture */}
        <button className="modal-close" onClick={onClose}>
          <svg className="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo/Titre */}
        <div className="modal-header">
          <div className="modal-logo">
            <svg className="logo-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
          </div>
          <h2>Connexion à Pauvrathon</h2>
          <p>Connectez-vous avec votre compte Twitch pour accéder à toutes les fonctionnalités</p>
        </div>

        {/* Messages d'erreur */}
        {error && (
          <div className="error-message">
            <div className="error-content">
              <svg className="error-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Bouton de connexion Twitch */}
        <button
          onClick={onLogin}
          disabled={isLoading}
          className={`twitch-login-btn ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? (
            <>
              <div className="login-spinner"></div>
              <span>Connexion en cours...</span>
            </>
          ) : (
            <>
              <svg className="twitch-login-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
              </svg>
              <span>Se connecter avec Twitch</span>
            </>
          )}
        </button>

        {/* Informations supplémentaires */}
        <div className="modal-footer">
          <p className="privacy-text">
            En vous connectant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité
          </p>
        </div>

        {/* Avantages de la connexion */}
        <div className="benefits-list">
          <div className="benefit-item">
            <svg className="benefit-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span>Synchronisation automatique avec votre profil Twitch</span>
          </div>
          <div className="benefit-item">
            <svg className="benefit-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span>Accès aux fonctionnalités communautaires</span>
          </div>
          <div className="benefit-item">
            <svg className="benefit-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span>Connexion sécurisée et rapide</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;