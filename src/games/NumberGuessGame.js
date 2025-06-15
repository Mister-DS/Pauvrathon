import React, { useState, useEffect } from 'react';
import NotificationSystem, { useNotifications } from '../components/NotificationSystem';
import './NumberGuessGame.css';

const NumberGuessGame = ({ onGameComplete }) => {
  // Hook pour les notifications (SEULEMENT victoire/défaite)
  const {
    notification,
    hideNotification,
    showVictory,
    showError
  } = useNotifications();

  // États du jeu
  const [gameStarted, setGameStarted] = useState(false);
  const [targetNumber, setTargetNumber] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [hintMessage, setHintMessage] = useState('');
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [maxAttempts] = useState(15);

  // Démarrer une nouvelle partie
  const startGame = () => {
    const newTarget = Math.floor(Math.random() * 151);
    setTargetNumber(newTarget);
    setAttempts(0);
    setGuesses([]);
    setCurrentGuess('');
    setHintMessage('Devinez un nombre entre 0 et 150');
    setGameStarted(true);
    setGameWon(false);
    setGameLost(false);
    setStartTime(new Date());
  };

  // Vérifier la supposition
  const checkGuess = () => {
    const guess = parseInt(currentGuess);
    
    // Validation simple (PAS de notifications)
    if (isNaN(guess) || guess < 0 || guess > 150) {
      return; // Juste ignorer les entrées invalides
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    let result = {};

    if (guess < targetNumber) {
      result = { guess, hint: 'plus grand', color: 'blue' };
      setHintMessage(`C'est plus grand ! (${newAttempts}/${maxAttempts})`);
    } else if (guess > targetNumber) {
      result = { guess, hint: 'plus petit', color: 'red' };
      setHintMessage(`C'est plus petit ! (${newAttempts}/${maxAttempts})`);
    } else {
      // Victoire !
      result = { guess, hint: 'gagné', color: 'green' };
      setHintMessage(`🎉 Bravo ! Trouvé en ${newAttempts} coups !`);
      setGameWon(true);
      
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      const score = Math.max(1, 10 - Math.floor((newAttempts - 1) / 2));
      
      if (onGameComplete) {
        onGameComplete({
          won: true,
          score: score,
          attempts: newAttempts,
          duration: duration,
          targetNumber: targetNumber
        });
      }
    }

    setGuesses([...guesses, result]);
    setCurrentGuess('');

    // Vérifier défaite
    if (newAttempts >= maxAttempts && !gameWon) {
      setGameLost(true);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      if (onGameComplete) {
        onGameComplete({
          won: false,
          score: 0,
          attempts: newAttempts,
          duration: duration,
          targetNumber: targetNumber
        });
      }
    }

    // AUCUNE notification pendant le jeu !
  };

  // Gérer la touche Entrée
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !gameWon && !gameLost && currentGuess) {
      checkGuess();
    }
  };

  // Réinitialiser le jeu
  const resetGame = () => {
    setGameStarted(false);
    setTargetNumber(null);
    setAttempts(0);
    setGuesses([]);
    setCurrentGuess('');
    setHintMessage('');
    setGameWon(false);
    setGameLost(false);
    setStartTime(null);
  };

  return (
    <div className="number-guess-game">
      <h2>🎯 Trouve le chiffre</h2>
      
      <div className="game-controls">
        <div className="game-info">
          <p><strong>Objectif :</strong> Trouvez le nombre entre 0 et 150</p>
          <p><strong>Tentatives :</strong> {attempts}/{maxAttempts}</p>
          <div className="control-buttons">
            <button onClick={startGame} className="start-btn">
              {gameStarted ? 'Nouveau nombre' : 'Démarrer'}
            </button>
            <button onClick={resetGame} className="reset-btn">Réinitialiser</button>
          </div>
        </div>
      </div>

      {gameStarted && (
        <>
          <div className="game-progress">
            <div className="progress-info">
              <span>Progression: {attempts}/{maxAttempts}</span>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${(attempts / maxAttempts) * 100}%`,
                    backgroundColor: attempts > maxAttempts * 0.8 ? '#f44336' : '#4caf50'
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="game-input-section">
            <div className="hint-message">
              {hintMessage}
            </div>

            <div className="number-input">
              <input
                type="number"
                min="0"
                max="150"
                value={currentGuess}
                onChange={(e) => setCurrentGuess(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Entrez un nombre (0-150)"
                disabled={gameWon || gameLost}
                autoFocus
                className="guess-input"
              />
              <button 
                onClick={checkGuess}
                disabled={gameWon || gameLost || !currentGuess}
                className="guess-btn"
              >
                {gameWon || gameLost ? 'Terminé' : 'Vérifier'}
              </button>
            </div>
          </div>

          {guesses.length > 0 && (
            <div className="guesses-history">
              <h3>Historique :</h3>
              <div className="guesses-grid">
                {guesses.map((guess, index) => (
                  <div key={index} className={`guess-item guess-${guess.color}`}>
                    <span className="guess-number">{guess.guess}</span>
                    <span className="guess-hint">{guess.hint}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gameWon && (
            <div className="game-result win">
              <h3>🎉 Félicitations !</h3>
              <p>Le nombre était : <strong>{targetNumber}</strong></p>
              <p>Trouvé en : <strong>{attempts}</strong> tentative{attempts > 1 ? 's' : ''}</p>
              <p>Score : <strong>{Math.max(10, 100 - (attempts - 1) * 6)}/10</strong></p>
            </div>
          )}

          {gameLost && (
            <div className="game-result lose">
              <h3>😞 Vous avez perdu !</h3>
              <p>Le nombre était : <strong>{targetNumber}</strong></p>
              <button onClick={startGame} className="retry-btn">Réessayer</button>
            </div>
          )}
        </>
      )}

      {!gameStarted && (
        <div className="game-instructions">
          <h3>📋 Instructions</h3>
          <ul>
            <li>Un nombre entre 0 et 150 est choisi aléatoirement</li>
            <li>Vous avez {maxAttempts} tentatives pour le trouver</li>
            <li>Après chaque tentative, vous aurez un indice</li>
            <li>Plus vous trouvez rapidement, plus votre score sera élevé</li>
          </ul>
        </div>
      )}

      {/* Système de notifications - SEULEMENT pour victoire/défaite avec classement */}
      <NotificationSystem
        notification={notification}
        onClose={hideNotification}
      />
    </div>
  );
};

export default NumberGuessGame;