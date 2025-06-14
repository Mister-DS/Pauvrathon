import React, { useState, useEffect } from 'react';
import './StreamersPage.css';

const StreamersPage = ({ user }) => {
  const [followedStreamers, setFollowedStreamers] = useState([]);
  const [liveStreamers, setLiveStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const token = localStorage.getItem('twitch_access_token');
      if (!token) {
        setError('Token d\'accès manquant');
        setLoading(false);
        return;
      }

      console.log('🔍 Chargement des streamers pour:', user.display_name);

      // Récupérer les follows
      const followsResponse = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${user.id}&first=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      console.log('📡 Réponse follows:', followsResponse.status);

      if (!followsResponse.ok) {
        if (followsResponse.status === 401) {
          setError('Permissions insuffisantes pour accéder à vos follows Twitch');
        } else {
          setError(`Erreur API Twitch: ${followsResponse.status}`);
        }
        setLoading(false);
        return;
      }

      const followsData = await followsResponse.json();
      console.log('✅ Follows récupérés:', followsData.data?.length || 0);
      
      if (followsData.data && followsData.data.length > 0) {
        // Récupérer les infos détaillées des streamers
        const streamerIds = followsData.data.map(follow => follow.broadcaster_id);
        const streamersResponse = await fetch(`https://api.twitch.tv/helix/users?${streamerIds.map(id => `id=${id}`).join('&')}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
          }
        });

        if (streamersResponse.ok) {
          const streamersData = await streamersResponse.json();
          
          // Ajouter les dates de follow
          const streamersWithFollowDate = streamersData.data.map(streamer => {
            const followInfo = followsData.data.find(follow => follow.broadcaster_id === streamer.id);
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
            setLiveStreamers(liveData.data || []);
            console.log('🔴 Streamers en live:', liveData.data?.length || 0);
          }
        }
      } else {
        console.log('ℹ️ Aucun streamer suivi trouvé');
      }
    } catch (err) {
      console.error('❌ Erreur chargement streamers:', err);
      setError('Impossible de charger la liste des streamers');
    } finally {
      setLoading(false);
    }
  };

  const isStreamerLive = (streamerId) => {
    return liveStreamers.some(stream => stream.user_id === streamerId);
  };

  const getStreamInfo = (streamerId) => {
    return liveStreamers.find(stream => stream.user_id === streamerId);
  };

  const formatFollowDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatViewerCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
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
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f8ff', borderRadius: '8px' }}>
            <p><strong>Pourquoi cette erreur ?</strong></p>
            <ul style={{ textAlign: 'left', margin: '0.5rem 0' }}>
              <li>L'API Twitch nécessite des permissions spéciales pour accéder aux follows</li>
              <li>Votre token peut avoir expiré</li>
              <li>Les permissions peuvent ne pas être accordées</li>
            </ul>
          </div>
          <button onClick={loadStreamersData} className="retry-button">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="streamers-page">
      <div className="page-header">
        <h1>📺 Vos Streamers</h1>
        <p>Streamers que vous suivez sur Twitch ({followedStreamers.length} trouvés)</p>
      </div>

      {/* Streamers en live */}
      {liveStreamers.length > 0 && (
        <section className="live-section">
          <h2>🔴 En direct maintenant ({liveStreamers.length})</h2>
          <div className="live-streamers">
            {liveStreamers.map((stream) => {
              const streamer = followedStreamers.find(s => s.id === stream.user_id);
              if (!streamer) return null;
              
              return (
                <div key={stream.id} className="live-streamer-card">
                  <div className="live-indicator">
                    <span className="live-dot"></span>
                    EN DIRECT
                  </div>
                  <img 
                    src={stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')} 
                    alt={stream.title}
                    className="stream-thumbnail"
                  />
                  <div className="live-streamer-info">
                    <div className="streamer-header">
                      <img src={streamer.profile_image_url} alt={streamer.display_name} className="streamer-avatar" />
                      <div>
                        <h3>{streamer.display_name}</h3>
                        <p className="stream-category">{stream.game_name}</p>
                      </div>
                    </div>
                    <p className="stream-title">{stream.title}</p>
                    <div className="stream-stats">
                      <span className="viewer-count">
                        👁️ {formatViewerCount(stream.viewer_count)} viewers
                      </span>
                      <span className="stream-duration">
                        🕐 Depuis {new Date(new Date() - new Date(stream.started_at)).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <a 
                      href={`https://twitch.tv/${streamer.login}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="watch-live-button"
                    >
                      Regarder
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tous les streamers suivis */}
      <section className="all-streamers-section">
        <h2>👥 Tous vos follows</h2>
        
        {followedStreamers.length > 0 ? (
          <div className="streamers-grid">
            {followedStreamers.map((streamer) => {
              const isLive = isStreamerLive(streamer.id);
              const streamInfo = getStreamInfo(streamer.id);
              
              return (
                <div key={streamer.id} className={`streamer-card ${isLive ? 'live' : ''}`}>
                  {isLive && (
                    <div className="live-badge">
                      <span className="live-dot"></span>
                      LIVE
                    </div>
                  )}
                  
                  <img 
                    src={streamer.profile_image_url} 
                    alt={streamer.display_name} 
                    className="streamer-avatar"
                  />
                  
                  <div className="streamer-info">
                    <h3>{streamer.display_name}</h3>
                    <p className="streamer-username">@{streamer.login}</p>
                    
                    {isLive && streamInfo ? (
                      <div className="live-info">
                        <p className="stream-game">{streamInfo.game_name}</p>
                        <p className="stream-viewers">
                          👁️ {formatViewerCount(streamInfo.viewer_count)}
                        </p>
                      </div>
                    ) : (
                      <div className="follow-info">
                        <p className="follow-date">
                          Suivi depuis le {formatFollowDate(streamer.followed_at)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="streamer-actions">
                    <a 
                      href={`https://twitch.tv/${streamer.login}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`visit-button ${isLive ? 'live-button' : ''}`}
                    >
                      {isLive ? 'Regarder' : 'Visiter'}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-streamers">
            <div className="no-streamers-content">
              <h3>🔍 Aucun streamer trouvé</h3>
              <p>Il semble que vous ne suivez aucun streamer sur Twitch, ou nous n'arrivons pas à accéder à votre liste à cause des permissions API.</p>
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
      </section>
    </div>
  );
};

export default StreamersPage;