import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './LeaderboardPage.css';

const LeaderboardPage = ({ user }) => {
  const [leaderboards, setLeaderboards] = useState({});
  const [selectedGame, setSelectedGame] = useState('all');
  const [loading, setLoading] = useState(true);

  const gameTypes = {
    'all': { name: 'Général', icon: '🏆' },
    'trouve_le_chiffre': { name: 'Trouve le chiffre', icon: '🎯' },
    'memory_game': { name: 'Jeu de mémoire', icon: '🧠' },
    'reaction_game': { name: 'Jeu de réflexes', icon: '⚡' }
  };

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    try {
      setLoading(true);

      // Classement général (depuis la vue leaderboard)
      const { data: generalLeaderboard, error: generalError } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(5);

      if (generalError) throw generalError;

      // Classements par jeu
      const gameLeaderboards = {};
      
      for (const gameType of ['trouve_le_chiffre', 'memory_game', 'reaction_game']) {
        // Meilleurs scores par jeu (score le plus bas pour trouve_le_chiffre = mieux)
        const { data: gameData, error: gameError } = await supabase
          .from('game_sessions')
          .select(`
            score,
            won,
            created_at,
            users!inner(
              twitch_display_name,
              profile_image_url
            )
          `)
          .eq('game_type', gameType)
          .eq('won', true)
          .order('score', { ascending: gameType === 'trouve_le_chiffre' ? true : false })
          .limit(5);

        if (!gameError && gameData) {
          // Grouper par utilisateur et garder le meilleur score
          const userBestScores = {};
          gameData.forEach(session => {
            const userName = session.users.twitch_display_name;
            if (!userBestScores[userName] || 
                (gameType === 'trouve_le_chiffre' ? 
                 session.score < userBestScores[userName].score : 
                 session.score > userBestScores[userName].score)) {
              userBestScores[userName] = {
                ...session,
                display_name: session.users.twitch_display_name,
                profile_image_url: session.users.profile_image_url
              };
            }
          });

          gameLeaderboards[gameType] = Object.values(userBestScores)
            .sort((a, b) => gameType === 'trouve_le_chiffre' ? a.score - b.score : b.score - a.score)
            .slice(0, 5);
        }
      }

      setLeaderboards({
        all: generalLeaderboard || [],
        ...gameLeaderboards
      });

    } catch (error) {
      console.error('Erreur chargement classements:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score, gameType) => {
    if (gameType === 'trouve_le_chiffre') {
      return `${score} coup${score > 1 ? 's' : ''}`;
    }
    return score.toString();
  };

  const getRankEmoji = (index) => {
    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    return emojis[index] || '🏅';
  };

  const getRankClass = (index) => {
    const classes = ['gold', 'silver', 'bronze', 'fourth', 'fifth'];
    return classes[index] || 'other';
  };

  if (loading) {
    return (
      <div className="leaderboard-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement des classements...</p>
        </div>
      </div>
    );
  }

  const currentLeaderboard = leaderboards[selectedGame] || [];

  return (
    <div className="leaderboard-page">
      <div className="page-header">
        <h1>🏆 Classements</h1>
        <p>Les meilleurs joueurs de la communauté Pauvrathon</p>
      </div>

      {/* Sélecteur de jeu */}
      <div className="game-selector">
        {Object.entries(gameTypes).map(([gameId, gameInfo]) => (
          <button
            key={gameId}
            className={`game-tab ${selectedGame === gameId ? 'active' : ''}`}
            onClick={() => setSelectedGame(gameId)}
          >
            <span className="game-icon">{gameInfo.icon}</span>
            {gameInfo.name}
          </button>
        ))}
      </div>

      {/* Classement actuel */}
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <h2>
            {gameTypes[selectedGame]?.icon} {gameTypes[selectedGame]?.name}
          </h2>
          {selectedGame === 'all' ? (
            <p>Classement basé sur le meilleur score global</p>
          ) : (
            <p>Top 5 des meilleurs scores</p>
          )}
        </div>

        {currentLeaderboard.length > 0 ? (
          <div className="leaderboard-list">
            {currentLeaderboard.map((player, index) => (
              <div key={`${player.twitch_display_name || player.display_name}-${index}`} 
                   className={`leaderboard-item rank-${getRankClass(index)}`}>
                <div className="rank-section">
                  <span className="rank-emoji">{getRankEmoji(index)}</span>
                  <span className="rank-number">#{index + 1}</span>
                </div>

                <div className="player-section">
                  <img 
                    src={player.profile_image_url} 
                    alt={player.twitch_display_name || player.display_name}
                    className="player-avatar"
                  />
                  <div className="player-info">
                    <h3 className="player-name">
                      {player.twitch_display_name || player.display_name}
                    </h3>
                    {player.created_at && (
                      <span className="achievement-date">
                        {new Date(player.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="score-section">
                  {selectedGame === 'all' ? (
                    <div className="general-stats">
                      <div className="stat-item">
                        <span className="stat-value">{player.best_score}</span>
                        <span className="stat-label">Meilleur score</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{player.total_games_won}/{player.total_games_played}</span>
                        <span className="stat-label">V/J</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{player.win_rate}%</span>
                        <span className="stat-label">Taux victoire</span>
                      </div>
                    </div>
                  ) : (
                    <div className="game-score">
                      <span className="score-value">
                        {formatScore(player.score, selectedGame)}
                      </span>
                      <span className="score-label">
                        {selectedGame === 'trouve_le_chiffre' ? 'Meilleur temps' : 'Meilleur score'}
                      </span>
                    </div>
                  )}
                </div>

                {index === 0 && (
                  <div className="champion-badge">
                    <span>👑 Champion</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-leaderboard">
            <div className="empty-content">
              <div className="empty-icon">🎮</div>
              <h3>Aucun score enregistré</h3>
              <p>
                {selectedGame === 'all' 
                  ? 'Soyez le premier à jouer et apparaître dans le classement !'
                  : `Personne n'a encore joué à ${gameTypes[selectedGame]?.name}. Soyez le premier !`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Informations utilisateur */}
      {user && (
        <div className="user-position">
          <h3>📊 Vos statistiques</h3>
          <div className="user-stats-grid">
            <div className="user-stat-card">
              <span className="stat-icon">🎮</span>
              <div>
                <span className="stat-number">-</span>
                <span className="stat-description">Position générale</span>
              </div>
            </div>
            <div className="user-stat-card">
              <span className="stat-icon">🎯</span>
              <div>
                <span className="stat-number">-</span>
                <span className="stat-description">Meilleur jeu</span>
              </div>
            </div>
            <div className="user-stat-card">
              <span className="stat-icon">📈</span>
              <div>
                <span className="stat-number">-</span>
                <span className="stat-description">Progression</span>
              </div>
            </div>
          </div>
          <p className="stats-note">
            Jouez plus de parties pour voir vos statistiques détaillées !
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;