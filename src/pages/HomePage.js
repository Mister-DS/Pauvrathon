import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './HomePage.css';

const HomePage = ({ user }) => {
  const [userStats, setUserStats] = useState(null);
  const [recentGames, setRecentGames] = useState([]);
  const [followedStreamers, setFollowedStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadFollowedStreamers();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Charger les données utilisateur AMÉLIORÉ
  const loadUserData = async () => {
    try {
      setError(null);
      
      // Récupérer ou créer l'utilisateur
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userError && userError.code === 'PGRST116') {
        // Utilisateur n'existe pas, le créer
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            twitch_user_id: user.id,
            twitch_username: user.login,
            twitch_display_name: user.display_name,
            profile_image_url: user.profile_image_url,
            email: user.email
          })
          .select('id')
          .single();

        if (createError) {
          throw createError;
        }
        userData = newUser;
      } else if (userError) {
        throw userError;
      }

      if (userData) {
        // Charger les statistiques avec gestion d'erreur
        let { data: stats, error: statsError } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (statsError && statsError.code === 'PGRST116') {
          // Stats n'existent pas, les initialiser
          await supabase.rpc('initialize_user_stats', { user_uuid: userData.id });
          
          // Récupérer les stats initialisées
          const { data: newStats } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', userData.id)
            .single();
          
          stats = newStats;
        }

        console.log('📊 Stats chargées:', stats); // Debug

        setUserStats(stats || {
          total_games_played: 0,
          total_games_won: 0,
          total_clicks: 0,
          best_score: 0,
          total_playtime: 0
        });

        // Charger les parties récentes
        const { data: games, error: gamesError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (gamesError) {
          console.error('Erreur chargement parties:', gamesError);
        } else {
          setRecentGames(games || []);
        }
      }
    } catch (error) {
      console.error('Erreur chargement données utilisateur:', error);
      setError('Impossible de charger vos données. Veuillez rafraîchir la page.');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour forcer la mise à jour des stats
  const refreshStats = async () => {
    if (!user) return;
    
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userData) {
        // Recalculer les stats
        await supabase.rpc('update_user_stats', { user_uuid: userData.id });
        
        // Recharger les stats
        const { data: stats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        setUserStats(stats);
        console.log('✅ Stats mises à jour:', stats);
      }
    } catch (error) {
      console.error('Erreur mise à jour stats:', error);
    }
  };

  // Composant de statistique animée
  const AnimatedStat = ({ value, duration = 1000 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    
    useEffect(() => {
      let startTime = null;
      const targetValue = value || 0;
      
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        setDisplayValue(Math.floor(progress * targetValue));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }, [value, duration]);
    
    return <h3>{displayValue}</h3>;
  };

  // Charger les streamers suivis (VERSION CORRIGÉE)
  const loadFollowedStreamers = async () => {
    try {
      const token = localStorage.getItem('twitch_access_token');
      if (!token) {
        console.log('Token manquant pour charger les streamers');
        return;
      }

      // Récupérer les follows de l'utilisateur
      const followsResponse = await fetch(`https://api.twitch.tv/helix/channels/followed?user_id=${user.id}&first=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      if (followsResponse.ok) {
        const followsData = await followsResponse.json();
        
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
            setFollowedStreamers(streamersData.data || []);
          }
        }
      }
    } catch (error) {
      console.log('Erreur chargement streamers (normal en développement):', error.message);
    }
  };

  const getGameDisplayName = (gameType) => {
    const gameNames = {
      'trouve_le_chiffre': 'Trouve le chiffre',
      'memory_game': 'Jeu de mémoire',
      'reaction_game': 'Jeu de réflexes'
    };
    return gameNames[gameType] || gameType;
  };

  const getGameIcon = (gameType) => {
    const gameIcons = {
      'trouve_le_chiffre': '🎯',
      'memory_game': '🧠',
      'reaction_game': '⚡'
    };
    return gameIcons[gameType] || '🎮';
  };

  if (!user) {
    return (
      <div className="homepage">
        <div className="welcome-section">
          <h1>🎮 Bienvenue sur Pauvrathon !</h1>
          <p>La plateforme gaming dédiée aux streamers et à leur communauté</p>
          <div className="features">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Mini-jeux</h3>
              <p>Débloquez des jeux en soutenant vos streamers préférés</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏆</div>
              <h3>Classements</h3>
              <p>Compétition amicale entre les membres de la communauté</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Communauté</h3>
              <p>Suivez vos streamers et interagissez avec les autres joueurs</p>
            </div>
          </div>
          <p className="cta-text">Connectez-vous avec Twitch pour commencer !</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="homepage">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement de votre profil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="homepage">
        <div className="error-section">
          <h2>😅 Oups !</h2>
          <p>{error}</p>
          <button onClick={loadUserData} className="retry-button">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      {/* Section profil utilisateur */}
      <section className="profile-section">
        <div className="profile-header">
          <img src={user.profile_image_url} alt={user.display_name} className="profile-avatar" />
          <div className="profile-info">
            <h1>Salut {user.display_name} ! 👋</h1>
            <p>Bienvenue sur votre tableau de bord gaming</p>
          </div>
        </div>

        {/* Statistiques rapides AMÉLIORÉES */}
        <div className="quick-stats">
          <div className="stat-card stat-card-games">
            <div className="stat-icon">🎮</div>
            <div className="stat-content">
              <AnimatedStat value={userStats?.total_games_played || 0} />
              <p>Parties jouées</p>
            </div>
          </div>
          <div className="stat-card stat-card-wins">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <AnimatedStat value={userStats?.total_games_won || 0} />
              <p>Victoires</p>
            </div>
          </div>
          <div className="stat-card stat-card-score">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <AnimatedStat value={userStats?.best_score || 0} />
              <p>Meilleur score</p>
            </div>
          </div>
          <div className="stat-card stat-card-clicks">
            <div className="stat-icon">👆</div>
            <div className="stat-content">
              <AnimatedStat value={userStats?.total_clicks || 0} />
              <p>Clics de soutien</p>
            </div>
          </div>
        </div>

        {/* Bouton de rafraîchissement des stats */}
        <div className="stats-refresh-section">
          <button onClick={refreshStats} className="refresh-stats-button">
            <span className="refresh-icon">🔄</span>
            <span className="refresh-text">Actualiser les statistiques</span>
          </button>
        </div>
      </section>

      {/* Section jeux récents */}
      <section className="recent-games-section">
        <div className="section-header">
          <h2>🎯 Parties récentes</h2>
          <Link to="/game" className="play-button">Jouer maintenant</Link>
        </div>
        
        {recentGames.length > 0 ? (
          <div className="games-list">
            {recentGames.map((game, index) => (
              <div key={game.id} className="game-item">
                <div className="game-icon">
                  {getGameIcon(game.game_type)}
                </div>
                <div className="game-details">
                  <h4>{getGameDisplayName(game.game_type)}</h4>
                  <p>Score: {game.score} {game.won ? '🏆' : ''}</p>
                  <p>Clics: {game.clicks_count}</p>
                  <span className="game-date">
                    {new Date(game.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="game-status">
                  {game.won ? (
                    <span className="status-won">Gagné</span>
                  ) : (
                    <span className="status-played">Joué</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-games">
            <p>Vous n'avez pas encore joué. <Link to="/game">Commencez maintenant !</Link></p>
          </div>
        )}
      </section>

      {/* Section streamers suivis */}
      <section className="streamers-section">
        <div className="section-header">
          <h2>📺 Streamers que vous suivez</h2>
          <Link to="/streamers" className="view-all-link">Voir tous</Link>
        </div>
        
        {followedStreamers.length > 0 ? (
          <div className="streamers-grid">
            {followedStreamers.slice(0, 6).map((streamer) => (
              <div key={streamer.id} className="streamer-card">
                <img src={streamer.profile_image_url} alt={streamer.display_name} className="streamer-avatar" />
                <div className="streamer-info">
                  <h4>{streamer.display_name}</h4>
                  <p>@{streamer.login}</p>
                </div>
                <a 
                  href={`https://twitch.tv/${streamer.login}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="watch-button"
                >
                  Regarder
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-streamers">
            <p>Nous ne pouvons pas accéder à votre liste de follows pour le moment.</p>
            <Link to="/streamers" className="browse-streamers">Découvrir des streamers</Link>
          </div>
        )}
      </section>

      {/* Liens rapides */}
      <section className="quick-links">
        <Link to="/leaderboard" className="quick-link-card">
          <div className="quick-link-icon">🏆</div>
          <h3>Classements</h3>
          <p>Voir tous les classements</p>
        </Link>
        <Link to="/streamers" className="quick-link-card">
          <div className="quick-link-icon">👥</div>
          <h3>Streamers</h3>
          <p>Explorer la communauté</p>
        </Link>
        <Link to="/game" className="quick-link-card">
          <div className="quick-link-icon">🎮</div>
          <h3>Jouer</h3>
          <p>Débloquer des mini-jeux</p>
        </Link>
      </section>
    </div>
  );
};

export default HomePage;