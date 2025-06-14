import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './GamePage.css';

const GamePage = ({ user }) => {
  // États pour le système de clics
  const [clickCount, setClickCount] = useState(0);
  const [gameUnlocked, setGameUnlocked] = useState(false);
  
  // États pour le jeu "Trouve le chiffre"
  const [gameStarted, setGameStarted] = useState(false);
  const [targetNumber, setTargetNumber] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [hintMessage, setHintMessage] = useState('');
  const [gameWon, setGameWon] = useState(false);
  const [showValidateButton, setShowValidateButton] = useState(false);
  
  // États pour les stats
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      initializeUser();
      loadLeaderboard();
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

      const { data: stats, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (statsError && statsError.code === 'PGRST116') {
        await supabase
          .from('user_stats')
          .insert({
            user_id: userId,
            total_games_played: 0,
            total_games_won: 0,
            total_clicks: 0,
            best_score: 0
          });
      }
    } catch (error) {
      console.error('Erreur initialisation utilisateur:', error);
    }
  };

  // Charger le classement
  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(10);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Erreur chargement classement:', error);
    }
  };

  // Gérer les clics sur le bouton streamer
  const handleStreamerClick = async () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    // Mettre à jour les clics en BDD
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

    // Débloquer le jeu à 50 clics
    if (newCount >= 50) {
      setGameUnlocked(true);
      // Lancer automatiquement le jeu "Trouve le chiffre"
      setTimeout(() => {
        startGame();
      }, 1000);
    }
  };

  // Démarrer le jeu
  const startGame = () => {
    setGameStarted(true);
    setTargetNumber(Math.floor(Math.random() * 150));
    setAttempts(0);
    setGuesses([]);
    setCurrentGuess('');
    setHintMessage('Devinez un nombre entre 0 et 150');
    setGameWon(false);
    setShowValidateButton(false);
  };

  // Vérifier la supposition
  const checkGuess = () => {
    const guess = parseInt(currentGuess);
    
    if (isNaN(guess)) {
      alert('Veuillez entrer un nombre valide');
      return;
    }

    if (guess > 150) {
      alert('Le nombre doit être entre 0 et 150');
      return;
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    let result = {};
    if (guess < targetNumber) {
      result = { guess, hint: 'plus grand', color: 'blue' };
      setHintMessage('C\'est plus grand !');
    } else if (guess > targetNumber) {
      result = { guess, hint: 'plus petit', color: 'red' };
      setHintMessage('C\'est plus petit !');
    } else {
      result = { guess, hint: 'gagné', color: 'green' };
      setHintMessage(`🎉 Bravo ! Vous avez trouvé en ${newAttempts} coups !`);
      setGameWon(true);
      setShowValidateButton(true);
    }

    setGuesses([...guesses, result]);
    setCurrentGuess('');
  };

  // Gérer la touche Entrée
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !gameWon && currentGuess) {
      checkGuess();
    }
  };

  // Valider la victoire et sauvegarder en BDD
  const validateVictory = async () => {
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
            game_type: 'trouve_le_chiffre',
            score: attempts,
            clicks_count: clickCount,
            duration: 0,
            completed: true,
            won: true
          });

        // Mettre à jour les statistiques
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userData.id)
          .single();

        const newBestScore = currentStats.best_score === 0 ? attempts : Math.min(currentStats.best_score, attempts);

        await supabase
          .from('user_stats')
          .update({
            total_games_played: currentStats.total_games_played + 1,
            total_games_won: currentStats.total_games_won + 1,
            best_score: newBestScore,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userData.id);

        // Recharger le classement
        await loadLeaderboard();
        
        alert('🎉 Victoire enregistrée ! Consultez le classement.');
        setShowValidateButton(false);
      }
    } catch (error) {
      console.error('Erreur validation victoire:', error);
      alert('❌ Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  // Recommencer
  const resetGame = () => {
    setGameStarted(false);
    setGameWon(false);
    setShowValidateButton(false);
    setClickCount(0);
    setGameUnlocked(false);
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
              <p className="unlock-message">🎉 Jeu débloqué ! Lancement du jeu...</p>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Jeu "Trouve le chiffre" */}
      {gameStarted && (
        <div className="number-game">
          <div className="game-info">
            <h2>🎯 Trouve le chiffre</h2>
            <p>Joueur: <strong>{user.display_name}</strong></p>
            <p>Tentatives: <strong>{attempts}</strong></p>
            <p>Nombre mystère entre <strong>0</strong> et <strong>150</strong></p>
          </div>

          <div className="game-input">
            <input
              type="number"
              min="0"
              max="150"
              value={currentGuess}
              onChange={(e) => setCurrentGuess(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Entrez un nombre (0-150)"
              disabled={gameWon}
              autoFocus
            />
            <button 
              onClick={checkGuess}
              disabled={gameWon || !currentGuess}
            >
              Vérifier
            </button>
          </div>

          <div className="hint-message">
            {hintMessage}
          </div>

          {guesses.length > 0 && (
            <div className="guesses-list">
              <h3>Vos tentatives:</h3>
              <ul>
                {guesses.map((guess, index) => (
                  <li key={index} className={`guess-${guess.color}`}>
                    {guess.guess} ({guess.hint})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showValidateButton && (
            <div className="validate-section">
              <h3>🎉 Félicitations ! Vous avez gagné !</h3>
              <button 
                className="validate-btn"
                onClick={validateVictory}
                disabled={loading}
              >
                {loading ? '⏳ Enregistrement...' : '✅ Valider ma victoire'}
              </button>
            </div>
          )}

          <button className="reset-btn" onClick={resetGame}>
            🔄 Recommencer
          </button>
        </div>
      )}

      {/* Classement */}
      <div className="leaderboard-section">
        <h2>🏆 Classement - Trouve le chiffre</h2>
        {leaderboard.length > 0 ? (
          <div className="leaderboard">
            {leaderboard.map((player, index) => (
              <div key={index} className="leaderboard-item">
                <span className="rank">#{index + 1}</span>
                <img src={player.profile_image_url} alt={player.twitch_display_name} className="player-avatar" />
                <span className="player-name">{player.twitch_display_name}</span>
                <span className="player-score">{player.best_score} coups</span>
                <span className="player-games">{player.total_games_won}W/{player.total_games_played}G</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Aucun score enregistré pour le moment. Soyez le premier !</p>
        )}
      </div>
    </div>
  );
};

export default GamePage;