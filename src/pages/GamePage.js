import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './GamePage.css';

const GamePage = ({ user }) => {
  const [activeStreamers, setActiveStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadActiveStreamers();
  }, []);

  // Charger les streamers avec Pauvrathons actifs
  const loadActiveStreamers = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: streamersData, error: streamersError } = await supabase
        .from('streamers')
        .select(`
          *,
          users!inner(
            twitch_user_id,
            twitch_username,
            twitch_display_name,
            profile_image_url
          )
        `)
        .eq('subathon_active', true)
        .order('created_at', { ascending: false });

      if (streamersError) {
        throw streamersError;
      }

      setActiveStreamers(streamersData || []);

    } catch (err) {
      console.error('Erreur chargement streamers:', err);
      setError('Erreur lors du chargement des Pauvrathons');
    } finally {
      setLoading(false);
    }
  };

  // Formater le temps
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (!user) {
    return (
      <div className="game-page">
        <div className="auth-required">
          <h2>🎮 Connexion requise</h2>
          <p>Connectez-vous avec Twitch pour participer aux Pauvrathons !</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="game-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement des Pauvrathons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-page">
        <div className="error-section">
          <h2>😅 Oups !</h2>
          <p>{error}</p>
          <button onClick={loadActiveStreamers} className="retry-button">
            🔄 Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <h1>🎮 Pauvrathons Actifs</h1>
        <p>Bienvenue {user.display_name} ! Participez aux Pauvrathons des streamers.</p>
      </div>

      {/* Message d'explication */}
      <div className="explanation-section">
        <div className="explanation-card">
          <h3>🎯 Comment ça marche ?</h3>
          <div className="explanation-steps">
            <div className="step">
              <span className="step-number">1</span>
              <p>Choisissez un streamer avec un Pauvrathon actif</p>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <p>Cliquez sur son avatar pour gagner des points</p>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <p>Débloquez un mini-jeu et gagnez pour ajouter du temps !</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des streamers actifs */}
      {activeStreamers.length > 0 ? (
        <div className="streamers-section">
          <h2>🔴 Pauvrathons en cours ({activeStreamers.length})</h2>
          <div className="streamers-grid">
            {activeStreamers.map((streamer) => (
              <div key={streamer.id} className="streamer-card active">
                <div className="streamer-image-container">
                  <img 
                    src={streamer.users.profile_image_url} 
                    alt={streamer.users.twitch_display_name}
                    className="streamer-image clickable"
                  />
                  <div className="active-indicator">🔴 ACTIF</div>
                </div>
                
                <div className="streamer-info">
                  <h3>{streamer.users.twitch_display_name}</h3>
                  <div className="streamer-stats">
                    <div className="stat">
                      <span className="stat-icon">⏰</span>
                      <span className="stat-value">{formatTime(streamer.current_timer)}</span>
                      <span className="stat-label">Timer actuel</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">🎯</span>
                      <span className="stat-value">{streamer.clicks_required}</span>
                      <span className="stat-label">Clics requis</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">⏱️</span>
                      <span className="stat-value">{streamer.time_range_min}-{streamer.time_range_max}s</span>
                      <span className="stat-label">Temps ajouté</span>
                    </div>
                  </div>
                </div>
                
                <div className="streamer-actions">
                  <Link 
                    to={`/participate/${streamer.id}`}
                    className="participate-button"
                  >
                    🎮 Participer
                  </Link>
                  <a 
                    href={`https://twitch.tv/${streamer.users.twitch_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="watch-button"
                  >
                    📺 Regarder
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-streamers">
          <div className="no-streamers-content">
            <h2>😴 Aucun Pauvrathon actif</h2>
            <p>Il n'y a actuellement aucun streamer avec un Pauvrathon en cours.</p>
            <div className="no-streamers-suggestions">
              <h3>💡 Suggestions :</h3>
              <ul>
                <li>Revenez plus tard pour voir de nouveaux Pauvrathons</li>
                <li>Suivez vos streamers préférés sur Twitch</li>
                <li>Encouragez vos streamers à utiliser notre plateforme !</li>
              </ul>
            </div>
            <button onClick={loadActiveStreamers} className="refresh-button">
              🔄 Actualiser
            </button>
          </div>
        </div>
      )}

      {/* Statistiques globales */}
      <div className="global-stats-section">
        <h2>📊 Statistiques globales</h2>
        <div className="global-stats-grid">
          <div className="global-stat">
            <span className="global-stat-value">{activeStreamers.length}</span>
            <span className="global-stat-label">Pauvrathons actifs</span>
          </div>
          <div className="global-stat">
            <span className="global-stat-value">
              {activeStreamers.reduce((total, s) => total + s.current_timer, 0)}s
            </span>
            <span className="global-stat-label">Temps total accumulé</span>
          </div>
          <div className="global-stat">
            <span className="global-stat-value">
              {activeStreamers.length > 0 ? 
                Math.round(activeStreamers.reduce((sum, s) => sum + s.clicks_required, 0) / activeStreamers.length) : 
                0
              }
            </span>
            <span className="global-stat-label">Clics moyens requis</span>
          </div>
        </div>
      </div>

      {/* Call to action pour les streamers */}
      <div className="cta-section">
        <div className="cta-card">
          <h3>🎬 Vous êtes streamer ?</h3>
          <p>Lancez votre propre Pauvrathon et engagez votre communauté !</p>
          <Link to="/dashboard" className="cta-button">
            🚀 Créer mon Pauvrathon
          </Link>
        </div>
      </div>
    </div>
  );
};

export default GamePage;