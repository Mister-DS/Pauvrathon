import React, { useState, useEffect } from 'react';
import './DiscoverPage.css';

const DiscoverPage = ({ user }) => {
  const [subathonStreams, setSubathonStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSubathonStreams();
  }, []);

  const loadSubathonStreams = async () => {
    try {
      setError('');
      const token = localStorage.getItem('twitch_access_token');
      
      if (!token) {
        setError('Token d\'accès manquant. Connectez-vous avec Twitch.');
        setLoading(false);
        return;
      }

      console.log('🔍 Recherche de streams avec "subathon" dans le titre...');

      // Méthode 1: Recherche directe de streams avec "subathon"
      const streamsResponse = await fetch(`https://api.twitch.tv/helix/streams?first=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      if (!streamsResponse.ok) {
        throw new Error(`Erreur API: ${streamsResponse.status}`);
      }

      const streamsData = await streamsResponse.json();
      console.log('📡 Streams récupérés:', streamsData.data?.length || 0);

      // Filtrer les streams qui contiennent "subathon" dans le titre
      const subathonStreams = streamsData.data.filter(stream => 
        stream.title.toLowerCase().includes('subathon')
      );

      console.log('🎯 Subathons trouvés:', subathonStreams.length);

      if (subathonStreams.length === 0) {
        // Si aucun subathon, chercher des streams populaires comme alternative
        const popularStreams = streamsData.data
          .sort((a, b) => b.viewer_count - a.viewer_count)
          .slice(0, 10);
        
        setSubathonStreams(popularStreams);
        setError('Aucun subathon en cours trouvé. Voici les streams populaires du moment.');
      } else {
        setSubathonStreams(subathonStreams);
      }

    } catch (err) {
      console.error('❌ Erreur lors de la recherche:', err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSubathonStreams();
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

  const getStreamEmoji = (title, gameName) => {
    const lowerTitle = title.toLowerCase();
    const lowerGame = gameName.toLowerCase();
    
    if (lowerTitle.includes('subathon')) return '⏰';
    if (lowerTitle.includes('charity') || lowerTitle.includes('caritatif')) return '💝';
    if (lowerGame.includes('just chatting')) return '💬';
    if (lowerGame.includes('music')) return '🎵';
    if (lowerGame.includes('art')) return '🎨';
    if (lowerGame.includes('fortnite')) return '🏗️';
    if (lowerGame.includes('league of legends')) return '⚔️';
    if (lowerGame.includes('valorant')) return '🎯';
    return '🎮';
  };

  if (!user) {
    return (
      <div className="discover-page">
        <div className="auth-required">
          <h2>🔒 Connexion requise</h2>
          <p>Connectez-vous avec Twitch pour découvrir les subathons en cours !</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="discover-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Recherche des subathons en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="discover-page">
      <div className="page-header">
        <h1>🔍 Découverte</h1>
        <p>Streams en direct avec "subathon" dans le titre</p>
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

      {subathonStreams.length > 0 ? (
        <div className="streams-container">
          <div className="streams-header">
            <h2>
              {error ? '🔥 Streams populaires' : '⏰ Subathons en cours'} 
              ({subathonStreams.length})
            </h2>
          </div>

          <div className="streams-grid">
            {subathonStreams.map((stream) => (
              <div key={stream.id} className="stream-card">
                <div className="stream-thumbnail-container">
                  <img 
                    src={stream.thumbnail_url.replace('{width}', '440').replace('{height}', '248')} 
                    alt={stream.title}
                    className="stream-thumbnail"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/440x248/667eea/ffffff?text=Stream+Live';
                    }}
                  />
                  <div className="stream-overlay">
                    <div className="live-indicator">
                      <span className="live-dot"></span>
                      EN DIRECT
                    </div>
                    <div className="stream-stats">
                      <span className="viewer-count">
                        👁️ {formatViewerCount(stream.viewer_count)}
                      </span>
                      <span className="stream-duration">
                        🕐 {formatDuration(stream.started_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="stream-info">
                  <div className="streamer-header">
                    <img 
                      src={`https://api.twitch.tv/helix/users?id=${stream.user_id}`}
                      alt={stream.user_name}
                      className="streamer-avatar"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/40x40/9146ff/ffffff?text=' + stream.user_name.charAt(0);
                      }}
                    />
                    <div className="streamer-details">
                      <h3 className="streamer-name">{stream.user_name}</h3>
                      <p className="stream-category">
                        {getStreamEmoji(stream.title, stream.game_name)} {stream.game_name}
                      </p>
                    </div>
                  </div>

                  <p className="stream-title">
                    {stream.title}
                  </p>

                  <div className="stream-actions">
                    <a 
                      href={`https://twitch.tv/${stream.user_login}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="watch-button"
                    >
                      <span className="watch-icon">📺</span>
                      Regarder
                    </a>
                    
                    {stream.title.toLowerCase().includes('subathon') && (
                      <div className="subathon-badge">
                        ⏰ SUBATHON
                      </div>
                    )}
                  </div>

                  <div className="stream-metadata">
                    <span className="stream-language">
                      🌐 {stream.language.toUpperCase()}
                    </span>
                    {stream.is_mature && (
                      <span className="mature-badge">🔞 Mature</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-streams">
          <div className="no-streams-content">
            <h3>😔 Aucun stream trouvé</h3>
            <p>Il n'y a actuellement aucun subathon en cours sur Twitch.</p>
            <button onClick={handleRefresh} className="retry-button">
              🔄 Réessayer
            </button>
          </div>
        </div>
      )}

      <div className="page-footer">
        <p>
          💡 <strong>Astuce :</strong> Les subathons sont des streams marathons où le temps de diffusion 
          est prolongé par les donations et interactions des viewers !
        </p>
      </div>
    </div>
  );
};

export default DiscoverPage;