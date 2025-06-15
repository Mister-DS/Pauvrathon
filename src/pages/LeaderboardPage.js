import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './LeaderboardPage.css';

const LeaderboardPage = ({ user }) => {
  const [leaderboards, setLeaderboards] = useState({});
  const [selectedGame, setSelectedGame] = useState('all');
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [userPositions, setUserPositions] = useState({});

  const gameTypes = {
    'all': { name: 'Général', icon: '🏆' },
    'trouve_le_chiffre': { name: 'Trouve le chiffre', icon: '🎯' },
    'hangman': { name: 'Jeu du pendu', icon: '🎪' },
    'memory': { name: 'Memory Game', icon: '🧠' },
    'reaction': { name: 'Jeu de Réaction', icon: '⚡' }
  };

  useEffect(() => {
    loadLeaderboards();
    if (user) {
      loadUserStats();
    }
  }, [user]);

  const loadLeaderboards = async () => {
    try {
      setLoading(true);

      // 1. Classement général (basé sur total_games_won puis best_score) - TOP 5
      const { data: generalData, error: generalError } = await supabase
        .from('user_stats')
        .select(`
          *,
          users!inner(
            twitch_display_name,
            profile_image_url
          )
        `)
        .gt('total_games_played', 0)
        .order('total_games_won', { ascending: false })
        .order('best_score', { ascending: false })
        .limit(5); // Changé de 10 à 5

      if (!generalError && generalData) {
        const formattedGeneral = generalData.map(stat => ({
          twitch_display_name: stat.users.twitch_display_name,
          profile_image_url: stat.users.profile_image_url,
          best_score: stat.best_score,
          total_games_won: stat.total_games_won,
          total_games_played: stat.total_games_played,
          win_rate: stat.total_games_played > 0 ? Math.round((stat.total_games_won / stat.total_games_played) * 100) : 0
        }));
        
        setLeaderboards(prev => ({ ...prev, all: formattedGeneral }));
      }

      // 2. Classements par jeu spécifique - TOP 5
      const gameLeaderboards = {};
      
      for (const gameType of ['trouve_le_chiffre', 'hangman', 'memory', 'reaction']) {
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
          .order('score', { ascending: gameType === 'trouve_le_chiffre' || gameType === 'reaction' ? true : false })
          .limit(20); // Garde plus de données pour le groupage

        if (!gameError && gameData) {
          // Grouper par utilisateur et garder le meilleur score
          const userBestScores = {};
          gameData.forEach(session => {
            const userName = session.users.twitch_display_name;
            if (!userBestScores[userName]) {
              userBestScores[userName] = {
                twitch_display_name: session.users.twitch_display_name,
                profile_image_url: session.users.profile_image_url,
                score: session.score,
                created_at: session.created_at,
                games_won: 1
              };
            } else {
              // Pour trouve_le_chiffre et reaction: plus petit score = mieux
              // Pour autres jeux: plus grand score = mieux
              const isBetter = (gameType === 'trouve_le_chiffre' || gameType === 'reaction')
                ? session.score < userBestScores[userName].score
                : session.score > userBestScores[userName].score;
                
              if (isBetter) {
                userBestScores[userName].score = session.score;
                userBestScores[userName].created_at = session.created_at;
              }
              userBestScores[userName].games_won++;
            }
          });

          // Trier par meilleur score et prendre seulement les 5 premiers
          gameLeaderboards[gameType] = Object.values(userBestScores)
            .sort((a, b) => (gameType === 'trouve_le_chiffre' || gameType === 'reaction') ? a.score - b.score : b.score - a.score)
            .slice(0, 5); // Changé de 10 à 5
        }
      }

      setLeaderboards(prev => ({ ...prev, ...gameLeaderboards }));

    } catch (error) {
      console.error('Erreur chargement classements:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger les statistiques utilisateur et ses positions
  const loadUserStats = async () => {
    try {
      // Récupérer l'ID utilisateur
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userData) {
        // Récupérer les stats générales
        const { data: stats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (stats) {
          setUserStats(stats);

          // Calculer les positions dans chaque classement
          const positions = {};

          // Position générale
          const { data: allUsers } = await supabase
            .from('user_stats')
            .select('users!inner(twitch_display_name), total_games_won, best_score')
            .gt('total_games_played', 0)
            .order('total_games_won', { ascending: false })
            .order('best_score', { ascending: false });

          if (allUsers) {
            const userIndex = allUsers.findIndex(u => u.users.twitch_display_name === user.display_name);
            positions.all = userIndex >= 0 ? userIndex + 1 : null;
          }

          // Positions par jeu
          for (const gameType of ['trouve_le_chiffre', 'hangman', 'memory', 'reaction']) {
            const { data: gameRanking } = await supabase
              .from('game_sessions')
              .select(`
                score,
                users!inner(twitch_display_name)
              `)
              .eq('game_type', gameType)
              .eq('won', true)
              .order('score', { ascending: gameType === 'trouve_le_chiffre' || gameType === 'reaction' ? true : false });

            if (gameRanking) {
              // Grouper par utilisateur pour avoir le meilleur score de chaque joueur
              const userBestScores = {};
              gameRanking.forEach(session => {
                const userName = session.users.twitch_display_name;
                if (!userBestScores[userName]) {
                  userBestScores[userName] = session.score;
                } else {
                  const isBetter = (gameType === 'trouve_le_chiffre' || gameType === 'reaction')
                    ? session.score < userBestScores[userName]
                    : session.score > userBestScores[userName];
                  if (isBetter) {
                    userBestScores[userName] = session.score;
                  }
                }
              });

              // Créer le classement final
              const sortedUsers = Object.entries(userBestScores)
                .sort(([,a], [,b]) => (gameType === 'trouve_le_chiffre' || gameType === 'reaction') ? a - b : b - a);

              const userIndex = sortedUsers.findIndex(([userName]) => userName === user.display_name);
              positions[gameType] = userIndex >= 0 ? userIndex + 1 : null;
            }
          }

          setUserPositions(positions);

          // Trouver le meilleur jeu de l'utilisateur
          const { data: userSessions } = await supabase
            .from('game_sessions')
            .select('game_type, score')
            .eq('user_id', userData.id)
            .eq('won', true);

          if (userSessions && userSessions.length > 0) {
            // Calculer le jeu avec le plus de victoires
            const gameStats = {};
            userSessions.forEach(session => {
              if (!gameStats[session.game_type]) {
                gameStats[session.game_type] = { wins: 0, bestScore: session.score };
              }
              gameStats[session.game_type].wins++;
              
              // Mettre à jour le meilleur score
              const isBetter = (session.game_type === 'trouve_le_chiffre' || session.game_type === 'reaction')
                ? session.score < gameStats[session.game_type].bestScore
                : session.score > gameStats[session.game_type].bestScore;
              if (isBetter) {
                gameStats[session.game_type].bestScore = session.score;
              }
            });

            const bestGame = Object.entries(gameStats)
              .sort(([,a], [,b]) => b.wins - a.wins)[0];

            setUserStats(prev => ({ 
              ...prev, 
              best_game: bestGame ? bestGame[0] : null,
              best_game_wins: bestGame ? bestGame[1].wins : 0
            }));
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement stats utilisateur:', error);
    }
  };

  const formatScore = (score, gameType) => {
    switch (gameType) {
      case 'trouve_le_chiffre':
        return `${score} coup${score > 1 ? 's' : ''}`;
      case 'hangman':
        return `${score} pts`;
      case 'memory':
        return `${score} pts`;
      case 'reaction':
        return `${score} pts`;
      default:
        return score.toString();
    }
  };

  // Fonction corrigée pour TOP 5
  const getRankEmoji = (index) => {
    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    return emojis[index] || '🏅';
  };

  const getRankClass = (index) => {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'other';
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
            <p>Classement basé sur le nombre de victoires puis meilleur score</p>
          ) : (
            <p>Top 5 des meilleurs scores - {(selectedGame === 'trouve_le_chiffre' || selectedGame === 'reaction') ? 'Moins de points = mieux' : 'Plus de points = mieux'}</p>
          )}
        </div>

        {currentLeaderboard.length > 0 ? (
          <div className="leaderboard-list">
            {currentLeaderboard.map((player, index) => (
              <div key={`${player.twitch_display_name}-${index}`} 
                   className={`leaderboard-item rank-${getRankClass(index)} ${
                     player.twitch_display_name === user?.display_name ? 'current-user' : ''
                   }`}>
                <div className="rank-section">
                  <span className="rank-emoji">{getRankEmoji(index)}</span>
                  <span className="rank-number">#{index + 1}</span>
                </div>

                <div className="player-section">
                  <img 
                    src={player.profile_image_url} 
                    alt={player.twitch_display_name}
                    className="player-avatar"
                  />
                  <div className="player-info">
                    <h3 className="player-name">
                      {player.twitch_display_name}
                      {player.twitch_display_name === user?.display_name && (
                        <span className="you-badge">C'est vous !</span>
                      )}
                    </h3>
                    {player.created_at && (
                      <span className="achievement-date">
                        {new Date(player.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {player.games_won > 1 && selectedGame !== 'all' && (
                      <span className="games-count">{player.games_won} victoires dans ce jeu</span>
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
      {user && userStats && (
        <div className="user-position">
          <h3>📊 Vos statistiques</h3>
          <div className="user-stats-grid">
            <div className="user-stat-card">
              <span className="stat-icon">🏆</span>
              <div>
                <span className="stat-number">{userPositions.all || '-'}</span>
                <span className="stat-description">Position générale</span>
              </div>
            </div>
            <div className="user-stat-card">
              <span className="stat-icon">🎯</span>
              <div>
                <span className="stat-number">
                  {userStats.best_game ? gameTypes[userStats.best_game]?.name || userStats.best_game : '-'}
                </span>
                <span className="stat-description">Jeu favori</span>
              </div>
            </div>
            <div className="user-stat-card">
              <span className="stat-icon">📈</span>
              <div>
                <span className="stat-number">
                  {userStats.total_games_played > 0 ? `${Math.round((userStats.total_games_won / userStats.total_games_played) * 100)}%` : '-'}
                </span>
                <span className="stat-description">Taux de victoire</span>
              </div>
            </div>
          </div>

          {/* Positions par jeu */}
          <div className="game-positions">
            <h4>Vos positions par jeu :</h4>
            <div className="positions-grid">
              {Object.entries(gameTypes).slice(1).map(([gameId, gameInfo]) => (
                <div key={gameId} className="position-item">
                  <span className="game-icon">{gameInfo.icon}</span>
                  <span className="game-name">{gameInfo.name}</span>
                  <span className="position">
                    {userPositions[gameId] ? `#${userPositions[gameId]}` : 'Non classé'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="user-details">
            <p><strong>Parties jouées :</strong> {userStats.total_games_played}</p>
            <p><strong>Victoires :</strong> {userStats.total_games_won}</p>
            <p><strong>Meilleur score :</strong> {userStats.best_score}</p>
            <p><strong>Clics de soutien :</strong> {userStats.total_clicks}</p>
            {userStats.best_game_wins && (
              <p><strong>Victoires dans votre jeu favori :</strong> {userStats.best_game_wins}</p>
            )}
          </div>
        </div>
      )}

      {user && !userStats && (
        <div className="user-position">
          <h3>📊 Vos statistiques</h3>
          <p className="stats-note">
            Vous n'avez pas encore joué de parties. Allez sur la page Jeux pour commencer !
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;