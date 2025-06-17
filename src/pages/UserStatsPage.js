import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './UserStatsPage.css';

const UserStatsPage = ({ user }) => {
  const [userStats, setUserStats] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [pauvrathonStats, setPauvrathonStats] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      loadAllStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Charger toutes les statistiques
  const loadAllStats = async () => {
    try {
      setError(null);
      setLoading(true);

      // Récupérer l'utilisateur
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userError) {
        throw new Error('Utilisateur non trouvé');
      }

      // Charger les stats principales
      const { data: stats, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userData.id)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }

      setUserStats(stats || {
        total_games_played: 0,
        total_games_won: 0,
        total_clicks: 0,
        best_score: 0,
        total_playtime: 0
      });

      // Charger l'historique complet des jeux
      const { data: games, error: gamesError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!gamesError) {
        setGameHistory(games || []);
      }

      // Charger les stats Pauvrathon (simulées pour le moment)
      // TODO: Remplacer par de vraies données quand les tables seront créées
      setPauvrathonStats([
        { streamer_name: 'StreamerExample1', time_added: 1800, sessions: 5 },
        { streamer_name: 'StreamerExample2', time_added: 3600, sessions: 8 },
      ]);

      // Calculer les achievements
      calculateAchievements(stats, games);

    } catch (error) {
      console.error('Erreur chargement stats:', error);
      setError('Impossible de charger vos statistiques.');
    } finally {
      setLoading(false);
    }
  };

  // Calculer les achievements
  const calculateAchievements = (stats, games) => {
    const achievements = [];

    if (stats?.total_games_played >= 10) {
      achievements.push({ 
        id: 'player', 
        name: 'Joueur régulier', 
        description: '10 parties jouées',
        icon: '🎮',
        unlocked: true 
      });
    }

    if (stats?.total_games_won >= 5) {
      achievements.push({ 
        id: 'winner', 
        name: 'Gagnant', 
        description: '5 victoires',
        icon: '🏆',
        unlocked: true 
      });
    }

    if (stats?.best_score >= 100) {
      achievements.push({ 
        id: 'scorer', 
        name: 'Score élevé', 
        description: 'Score de 100+',
        icon: '⭐',
        unlocked: true 
      });
    }

    if (stats?.total_clicks >= 100) {
      achievements.push({ 
        id: 'supporter', 
        name: 'Supporter', 
        description: '100 clics de soutien',
        icon: '👆',
        unlocked: true 
      });
    }

    // Achievements pas encore débloqués
    if (stats?.total_games_played < 50) {
      achievements.push({ 
        id: 'veteran', 
        name: 'Vétéran', 
        description: '50 parties jouées',
        icon: '🎖️',
        unlocked: false,
        progress: stats?.total_games_played || 0,
        target: 50
      });
    }

    setAchievements(achievements);
  };

  // Composant d'animation pour les statistiques
  const AnimatedStat = ({ value, duration = 1000, suffix = '' }) => {
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
    
    return <span>{displayValue}{suffix}</span>;
  };

  // Utilitaires
  const getGameDisplayName = (gameType) => {
    const gameNames = {
      'trouve_le_chiffre': 'Trouve le chiffre',
      'memory_game': 'Jeu de mémoire',
      'reaction_game': 'Jeu de réflexes',
      'hangman_game': 'Pendu',
      'simon_game': 'Simon',
      'number_guess_game': 'Devine le nombre'
    };
    return gameNames[gameType] || gameType;
  };

  const getGameIcon = (gameType) => {
    const gameIcons = {
      'trouve_le_chiffre': '🎯',
      'memory_game': '🧠',
      'reaction_game': '⚡',
      'hangman_game': '🎪',
      'simon_game': '🎵',
      'number_guess_game': '🔢'
    };
    return gameIcons[gameType] || '🎮';
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateWinRate = () => {
    if (!userStats?.total_games_played || userStats.total_games_played === 0) return 0;
    return Math.round((userStats.total_games_won / userStats.total_games_played) * 100);
  };

  if (!user) {
    return (
      <div className="user-stats-page">
        <div className="auth-required">
          <h2>🔒 Connexion requise</h2>
          <p>Connectez-vous pour voir vos statistiques !</p>
          <Link to="/" className="back-button">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-stats-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement de vos statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-stats-page">
        <div className="error-section">
          <h2>😅 Oups !</h2>
          <p>{error}</p>
          <button onClick={loadAllStats} className="retry-button">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-stats-page">
      {/* En-tête avec profil */}
      <section className="stats-header">
        <div className="stats-hero">
          <div className="hero-background">
            <img src={user.profile_image_url} alt={user.display_name} className="hero-avatar" />
            <div className="hero-info">
              <h1>📊 Tableau de bord de {user.display_name}</h1>
              <p>Suivez votre progression et vos performances</p>
              <div className="hero-badges">
                <span className="hero-badge">🎮 Joueur</span>
                <span className="hero-badge">⭐ Niveau {Math.floor((userStats?.total_games_played || 0) / 10) + 1}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation par onglets */}
      <div className="tabs-navigation">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📈 Vue d'ensemble
        </button>
        <button 
          className={`tab-button ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          🎮 Historique des jeux
        </button>
        <button 
          className={`tab-button ${activeTab === 'pauvrathon' ? 'active' : ''}`}
          onClick={() => setActiveTab('pauvrathon')}
        >
          🎬 Pauvrathons
        </button>
        <button 
          className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          🏆 Achievements
        </button>
      </div>

      {/* Contenu des onglets */}
      <div className="tab-content">
        {/* Vue d'ensemble */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Statistiques principales avec design différent */}
            <div className="stats-dashboard">
              <div className="dashboard-row">
                <div className="big-stat-card">
                  <div className="big-stat-header">
                    <h2>🎮 Activité de jeu</h2>
                  </div>
                  <div className="big-stat-grid">
                    <div className="mini-stat">
                      <span className="mini-stat-value">
                        <AnimatedStat value={userStats?.total_games_played || 0} />
                      </span>
                      <span className="mini-stat-label">Parties</span>
                    </div>
                    <div className="mini-stat">
                      <span className="mini-stat-value">
                        <AnimatedStat value={userStats?.total_games_won || 0} />
                      </span>
                      <span className="mini-stat-label">Victoires</span>
                    </div>
                    <div className="mini-stat">
                      <span className="mini-stat-value">
                        <AnimatedStat value={calculateWinRate()} suffix="%" />
                      </span>
                      <span className="mini-stat-label">Réussite</span>
                    </div>
                  </div>
                </div>
                
                <div className="circular-stat-card">
                  <div className="circular-stat">
                    <div className="circular-progress">
                      <svg width="120" height="120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="8"/>
                        <circle 
                          cx="60" 
                          cy="60" 
                          r="50" 
                          fill="none" 
                          stroke="#667eea" 
                          strokeWidth="8"
                          strokeDasharray={`${calculateWinRate() * 3.14} 314`}
                          transform="rotate(-90 60 60)"
                        />
                      </svg>
                      <div className="circular-content">
                        <span className="circular-value">{calculateWinRate()}%</span>
                        <span className="circular-label">Taux de réussite</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="performance-cards">
                <div className="perf-card score-card">
                  <div className="perf-icon">⭐</div>
                  <div className="perf-content">
                    <h3><AnimatedStat value={userStats?.best_score || 0} /></h3>
                    <p>Meilleur Score</p>
                    <span className="perf-trend">↗️ Record personnel</span>
                  </div>
                </div>
                
                <div className="perf-card time-card">
                  <div className="perf-icon">⏱️</div>
                  <div className="perf-content">
                    <h3>{formatDuration(userStats?.total_playtime || 0)}</h3>
                    <p>Temps Total</p>
                    <span className="perf-trend">🎮 En jeu</span>
                  </div>
                </div>
                
                <div className="perf-card clicks-card">
                  <div className="perf-icon">👆</div>
                  <div className="perf-content">
                    <h3><AnimatedStat value={userStats?.total_clicks || 0} /></h3>
                    <p>Clics de Soutien</p>
                    <span className="perf-trend">❤️ Communauté</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Graphique de progression (simulé) */}
            <div className="progress-section">
              <h2>📈 Progression récente</h2>
              <div className="progress-chart-placeholder">
                <p>📊 Graphique de progression bientôt disponible</p>
                <div className="chart-mockup">
                  <div className="chart-bar" style={{height: '20%'}}></div>
                  <div className="chart-bar" style={{height: '40%'}}></div>
                  <div className="chart-bar" style={{height: '60%'}}></div>
                  <div className="chart-bar" style={{height: '80%'}}></div>
                  <div className="chart-bar" style={{height: '100%'}}></div>
                  <div className="chart-bar" style={{height: '70%'}}></div>
                  <div className="chart-bar" style={{height: '90%'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Historique des jeux */}
        {activeTab === 'games' && (
          <div className="games-tab">
            <div className="section-header">
              <h2>🎮 Historique des parties</h2>
              <Link to="/game" className="play-button">Jouer maintenant</Link>
            </div>
            
            {gameHistory.length > 0 ? (
              <div className="games-history">
                {gameHistory.map((game) => (
                  <div key={game.id} className="game-history-item">
                    <div className="game-icon">
                      {getGameIcon(game.game_type)}
                    </div>
                    <div className="game-details">
                      <h4>{getGameDisplayName(game.game_type)}</h4>
                      <div className="game-stats">
                        <span className="game-score">Score: {game.score}</span>
                        <span className="game-duration">Durée: {game.duration}s</span>
                        <span className="game-clicks">Clics: {game.clicks_count}</span>
                      </div>
                      <span className="game-date">{formatDate(game.created_at)}</span>
                    </div>
                    <div className="game-status">
                      {game.won ? (
                        <span className="status-won">🏆 Gagné</span>
                      ) : (
                        <span className="status-lost">❌ Perdu</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-games">
                <div className="no-games-content">
                  <h3>🎯 Aucune partie jouée</h3>
                  <p>Commencez à jouer pour voir votre historique !</p>
                  <Link to="/game" className="play-now-button">Jouer maintenant</Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statistiques Pauvrathon */}
        {activeTab === 'pauvrathon' && (
          <div className="pauvrathon-tab">
            <div className="section-header">
              <h2>🎬 Vos contributions aux Pauvrathons</h2>
            </div>
            
            <div className="pauvrathon-summary">
              <div className="summary-card">
                <div className="summary-icon">⏰</div>
                <div className="summary-content">
                  <h3>{formatDuration(5400)}</h3>
                  <p>Temps total ajouté</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">🎬</div>
                <div className="summary-content">
                  <h3>2</h3>
                  <p>Streamers aidés</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">🔥</div>
                <div className="summary-content">
                  <h3>13</h3>
                  <p>Sessions actives</p>
                </div>
              </div>
            </div>

            {pauvrathonStats.length > 0 ? (
              <div className="pauvrathon-list">
                <h3>📊 Contributions par streamer</h3>
                {pauvrathonStats.map((streamer, index) => (
                  <div key={index} className="streamer-contribution">
                    <div className="streamer-info">
                      <h4>{streamer.streamer_name}</h4>
                      <p>{streamer.sessions} sessions de participation</p>
                    </div>
                    <div className="contribution-stats">
                      <span className="time-added">+{formatDuration(streamer.time_added)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-pauvrathon">
                <div className="no-pauvrathon-content">
                  <h3>🎬 Commencez votre aventure Pauvrathon !</h3>
                  <p>Soutenez vos streamers préférés en participant à leurs subathons.</p>
                  <Link to="/discover" className="discover-streamers">Découvrir des streamers</Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Achievements */}
        {activeTab === 'achievements' && (
          <div className="achievements-tab">
            <div className="section-header">
              <h2>🏆 Vos achievements</h2>
              <p>Débloquez des récompenses en jouant !</p>
            </div>
            
            <div className="achievements-grid">
              {achievements.map((achievement) => (
                <div 
                  key={achievement.id} 
                  className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                >
                  <div className="achievement-icon">
                    {achievement.unlocked ? achievement.icon : '🔒'}
                  </div>
                  <div className="achievement-content">
                    <h4>{achievement.name}</h4>
                    <p>{achievement.description}</p>
                    {!achievement.unlocked && achievement.progress !== undefined && (
                      <div className="achievement-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">
                          {achievement.progress}/{achievement.target}
                        </span>
                      </div>
                    )}
                  </div>
                  {achievement.unlocked && (
                    <div className="achievement-badge">✅</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bouton retour */}
      <div className="page-footer">
        <Link to="/" className="back-to-home">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default UserStatsPage;