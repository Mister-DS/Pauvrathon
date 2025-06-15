import React, { useState, useEffect } from 'react';
import NotificationSystem, { useNotifications } from '../components/NotificationSystem';
import './ReactionGame.css';

const ReactionGame = ({ onGameComplete }) => {
  // Hook pour les notifications (SEULEMENT victoire/défaite)
  const {
    notification,
    hideNotification,
    showVictory,
    showError
  } = useNotifications();

  // États du jeu
  const [gameStarted, setGameStarted] = useState(false);
  const [waitingForGreen, setWaitingForGreen] = useState(false);
  const [showGreen, setShowGreen] = useState(false);
  const [reactionTime, setReactionTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [gameTime, setGameTime] = useState(null);
  const [round, setRound] = useState(1);
  const [maxRounds] = useState(5);
  const [allTimes, setAllTimes] = useState([]);
  const [gameFinished, setGameFinished] = useState(false);
  const [tooEarly, setTooEarly] = useState(false);

  // Démarrer le jeu
  const startGame = () => {
    setGameStarted(true);
    setGameFinished(false);
    setRound(1);
    setAllTimes([]);
    setReactionTime(null);
    setTooEarly(false);
    setGameTime(new Date());
    startRound();
  };

  // Démarrer un round
  const startRound = () => {
    setWaitingForGreen(true);
    setShowGreen(false);
    setReactionTime(null);
    setTooEarly(false);
    
    // Attendre entre 2 et 6 secondes avant d'afficher le vert
    const delay = Math.random() * 4000 + 2000;
    
    setTimeout(() => {
      if (waitingForGreen) {
        setShowGreen(true);
        setStartTime(new Date());
      }
    }, delay);
  };

  // Gérer le clic
  const handleClick = () => {
    if (!gameStarted || gameFinished) return;
    
    if (!showGreen && waitingForGreen) {
      // Cliqué trop tôt !
      setTooEarly(true);
      setWaitingForGreen(false);
      
      setTimeout(() => {
        if (round < maxRounds) {
          setRound(round + 1);
          startRound();
        } else {
          finishGame();
        }
      }, 2000);
      
      return;
    }
    
    if (showGreen && startTime) {
      // Bonne réaction !
      const endTime = new Date();
      const reactionMs = endTime - startTime;
      setReactionTime(reactionMs);
      setAllTimes([...allTimes, reactionMs]);
      setWaitingForGreen(false);
      setShowGreen(false);
      
      setTimeout(() => {
        if (round < maxRounds) {
          setRound(round + 1);
          startRound();
        } else {
          finishGame();
        }
      }, 2000);
    }
  };

  // Terminer le jeu
  const finishGame = () => {
    setGameFinished(true);
    setWaitingForGreen(false);
    setShowGreen(false);
    
    const endTime = new Date();
    const totalDuration = Math.floor((endTime - gameTime) / 1000);
    
    // Calculer la moyenne des temps (exclure les temps trop tôt)
    const validTimes = allTimes.filter(time => time > 0);
    const averageTime = validTimes.length > 0 ? 
      Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : 
      999;
    
    // Calculer le score (meilleur = plus bas temps de réaction)
    const baseScore = 1000;
    const timePenalty = Math.min(averageTime, 800); // Max penalty 800
    const finalScore = Math.max(100, baseScore - timePenalty);
    
    // Déterminer si c'est une victoire (temps moyen < 400ms)
    const won = averageTime < 400 && validTimes.length >= 3;
    
    if (won) {
      showVictory(
        `Excellents réflexes ! ⚡`,
        `Temps moyen: ${averageTime}ms`
      );
    } else {
      showError(
        `Pas mal ! 🎯`,
        `Temps moyen: ${averageTime}ms - Essayez d'être plus rapide !`
      );
    }
    
    if (onGameComplete) {
      onGameComplete({
        won: won,
        score: finalScore,
        attempts: maxRounds,
        duration: totalDuration,
        averageReaction: averageTime
      });
    }
  };

  // Réinitialiser le jeu
  const resetGame = () => {
    setGameStarted(false);
    setWaitingForGreen(false);
    setShowGreen(false);
    setReactionTime(null);
    setStartTime(null);
    setGameTime(null);
    setRound(1);
    setAllTimes([]);
    setGameFinished(false);
    setTooEarly(false);
  };

  // Calculer l'état actuel
  const getGameState = () => {
    if (!gameStarted) return 'ready';
    if (gameFinished) return 'finished';
    if (tooEarly) return 'tooEarly';
    if (waitingForGreen && !showGreen) return 'waiting';
    if (showGreen) return 'react';
    if (reactionTime) return 'result';
    return 'ready';
  };

  const gameState = getGameState();

  return (
    <div className="reaction-game">
      <h2>⚡ Jeu de Réaction</h2>
      
      <div className="game-controls">
        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">🎯 Round:</span>
            <span className="stat-value">{round}/{maxRounds}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">⏱️ Dernier:</span>
            <span className="stat-value">
              {reactionTime ? `${reactionTime}ms` : '-'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">📊 Moyenne:</span>
            <span className="stat-value">
              {allTimes.length > 0 ? 
                `${Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)}ms` : 
                '-'
              }
            </span>
          </div>
        </div>
        
        <div className="control-buttons">
          <button onClick={startGame} className="start-btn" disabled={gameStarted && !gameFinished}>
            {gameStarted && !gameFinished ? 'En cours...' : 'Démarrer'}
          </button>
          <button onClick={resetGame} className="reset-btn">Réinitialiser</button>
        </div>
      </div>

      {gameStarted && (
        <div className="reaction-area">
          <div 
            className={`reaction-circle ${gameState}`}
            onClick={handleClick}
          >
            <div className="circle-content">
              {gameState === 'waiting' && (
                <div className="waiting-content">
                  <span className="waiting-text">Attendez...</span>
                  <div className="pulse-animation"></div>
                </div>
              )}
              
              {gameState === 'react' && (
                <div className="react-content">
                  <span className="react-text">CLIQUEZ !</span>
                  <span className="react-emoji">⚡</span>
                </div>
              )}
              
              {gameState === 'result' && reactionTime && (
                <div className="result-content">
                  <span className="result-time">{reactionTime}ms</span>
                  <span className="result-emoji">
                    {reactionTime < 200 ? '🏆' : 
                     reactionTime < 300 ? '🥈' : 
                     reactionTime < 400 ? '🥉' : '👍'}
                  </span>
                </div>
              )}
              
              {gameState === 'tooEarly' && (
                <div className="too-early-content">
                  <span className="too-early-text">Trop tôt !</span>
                  <span className="too-early-emoji">❌</span>
                </div>
              )}
              
              {gameState === 'finished' && (
                <div className="finished-content">
                  <span className="finished-text">Terminé !</span>
                  <span className="finished-emoji">🎉</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="game-instruction">
            {gameState === 'waiting' && "Attendez que le cercle devienne vert..."}
            {gameState === 'react' && "Cliquez maintenant !"}
            {gameState === 'result' && `Round ${round}/${maxRounds} - ${reactionTime < 300 ? 'Excellent !' : 'Pas mal !'}`}
            {gameState === 'tooEarly' && "Trop tôt ! Attendez le vert la prochaine fois."}
            {gameState === 'finished' && `Jeu terminé ! Moyenne: ${allTimes.length > 0 ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length) : 0}ms`}
          </div>
        </div>
      )}

      {/* Historique des temps */}
      {allTimes.length > 0 && (
        <div className="times-history">
          <h4>📊 Historique des réactions:</h4>
          <div className="times-list">
            {allTimes.map((time, index) => (
              <div key={index} className="time-item">
                <span className="round-number">R{index + 1}:</span>
                <span className="time-value">{time}ms</span>
                <span className="time-rating">
                  {time < 200 ? '🏆' : 
                   time < 300 ? '🥈' : 
                   time < 400 ? '🥉' : '👍'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!gameStarted && (
        <div className="game-instructions">
          <h3>📋 Instructions</h3>
          <ul>
            <li>Cliquez sur "Démarrer" pour commencer</li>
            <li>Attendez que le cercle rouge devienne vert</li>
            <li>Cliquez le plus rapidement possible quand c'est vert</li>
            <li>Ne cliquez pas avant ! (pénalité)</li>
            <li>5 rounds au total</li>
            <li>Objectif: temps moyen &lt; 400ms pour gagner</li>
          </ul>
          
          <div className="scoring-info">
            <h4>🏆 Scoring:</h4>
            <p>• &lt; 200ms: Excellent 🏆</p>
            <p>• &lt; 300ms: Très bien 🥈</p>
            <p>• &lt; 400ms: Bien 🥉</p>
            <p>• &gt; 400ms: À améliorer 👍</p>
          </div>
        </div>
      )}

      {/* Système de notifications */}
      <NotificationSystem
        notification={notification}
        onClose={hideNotification}
      />
    </div>
  );
};

export default ReactionGame;