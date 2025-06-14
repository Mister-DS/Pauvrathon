import React, { useState, useEffect } from 'react';
import './StreamersPage.css';

const StreamersPage = ({ user }) => {
  const [followedStreamers, setFollowedStreamers] = useState([]);
  const [liveStreamers, setLiveStreamers] = useState([]);
  const [offlineStreamers, setOfflineStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadStreamersData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadStreamersData = async () => {
    try {
      setError('');
      const token = localStorage.getItem('twitch_access_token');
      if (!token) {
        setError('Token d\'accès manquant');
        setLoading(false);
        return;
      }

      console.log('🔍 Chargement des streamers suivis...');

      // Essayer les différentes API pour récupérer les follows
      let followsData = null;
      
      // Méthode 1: Nouvelle API
      try {
        const followsResponse = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${user.id}&first=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
          }
        });

        if (followsResponse.ok) {
          followsData = await followsResponse.json();
          console.log('✅ Follows récupérés (nouvelle API):', followsData.data?.length || 0);
        }
      } catch (err) {
        console.log('❌ Nouvelle API échouée');
      }

      // Méthode 2: Ancienne API si la nouvelle échoue
      if (!followsData || !followsData.data || followsData.data.length === 0) {
        try {
          const followsResponse = await fetch(`https://api.twitch.tv/helix/users/follows?from_id=${user.id}&first=100`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
            }
          });

          if (followsResponse.ok) {
            followsData = await followsResponse.json();
            console.log('✅ Follows récupérés (ancienne API):', followsData.data?.length || 0);
          }
        } catch (err) {
          console.log('❌ Ancienne API échouée');
        }
      }

      if (!followsData || !followsData.data || followsData.data.length === 0) {
        setError('Impossible de récupérer vos follows. Permissions insuffisantes ou aucun streamer suivi.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Récupérer les IDs des streamers
      const streamerIds = followsData.data.map(follow => 
        follow.broadcaster_id || follow.to_id
      );

      // Récupérer les infos détaillées des streamers
      const streamersResponse = await fetch(`https://api.twitch.tv/helix/users?${streamerIds.map(id => `id=${id}`).join('&')}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      if (!streamersResponse.ok) {
        throw new Error('Erreur lors de la récupération des détails des streamers');
      }

      const streamersData = await streamersResponse.json();
      
      // Ajouter les dates de follow
      const streamersWithFollowDate = streamersData.data.map(streamer => {
        const followInfo = followsData.data.find(follow => 
          (follow.broadcaster_id || follow.to_id) === streamer.id
        );
        return {
          ...streamer,
          followed_at: followInfo?.followed_at
        };
      });

      setFollowedStreamers(streamersWithFollowDate);
      console.log('✅ Streamers avec détails:', streamersWithFollowDate.length);

      // Vérifier qui est en live
      const liveResponse = await fetch(`https://api.twitch.tv/helix/streams?${streamerIds.map(id => `user_id=${id}`).join('&')}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        const liveStreams = liveData.data || [];
        setLiveStreamers(liveStreams);
        console.log('🔴 Streamers en live:', liveStreams.length);

        // Séparer les streamers en ligne et hors ligne
        const liveStreamerIds = liveStreams.map(stream => stream.user_id);
        const offline = streamersWithFollowDate.filter(streamer => 
          !liveStreamerIds.includes(streamer.id)
        );
        setOfflineStreamers(offline);
        console.log('⚫ Streamers hors ligne:', offline.length);
      }

    } catch (err) {
      console.error('❌ Erreur chargement streamers:', err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStreamersData();
  };

  const formatFollowDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatViewerCount = (count) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const formatDuration = (startedAt) => {
    const now = new Date();
    const started = new Date(startedAt);
    const diffMs = now - started;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  if (!user) {
    return (
      <div className="streamers-page">
        <div className="auth-required">
          <h2>🔒 Connexion requise</h2>
          <p>Connectez-vous avec Twitch pour voir vos streamers suivis !</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="streamers-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement de vos streamers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="streamers-page">
        <div className="page-header">
          <h1>📺 Vos Streamers</h1>
          <p>Streamers que vous suivez sur Twitch</p>
        </div>
        
        <div className="error-message">
          <h2>⚠️ Impossible de charger vos streamers</h2>
          <p>{error}</p>
          <div className="error-help">
            <p><strong>Causes possibles :</strong></p>
            <ul>
              <li>Permissions insuffisantes pour accéder à vos follows</li>
              <li>Token d'accès expiré</li>
              <li>Restrictions de l'API Twitch</li>
            </ul>
          </div>
          <button onClick={handleRefresh} className="retry-button">
            🔄 Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="streamers-page">
      <div className="page-header">
        <h1>📺 Vos Streamers</h1>
        <p>Streamers que vous suivez sur Twitch ({followedStreamers.length} au total)</p>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="refresh-button"
        >
          {refreshing ? '⏳ Actualisation...' : '🔄 Actualiser'}
        </button>
      </div>

      {/* Section streamers en live */}
      {liveStreamers.length > 0 ? (
        <section className="live-section">
          <h2>🔴 En direct maintenant ({liveStreamers.length})</h2>
          <div className="live-streamers-grid">
            {liveStreamers.map((stream) => {
              const streamer = followedStreamers.find(s => s.id === stream.user_id);
              if (!streamer) return null;
              
              return (
                <div key={stream.id} className="live-streamer-card">
                  <div className="live-indicator">
                    <span className="live-dot"></span>
                    EN DIRECT
                  </div>
                  
                  <div className="stream-thumbnail-container">
                    <img 
                      src={stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')} 
                      alt={stream.title}
                      className="stream-thumbnail"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/320x180/667eea/ffffff?text=Stream+Live';
                      }}
                    />
                    <div className="stream-overlay">
                      <span className="viewer-count">
                        👁️ {formatViewerCount(stream.viewer_count)}
                      </span>
                      <span className="stream-duration">
                        🕐 {formatDuration(stream.started_at)}
                      </span>
                    </div>
                  </div>

                  <div className="live-streamer-info">
                    <div className="streamer-header">
                      <img src={streamer.profile_image_url} alt={streamer.display_name} className="streamer-avatar" />
                      <div className="streamer-details">
                        <h3>{streamer.display_name}</h3>
                        <p className="stream-category">{stream.game_name}</p>
                      </div>
                    </div>
                    
                    <p className="stream-title">{stream.title}</p>
                    
                    <a 
                      href={`https://twitch.tv/${streamer.login}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="watch-live-button"
                    >
                      📺 Regarder
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="no-live-section">
          <div className="no-live-content">
            <h2>😴 Aucun streamer en direct</h2>
            <p>Vos streamers suivis ne sont pas en live pour le moment.</p>
          </div>
        </section>
      )}

      {/* Section streamers hors ligne */}
      {offlineStreamers.length > 0 && (
        <section className="offline-section">
          <h2>⚫ Streamers hors ligne ({offlineStreamers.length})</h2>
          <div className="offline-streamers-grid">
            {offlineStreamers.map((streamer) => (
              <div key={streamer.id} className="offline-streamer-card">
                <img 
                  src={streamer.profile_image_url} 
                  alt={streamer.display_name} 
                  className="offline-avatar"
                />
                <div className="offline-info">
                  <h4>{streamer.display_name}</h4>
                  <p className="offline-username">@{streamer.login}</p>
                  <p className="follow-date">
                    Suivi depuis {formatFollowDate(streamer.followed_at)}
                  </p>
                </div>
                <a 
                  href={`https://twitch.tv/${streamer.login}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="visit-offline-button"
                >
                  Visiter
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {followedStreamers.length === 0 && (
        <div className="no-streamers">
          <div className="no-streamers-content">
            <h3>🔍 Aucun streamer trouvé</h3>
            <p>Il semble que vous ne suivez aucun streamer sur Twitch, ou nous n'arrivons pas à accéder à votre liste.</p>
            <a 
              href="https://twitch.tv/directory" 
              target="_blank" 
              rel="noopener noreferrer"
              className="discover-button"
            >
              Découvrir des streamers
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamersPage;