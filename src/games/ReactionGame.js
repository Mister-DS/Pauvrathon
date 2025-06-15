import React, { useState, useEffect, useRef } from 'react';
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
  const [maxRounds] = useState(3);
  const [allTimes, setAllTimes] = useState([]);
  const [gameFinished, setGameFinished] = useState(false);
  const [tooEarly, setTooEarly] = useState(false);
  
  // Refs pour éviter les problèmes de closure
  const timeoutRef = useRef(null);
  const isActiveRef = useRef(false);

  // Cleanup des timeouts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Démarrer le jeu
  const startGame = () => {
    // Reset complet de tous les états
    setGameStarted(true);
    setGameFinished(false);
    setRound(1);
    setAllTimes([]);
    setReactionTime(null);
    setTooEarly(false);
    setWaitingForGreen(false);
    setShowGreen(false);
    setStartTime(null);
    setGameTime(new Date());
    isActiveRef.current = true;
    
    // Démarrer le premier round après un petit délai
    setTimeout(() => {
      if (isActiveRef.current) {
        startRound();
      }
    }, 1000);
  };

// Démarrer un round - VERSION FINALE
const startRound = () => {
  if (!isActiveRef.current) return;
  
  // Reset des états
  setWaitingForGreen(true);
  setShowGreen(false);
  setReactionTime(null);
  setTooEarly(false);
  setStartTime(null);
  
  // Nettoyer le timeout précédent
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }
  
  // Attendre entre 2 et 6 secondes avant d'afficher le vert
  const delay = Math.random() * 4000 + 2000;
  
  timeoutRef.current = setTimeout(() => {
    // Utiliser une ref pour éviter les problèmes de closure
    if (isActiveRef.current) {
      setWaitingForGreen(false); // Important !
      setShowGreen(true);
      setStartTime(new Date());
    }
  }, delay);
};

  // Gérer le clic
  const handleClick = () => {
    if (!gameStarted || gameFinished || !isActiveRef.current) return;
    
    if (!showGreen && waitingForGreen) {
      // Cliqué trop tôt !
      setTooEarly(true);
      setWaitingForGreen(false);
      setShowGreen(false);
      
      // Nettoyer le timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      setTimeout(() => {
        if (isActiveRef.current) {
          if (round < maxRounds) {
            setRound(prev => prev + 1);
            startRound();
          } else {
            finishGame();
          }
        }
      }, 2000);
      
      return;
    }
    
    if (showGreen && startTime) {
      // Bonne réaction !
      const endTime = new Date();
      const reactionMs = endTime - startTime;
      setReactionTime(reactionMs);
      setAllTimes(prev => [...prev, reactionMs]);
      setWaitingForGreen(false);
      setShowGreen(false);
      
      setTimeout(() => {
        if (isActiveRef.current) {
          if (round < maxRounds) {
            setRound(prev => prev + 1);
            startRound();
          } else {
            finishGame();
          }
        }
      }, 2000);
    }
  };

  // Fonction pour calculer le score Reaction Game
const calculateReactionScore = (averageTime, validAttempts, won) => {
  if (!won || validAttempts < 3) return 1;
  
  let score = 1;
  
  if (averageTime < 200) score = 10;      // Excellent
  else if (averageTime < 250) score = 9;  // Très très bien
  else if (averageTime < 300) score = 8;  // Très bien  
  else if (averageTime < 350) score = 7;  // Bien
  else if (averageTime < 400) score = 6;  // Correct
  else if (averageTime < 450) score = 5;  // Moyen
  else if (averageTime < 500) score = 4;  // En dessous
  else if (averageTime < 600) score = 3;  // Lent
  else score = 2;                         // Très lent
  
  // Bonus pour 5 rounds réussis
  if (validAttempts === 5) score = Math.min(10, score + 1);
  
  return score;
};

  // Terminer le jeu
  const finishGame = () => {
    if (!isActiveRef.current) return;
    
    setGameFinished(true);
    setWaitingForGreen(false);
    setShowGreen(false);
    isActiveRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const endTime = new Date();
    const totalDuration = Math.floor((endTime - gameTime) / 1000);
    const validTimes = allTimes.filter(time => time > 0);
    const averageTime = validTimes.length > 0 ? 
      Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : 999;
    
    const won = averageTime < 400 && validTimes.length >= 3;
    const finalScore = calculateReactionScore(averageTime, validTimes.length, won);
    
    if (won) {
      showVictory(
        `Excellents réflexes ! ⚡`,
        `Score: ${finalScore} pts - Temps moyen: ${averageTime}ms`
      );
    } else {
      showError(
        `Essayez encore ! 🎯`,
        `Score: ${finalScore} pts - Temps moyen: ${averageTime}ms`
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
    // Arrêter le jeu en cours
    isActiveRef.current = false;
    
    // Nettoyer le timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Reset de tous les états
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
          <button 
            onClick={startGame} 
            className="start-btn" 
            disabled={gameStarted && !gameFinished}
          >
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
            <li>3 rounds au total</li>
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