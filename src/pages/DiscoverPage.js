import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './DiscoverPage.css'

const DiscoverPage = ({ user }) => {
  const [pauvrathonStreamers, setPauvrathonStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPauvrathonStreamers();
  }, []);

  const loadPauvrathonStreamers = async () => {
    try {
      setError('');
      setLoading(true);

      console.log('🔍 Chargement des streamers Pauvrathon...');

      // Récupérer tous les streamers avec leurs infos utilisateur
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
        .order('updated_at', { ascending: false });

      if (streamersError) {
        throw streamersError;
      }

      console.log('📊 Streamers trouvés:', streamersData?.length || 0);

      if (!streamersData || streamersData.length === 0) {
        setError('Aucun streamer inscrit sur Pauvrathon pour le moment.');
        setPauvrathonStreamers([]);
        return;
      }

      // Vérifier le statut live sur Twitch pour les streamers actifs
      const token = localStorage.getItem('twitch_access_token');
      
      if (token) {
        try {
          // Récupérer les IDs des streamers pour vérifier leur statut live
          const twitchIds = streamersData.map(s => s.users.twitch_user_id);
          const idsQuery = twitchIds.map(id => `user_id=${id}`).join('&');
          
          const liveResponse = await fetch(`https://api.twitch.tv/helix/streams?${idsQuery}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
            }
          });

          if (liveResponse.ok) {
            const liveData = await liveResponse.json();
            const liveStreamerIds = liveData.data.map(stream => stream.user_id);
            
            // Ajouter les infos de stream aux streamers
            const enrichedStreamers = streamersData.map(streamer => ({
              ...streamer,
              is_currently_live: liveStreamerIds.includes(streamer.users.twitch_user_id),
              stream_data: liveData.data.find(stream => stream.user_id === streamer.users.twitch_user_id) || null
            }));

            setPauvrathonStreamers(enrichedStreamers);
          } else {
            // Si erreur API Twitch, utiliser les données sans statut live
            setPauvrathonStreamers(streamersData.map(s => ({ ...s, is_currently_live: s.is_live })));
          }
        } catch (twitchError) {
          console.log('⚠️ Erreur vérification statut live, utilisation des données cached');
          setPauvrathonStreamers(streamersData.map(s => ({ ...s, is_currently_live: s.is_live })));
        }
      } else {
        // Pas de token, utiliser les données de base
        setPauvrathonStreamers(streamersData.map(s => ({ ...s, is_currently_live: s.is_live })));
      }

    } catch (err) {
      console.error('❌ Erreur lors du chargement:', err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPauvrathonStreamers();
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatViewerCount = (count) => {
    if (!count) return '0';
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const getStreamerStatus = (streamer) => {
    if (!streamer.subathon_active) {
      return { status: 'inactive', color: '#6b7280', text: 'Pauvrathon inactif' };
    }
    if (streamer.is_currently_live) {
      return { status: 'live', color: '#ef4444', text: 'Live & Actif' };
    }
    return { status: 'active', color: '#10b981', text: 'Pauvrathon actif' };
  };

  if (!user) {
    return (
      <div className="discover-page">
        <div className="auth-required">
          <h2>🔒 Connexion requise</h2>
          <p>Connectez-vous avec Twitch pour découvrir les streamers Pauvrathon !</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="discover-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement des streamers Pauvrathon...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="discover-page">
      <div className="page-header">
        <h1>🎮 Découverte Pauvrathon</h1>
        <p>Soutenez vos streamers préférés en participant à leurs subathons !</p>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="refresh-button"
        >
          {refreshing ? '⏳ Actualisation...' : '🔄 Actualiser'}
        </button>
      </div>

      {error && (
        <div className="info-message">
          <p>{error}</p>
        </div>
      )}

      {pauvrathonStreamers.length > 0 ? (
        <div className="streamers-container">
          {/* Section Pauvrathons actifs - TOUJOURS AFFICHÉE */}
          <div className="streamers-section">
            <div className="section-header">
              <h2>✅ Pauvrathons actifs ({pauvrathonStreamers.filter(s => s.subathon_active).length})</h2>
              <p>Cliquez sur un streamer pour participer !</p>
            </div>

            {pauvrathonStreamers.filter(s => s.subathon_active).length > 0 ? (
              <div className="streamers-grid">
                {pauvrathonStreamers
                  .filter(s => s.subathon_active)
                  .map((streamer) => {
                    const status = getStreamerStatus(streamer);
                    return (
                      <div key={streamer.id} className="streamer-card active">
                        <Link 
                          to={`/participate/${streamer.id}`}
                          className="streamer-link"
                        >
                          <div className="streamer-header">
                            <div className="avatar-container">
                              <img 
                                src={streamer.users.profile_image_url} 
                                alt={streamer.users.twitch_display_name}
                                className="streamer-avatar clickable"
                              />
                              <div className="click-indicator">
                                <span className="click-icon">👆</span>
                                <span className="click-text">Cliquez !</span>
                              </div>
                            </div>
                            
                            <div className="streamer-info">
                              <h3>{streamer.users.twitch_display_name}</h3>
                              <p className="streamer-username">@{streamer.users.twitch_username}</p>
                              
                              <div className="status-badge" style={{ backgroundColor: status.color }}>
                                {status.text}
                              </div>
                            </div>
                          </div>

                          <div className="pauvrathon-stats">
                            <div className="stat">
                              <span className="stat-icon">⏰</span>
                              <div className="stat-content">
                                <span className="stat-value">{formatTime(streamer.current_timer)}</span>
                                <span className="stat-label">Timer actuel</span>
                              </div>
                            </div>
                            
                            <div className="stat">
                              <span className="stat-icon">🎯</span>
                              <div className="stat-content">
                                <span className="stat-value">{streamer.clicks_required}</span>
                                <span className="stat-label">Clics requis</span>
                              </div>
                            </div>
                            
                            <div className="stat">
                              <span className="stat-icon">⏱️</span>
                              <div className="stat-content">
                                <span className="stat-value">{streamer.time_range_min}-{streamer.time_range_max}s</span>
                                <span className="stat-label">Temps ajouté</span>
                              </div>
                            </div>
                          </div>

                          {/* Infos live si disponibles */}
                          {streamer.stream_data && (
                            <div className="live-info">
                              <div className="live-badge">
                                <span className="live-dot"></span>
                                EN DIRECT
                              </div>
                              <div className="live-stats">
                                <span>👁️ {formatViewerCount(streamer.stream_data.viewer_count)}</span>
                                <span>🎮 {streamer.stream_data.game_name}</span>
                              </div>
                            </div>
                          )}

                          <div className="participate-prompt">
                            <span className="participate-text">
                              🎮 Participer au Pauvrathon
                            </span>
                            <span className="participate-arrow">→</span>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="no-active-streamers">
                <div className="no-active-content">
                  <h3>😴 Aucun Pauvrathon actif</h3>
                  <p>Tous les streamers ont temporairement désactivé leur Pauvrathon.</p>
                  <p>Revenez plus tard ou encouragez vos streamers préférés à l'activer !</p>
                </div>
              </div>
            )}
          </div>

          {/* Streamers inactifs - seulement si il y en a */}
          {pauvrathonStreamers.filter(s => !s.subathon_active).length > 0 && (
            <div className="streamers-section">
              <div className="section-header">
                <h2>💤 Pauvrathons inactifs ({pauvrathonStreamers.filter(s => !s.subathon_active).length})</h2>
                <p>Ces streamers ont temporairement désactivé leur Pauvrathon</p>
              </div>

              <div className="streamers-grid">
                {pauvrathonStreamers
                  .filter(s => !s.subathon_active)
                  .map((streamer) => {
                    const status = getStreamerStatus(streamer);
                    return (
                      <div key={streamer.id} className="streamer-card inactive">
                        <div className="streamer-header">
                          <div className="avatar-container">
                            <img 
                              src={streamer.users.profile_image_url} 
                              alt={streamer.users.twitch_display_name}
                              className="streamer-avatar disabled"
                            />
                            <div className="disabled-overlay">
                              <span className="disabled-icon">🚫</span>
                            </div>
                          </div>
                          
                          <div className="streamer-info">
                            <h3>{streamer.users.twitch_display_name}</h3>
                            <p className="streamer-username">@{streamer.users.twitch_username}</p>
                            
                            <div className="status-badge" style={{ backgroundColor: status.color }}>
                              {status.text}
                            </div>
                          </div>
                        </div>

                        <div className="inactive-message">
                          <p>⏸️ Pauvrathon temporairement désactivé</p>
                          <a 
                            href={`https://twitch.tv/${streamer.users.twitch_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="visit-channel-btn"
                          >
                            📺 Visiter la chaîne
                          </a>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="no-streamers">
          <div className="no-streamers-content">
            <h3>😔 Aucun streamer Pauvrathon</h3>
            <p>Il n'y a actuellement aucun streamer inscrit sur Pauvrathon.</p>
            <div className="suggestion-box">
              <h4>💡 Vous êtes streamer ?</h4>
              <p>Inscrivez-vous pour permettre à votre communauté de soutenir vos subathons !</p>
              <Link to="/request-streamer" className="become-streamer-btn">
                🎬 Devenir streamer Pauvrathon
              </Link>
            </div>
            <button onClick={handleRefresh} className="retry-button">
              🔄 Actualiser
            </button>
          </div>
        </div>
      )}

      <div className="page-footer">
        <div className="info-box">
          <h4>🎯 Comment ça marche ?</h4>
          <ol>
            <li>Choisissez un streamer avec le Pauvrathon actif</li>
            <li>Cliquez sur sa photo pour accumuler des clics</li>
            <li>Tous les X clics, un mini-jeu se déclenche</li>
            <li>Gagnez le jeu pour ajouter du temps à son subathon !</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;