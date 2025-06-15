import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import HangmanGame from '../games/HangmanGame';
import NumberGuessGame from '../games/NumberGuessGame';
import MemoryGame from '../games/MemoryGame';
import ReactionGame from '../games/ReactionGame';
import NotificationSystem, { useNotifications } from '../components/NotificationSystem';
import './GamePage.css';

const GamePage = ({ user }) => {
  // Hook pour les notifications (RÉDUIT)
  const {
    notification,
    hideNotification,
    showError,
    showSuccess,
    showVictory
  } = useNotifications();

  // États pour le système de jeux multiples
  const [availableGames] = useState([
    { id: 'trouve_le_chiffre', name: 'Trouve le chiffre', icon: '🎯' },
    { id: 'hangman', name: 'Jeu du pendu', icon: '🎪' },
    { id: 'memory', name: 'Memory Game', icon: '🧠' },
    { id: 'reaction', name: 'Jeu de Réaction', icon: '⚡' }
  ]);
  const [selectedGameType, setSelectedGameType] = useState(null);

  // États pour le système de clics
  const [clickCount, setClickCount] = useState(0);
  const [gameUnlocked, setGameUnlocked] = useState(false);
  
  // États pour les stats et leaderboards
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [gameLeaderboards, setGameLeaderboards] = useState({});
  const [userGames, setUserGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    if (user) {
      initializeUser();
      loadAllLeaderboards();
      loadUserGames();
    }
  }, [user]);

  // Initialiser l'utilisateur dans la BDD
  const initializeUser = async () => {
    try {
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('twitch_user_id', user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }

      let userId;
      if (!existingUser) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            twitch_user_id: user.id,
            twitch_username: user.login,
            twitch_display_name: user.display_name,
            profile_image_url: user.profile_image_url,
            email: user.email
          })
          .select()
          .single();

        if (createError) throw createError;
        userId = newUser.id;
      } else {
        userId = existingUser.id;
      }

      // Vérifier/créer les stats utilisateur
      const { data: stats, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (statsError && statsError.code === 'PGRST116') {
        const { data: newStats, error: createStatsError } = await supabase
          .from('user_stats')
          .insert({
            user_id: userId,
            total_games_played: 0,
            total_games_won: 0,
            total_clicks: 0,
            best_score: 0
          })
          .select()
          .single();
        
        if (!createStatsError) {
          setUserStats(newStats);
        }
      } else {
        setUserStats(stats);
      }
    } catch (error) {
      console.error('Erreur initialisation utilisateur:', error);
    }
  };

  // Charger tous les leaderboards
  const loadAllLeaderboards = async () => {
    try {
      // 1. Leaderboard global (basé sur total_games_won et best_score)
      const { data: globalData, error: globalError } = await supabase
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
        .limit(10);

      if (!globalError) {
        const formattedGlobal = globalData.map(stat => ({
          twitch_display_name: stat.users.twitch_display_name,
          profile_image_url: stat.users.profile_image_url,
          best_score: stat.best_score,
          total_games_won: stat.total_games_won,
          total_games_played: stat.total_games_played
        }));
        setGlobalLeaderboard(formattedGlobal);
      }

      // 2. Leaderboards par jeu
      const gameBoards = {};
      for (const game of availableGames) {
        const { data: gameData, error: gameError } = await supabase
          .from('game_sessions')
          .select(`
            score,
            won,
            game_type,
            users!inner(
              twitch_display_name,
              profile_image_url
            )
          `)
          .eq('game_type', game.id)
          .eq('won', true)
          .order('score', { ascending: false })
          .limit(10);

        if (!gameError && gameData) {
          gameBoards[game.id] = gameData.map(session => ({
            twitch_display_name: session.users.twitch_display_name,
            profile_image_url: session.users.profile_image_url,
            score: session.score,
            game_type: session.game_type
          }));
        }
      }
      setGameLeaderboards(gameBoards);

    } catch (error) {
      console.error('Erreur chargement leaderboards:', error);
    }
  };

  // Charger les jeux de l'utilisateur
  const loadUserGames = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userData) {
        const { data: userGameData, error } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', userData.id)
          .order('created_at', { ascending: false });

        if (!error) {
          // Grouper par type de jeu
          const gamesByType = availableGames.map(game => {
            const gameSessions = userGameData.filter(session => session.game_type === game.id);
            const wins = gameSessions.filter(session => session.won).length;
            const bestScore = gameSessions.length > 0 ? Math.max(...gameSessions.map(s => s.score)) : 0;
            
            return {
              ...game,
              played: gameSessions.length,
              won: wins,
              bestScore: bestScore,
              lastPlayed: gameSessions.length > 0 ? gameSessions[0].created_at : null
            };
          });
          
          setUserGames(gamesByType);
        }
      }
    } catch (error) {
      console.error('Erreur chargement jeux utilisateur:', error);
    }
  };

  // Gérer les clics sur le bouton streamer
  const handleStreamerClick = async () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userData) {
        await supabase
          .from('user_stats')
          .update({ 
            total_clicks: supabase.sql`total_clicks + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userData.id);
      }
    } catch (error) {
      console.error('Erreur mise à jour clics:', error);
    }

    if (newCount >= 50) {
      setGameUnlocked(true);
      const randomGame = availableGames[Math.floor(Math.random() * availableGames.length)];
      setSelectedGameType(randomGame);
      showSuccess(`Jeu débloqué ! "${randomGame.name}" sélectionné !`);
    }
  };

  // Gérer la completion de n'importe quel jeu (AVEC POSITION CLASSEMENT)
  const handleGameComplete = async (result) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (userData) {
        // Enregistrer la session de jeu
        await supabase
          .from('game_sessions')
          .insert({
            user_id: userData.id,
            game_type: selectedGameType.id,
            score: result.score,
            clicks_count: clickCount,
            duration: result.duration || 0,
            completed: true,
            won: result.won
          });

        // Récupérer les stats actuelles
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        if (currentStats) {
          // Calculer le nouveau meilleur score
          const newBestScore = result.won ? 
            Math.max(currentStats.best_score, result.score) : 
            currentStats.best_score;

          // Mettre à jour les statistiques
          await supabase
            .from('user_stats')
            .update({
              total_games_played: currentStats.total_games_played + 1,
              total_games_won: currentStats.total_games_won + (result.won ? 1 : 0),
              best_score: newBestScore,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userData.id);

          // Recharger tous les données
          await Promise.all([
            loadAllLeaderboards(),
            loadUserGames(),
            initializeUser()
          ]);
          
          // Calculer la position dans le classement global
          const { data: rankingData } = await supabase
            .from('user_stats')
            .select('total_games_won, users!inner(twitch_user_id)')
            .gt('total_games_played', 0)
            .order('total_games_won', { ascending: false })
            .order('best_score', { ascending: false });

          let userPosition = 1;
          if (rankingData) {
            const userIndex = rankingData.findIndex(stat => stat.users.twitch_user_id === user.id);
            userPosition = userIndex >= 0 ? userIndex + 1 : rankingData.length + 1;
          }

          // Notification avec position
          if (result.won) {
            showVictory(
              `Victoire ! Score: ${result.score} points`,
              `Vous êtes ${userPosition}${userPosition === 1 ? 'er' : 'ème'} au classement global !`
            );
          } else {
            showError(
              `Défaite ! ${result.targetNumber ? `Le nombre était ${result.targetNumber}` : 'Réessayez !'}`,
              `Position actuelle: ${userPosition}${userPosition === 1 ? 'er' : 'ème'} au classement`
            );
          }
        }
      }
    } catch (error) {
      console.error('Erreur validation:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recommencer
  const resetGame = () => {
    setClickCount(0);
    setGameUnlocked(false);
    setSelectedGameType(null);
  };

  if (!user) {
    return (
      <div className="game-page">
        <div className="auth-required">
          <h2>🎮 Connexion requise</h2>
          <p>Veuillez vous connecter avec Twitch pour jouer !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <h1>🎮 Pauvrathon Gaming</h1>
        <p>Bienvenue {user.display_name} !</p>
        
        {/* Stats utilisateur */}
        {userStats && (
          <div className="user-stats">
            <span>🎯 Parties: {userStats.total_games_played}</span>
            <span>🏆 Victoires: {userStats.total_games_won}</span>
            <span>⭐ Meilleur score: {userStats.best_score}</span>
          </div>
        )}
      </div>

      {/* Phase 1: Bouton Streamer (50 clics) */}
      {!gameUnlocked && (
        <div className="streamer-section">
          <h2>Soutenez votre streamer préféré !</h2>
          <div className="streamer-card">
            <img src={user.profile_image_url} alt={user.display_name} className="streamer-avatar" />
            <h3>{user.display_name}</h3>
            <button 
              className="streamer-btn"
              onClick={handleStreamerClick}
            >
              ❤️ Soutenir ({clickCount}/50)
            </button>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(clickCount / 50) * 100}%` }}
              ></div>
            </div>
            {clickCount > 0 && clickCount < 50 && (
              <p className="encouragement">Plus que {50 - clickCount} clics pour débloquer un jeu au hasard !</p>
            )}
            {clickCount >= 50 && (
              <p className="unlock-message">🎉 Jeu débloqué ! Lancement de "{selectedGameType?.name}"...</p>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Jeu débloqué */}
      {gameUnlocked && selectedGameType && (
        <div className="game-container">
          <div className="game-header-info">
            <h2>{selectedGameType.icon} {selectedGameType.name}</h2>
            <p>Jeu sélectionné aléatoirement pour {user.display_name}</p>
          </div>

          {/* Jeu "Trouve le chiffre" */}
          {selectedGameType.id === 'trouve_le_chiffre' && (
            <NumberGuessGame onGameComplete={handleGameComplete} />
          )}

          {/* Jeu du Pendu */}
          {selectedGameType.id === 'hangman' && (
            <HangmanGame onGameComplete={handleGameComplete} />
          )}

          {/* Memory Game */}
          {selectedGameType.id === 'memory' && (
            <MemoryGame onGameComplete={handleGameComplete} />
          )}

          {/* Reaction Game */}
          {selectedGameType.id === 'reaction' && (
            <ReactionGame onGameComplete={handleGameComplete} />
          )}

          <button className="reset-btn" onClick={resetGame}>
            🔄 Revenir à l'accueil
          </button>
        </div>
      )}

      {/* Mes jeux joués */}
      <div className="user-games-section">
        <h2>🎮 Mes jeux</h2>
        <div className="user-games-grid">
          {userGames.map((game) => (
            <div key={game.id} className="user-game-card">
              <div className="game-icon-large">{game.icon}</div>
              <h3>{game.name}</h3>
              <div className="game-stats">
                <p>🎯 Joué: {game.played} fois</p>
                <p>🏆 Gagné: {game.won} fois</p>
                <p>⭐ Meilleur: {game.bestScore} pts</p>
                {game.lastPlayed && (
                  <p className="last-played">
                    Dernière fois: {new Date(game.lastPlayed).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Classement global */}
      <div className="leaderboard-section">
        <h2>🏆 Classement global</h2>
        {globalLeaderboard.length > 0 ? (
          <div className="leaderboard">
            {globalLeaderboard.map((player, index) => (
              <div key={index} className={`leaderboard-item ${player.twitch_display_name === user.display_name ? 'current-user' : ''}`}>
                <span className="rank">#{index + 1}</span>
                <img src={player.profile_image_url} alt={player.twitch_display_name} className="player-avatar" />
                <span className="player-name">{player.twitch_display_name}</span>
                <span className="player-score">{player.best_score} pts</span>
                <span className="player-games">{player.total_games_won}W/{player.total_games_played}G</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Aucun score enregistré pour le moment.</p>
        )}
      </div>

      {/* Classements par jeu */}
      <div className="game-leaderboards-section">
        <h2>🎯 Top 10 par jeu</h2>
        <div className="game-leaderboards-grid">
          {availableGames.map((game) => (
            <div key={game.id} className="game-leaderboard">
              <h3>{game.icon} {game.name}</h3>
              {gameLeaderboards[game.id] && gameLeaderboards[game.id].length > 0 ? (
                <div className="mini-leaderboard">
                  {gameLeaderboards[game.id].slice(0, 5).map((player, index) => (
                    <div key={index} className={`mini-leaderboard-item ${player.twitch_display_name === user.display_name ? 'current-user' : ''}`}>
                      <span className="mini-rank">#{index + 1}</span>
                      <img src={player.profile_image_url} alt={player.twitch_display_name} className="mini-avatar" />
                      <span className="mini-name">{player.twitch_display_name}</span>
                      <span className="mini-score">{player.score}</span>
                    </div>
                  ))}
                  {gameLeaderboards[game.id].length > 5 && (
                    <p className="more-players">+{gameLeaderboards[game.id].length - 5} autres joueurs</p>
                  )}
                </div>
              ) : (
                <p className="no-scores">Aucun score encore</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Système de notifications */}
      <NotificationSystem
        notification={notification}
        onClose={hideNotification}
      />
    </div>
  );
};

export default GamePage;