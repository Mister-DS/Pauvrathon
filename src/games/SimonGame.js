import React, { useState, useEffect, useCallback } from 'react';
import NotificationSystem, { useNotifications } from '../components/NotificationSystem';
import './SimonGame.css';

const SimonGame = ({ onGameComplete }) => {
  // Hook pour les notifications (SEULEMENT victoire/défaite)
  const {
    notification,
    hideNotification,
    showVictory,
    showError
  } = useNotifications();

  // Couleurs du jeu Simon
  const colors = [
    { id: 0, name: 'red', color: '#ff4757', sound: '🔴' },
    { id: 1, name: 'blue', color: '#3742fa', sound: '🔵' },
    { id: 2, name: 'green', color: '#2ed573', sound: '🟢' },
    { id: 3, name: 'yellow', color: '#ffa502', sound: '🟡' }
  ];

  // États du jeu
  const [gameStarted, setGameStarted] = useState(false);
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [activeColor, setActiveColor] = useState(null);
  const [score, setScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [level, setLevel] = useState(1);
  const [maxLevel] = useState(10); // Niveau maximum pour gagner

  // Générer la prochaine couleur de la séquence
  const addToSequence = useCallback(() => {
    const randomColor = Math.floor(Math.random() * colors.length);
    setSequence(prev => [...prev, randomColor]);
  }, []);

  // Jouer la séquence
  const playSequence = useCallback(async () => {
    setIsPlayerTurn(false);
    setPlayerSequence([]);
    setCurrentStep(0);
    
    for (let i = 0; i < sequence.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setActiveColor(sequence[i]);
      await new Promise(resolve => setTimeout(resolve, 400));
      setActiveColor(null);
    }
    
    setIsPlayerTurn(true);
  }, [sequence]);

  // Démarrer le jeu
  const startGame = () => {
    const newSequence = [Math.floor(Math.random() * colors.length)];
    setSequence(newSequence);
    setPlayerSequence([]);
    setCurrentStep(0);
    setIsPlayerTurn(false);
    setActiveColor(null);
    setScore(0);
    setGameStarted(true);
    setGameWon(false);
    setGameLost(false);
    setStartTime(new Date());
    setLevel(1);
    
    // AUCUNE notification pour démarrage
  };

  // Jouer la séquence au démarrage et à chaque nouveau niveau
  useEffect(() => {
    if (gameStarted && sequence.length > 0 && !isPlayerTurn && !gameWon && !gameLost) {
      const timer = setTimeout(() => {
        playSequence();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [sequence, gameStarted, isPlayerTurn, gameWon, gameLost, playSequence]);

  // Gérer le clic sur une couleur
  const handleColorClick = (colorId) => {
    if (!isPlayerTurn || gameWon || gameLost) return;

    const newPlayerSequence = [...playerSequence, colorId];
    setPlayerSequence(newPlayerSequence);

    // Vérifier si la couleur est correcte
    if (colorId === sequence[currentStep]) {
      // Bonne couleur !
      setActiveColor(colorId);
      setTimeout(() => setActiveColor(null), 200);
      
      const newStep = currentStep + 1;
      setCurrentStep(newStep);

      // Vérifier si la séquence est complète
      if (newStep === sequence.length) {
        // Séquence complète réussie !
        const newScore = score + sequence.length * 10;
        setScore(newScore);
        setLevel(level + 1);
        
        // AUCUNE notification pour niveau réussi

        // Vérifier la victoire
        if (level >= maxLevel) {
          setGameWon(true);
          const endTime = new Date();
          const duration = Math.floor((endTime - startTime) / 1000);
          
          if (onGameComplete) {
            onGameComplete({
              won: true,
              score: newScore,
              attempts: level,
              duration: duration
            });
          }
        } else {
          // Passer au niveau suivant
          setTimeout(() => {
            addToSequence();
          }, 1500);
        }
      }
    } else {
      // Mauvaise couleur - Game Over
      setGameLost(true);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      if (onGameComplete) {
        onGameComplete({
          won: false,
          score: score,
          attempts: level,
          duration: duration
        });
      }
    }
  };

  // Réinitialiser le jeu
  const resetGame = () => {
    setGameStarted(false);
    setSequence([]);
    setPlayerSequence([]);
    setCurrentStep(0);
    setIsPlayerTurn(false);
    setActiveColor(null);
    setScore(0);
    setGameWon(false);
    setGameLost(false);
    setStartTime(null);
    setLevel(1);
    
    // AUCUNE notification pour reset
  };

  return (
    <div className="simon-game">
      <h2>🎵 Simon Game</h2>
      
      <div className="game-controls">
        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">🎯 Niveau:</span>
            <span className="stat-value">{level}/{maxLevel}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">⭐ Score:</span>
            <span className="stat-value">{score}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">🔢 Séquence:</span>
            <span className="stat-value">{sequence.length}</span>
          </div>
        </div>
        
        <div className="game-status">
          {!gameStarted && <span>Appuyez sur Démarrer</span>}
          {gameStarted && !isPlayerTurn && !gameWon && !gameLost && (
            <span className="status-watching">👀 Regardez la séquence...</span>
          )}
          {isPlayerTurn && !gameWon && !gameLost && (
            <span className="status-playing">🎮 À votre tour ! ({currentStep + 1}/{sequence.length})</span>
          )}
        </div>
        
        <div className="control-buttons">
          <button onClick={startGame} className="start-btn">
            {gameStarted ? 'Nouvelle partie' : 'Démarrer'}
          </button>
          <button onClick={resetGame} className="reset-btn">Réinitialiser</button>
        </div>
      </div>

      {gameStarted && (
        <div className="simon-board">
          {colors.map((color) => (
            <button
              key={color.id}
              className={`simon-button simon-${color.name} ${
                activeColor === color.id ? 'active' : ''
              }`}
              style={{ backgroundColor: color.color }}
              onClick={() => handleColorClick(color.id)}
              disabled={!isPlayerTurn}
            >
              <span className="color-emoji">{color.sound}</span>
            </button>
          ))}
        </div>
      )}

      {gameStarted && (
        <div className="sequence-display">
          <h4>Séquence actuelle:</h4>
          <div className="sequence-dots">
            {sequence.map((colorId, index) => (
              <div
                key={index}
                className={`sequence-dot ${
                  index < currentStep ? 'completed' : 
                  index === currentStep ? 'current' : 'pending'
                }`}
                style={{ backgroundColor: colors[colorId].color }}
              >
                {colors[colorId].sound}
              </div>
            ))}
          </div>
        </div>
      )}

      {gameWon && (
        <div className="game-result win">
          <h3>🏆 Félicitations ! Maître Simon !</h3>
          <p>Tous les {maxLevel} niveaux réussis !</p>
          <p>Score final: <strong>{score}</strong></p>
        </div>
      )}

      {gameLost && (
        <div className="game-result lose">
          <h3>😞 Game Over !</h3>
          <p>Niveau atteint: <strong>{level}</strong></p>
          <p>Score final: <strong>{score}</strong></p>
          <button onClick={startGame} className="retry-btn">Réessayer</button>
        </div>
      )}

      {!gameStarted && (
        <div className="game-instructions">
          <h3>📋 Instructions</h3>
          <ul>
            <li>Regardez la séquence de couleurs qui s'allument</li>
            <li>Répétez la même séquence en cliquant sur les couleurs</li>
            <li>À chaque niveau, une nouvelle couleur s'ajoute</li>
            <li>Atteignez le niveau {maxLevel} pour gagner</li>
            <li>Une erreur = Game Over</li>
            <li>Score: +10 points par couleur de la séquence</li>
          </ul>
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

export default SimonGame;