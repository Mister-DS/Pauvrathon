import React, { useState, useEffect, useCallback } from 'react';
import NotificationSystem, { useNotifications } from '../components/NotificationSystem';
import './MemoryGame.css';

const MemoryGame = ({ onGameComplete }) => {
  // Hook pour les notifications (SEULEMENT victoire/défaite)
  const {
    notification,
    hideNotification,
    showVictory
  } = useNotifications();

  // Emojis pour les cartes (8 paires = 16 cartes)
  const cardEmojis = [
    '🎮', '🎯', '🎪', '🎨', '🎵', '🎲', '🎭', '🎸',
    '🎮', '🎯', '🎪', '🎨', '🎵', '🎲', '🎭', '🎸'
  ];

  // États du jeu
  const [gameStarted, setGameStarted] = useState(false);
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [timer, setTimer] = useState(0);

  // Timer
  useEffect(() => {
    let interval;
    if (gameStarted && !gameWon) {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameWon]);

// Fonction pour calculer le score Memory Game - VERSION DIFFICILE
const calculateMemoryScore = (timer, moves, won) => {
  if (!won) return 1;
  
  let score = 6; // Score de base réduit à 6 au lieu de 10
  
  // PÉNALITÉS TEMPS plus sévères
  if (timer > 90) score -= 4;        // Très lent
  else if (timer > 75) score -= 3;   // Lent  
  else if (timer > 60) score -= 2;   // Un peu lent
  else if (timer > 45) score -= 1;   // Acceptable
  
  // PÉNALITÉS MOUVEMENTS très strictes (16 = parfait)
  if (moves > 28) score -= 3;        // Beaucoup trop de mouvements
  else if (moves > 24) score -= 2;   // Trop de mouvements
  else if (moves > 20) score -= 1;   // Un peu trop
  else if (moves > 16) score -= 1;   // Pas optimal
  
  // BONUS très restrictifs (difficiles à obtenir)
  if (timer < 30 && moves <= 16) score += 4;  // Performance exceptionnelle
  else if (timer < 40 && moves <= 18) score += 3;  // Très bonne performance
  else if (timer < 50 && moves <= 20) score += 2;  // Bonne performance
  else if (timer < 60 && moves <= 22) score += 1;  // Performance correcte
  
  // MALUS pour performance médiocre
  if (timer > 100 && moves > 26) score -= 2;  // Double pénalité
  
  return Math.max(1, Math.min(10, score));
};

  // Fonction pour gérer la victoire (memoized)
  const handleVictory = useCallback((timer, moves) => {
    const finalScore = calculateMemoryScore(timer, moves, true);
    
    showVictory(
      'Toutes les paires trouvées ! 🎉',
      `Score: ${finalScore} pts - Terminé en ${timer}s avec ${moves} mouvements !`
    );
    
    if (onGameComplete) {
      onGameComplete({
        won: true,
        score: finalScore,
        attempts: moves,
        duration: timer
      });
    }
  }, [onGameComplete, showVictory]);

  // Vérifier la victoire (CORRIGÉ - sans dépendances infinies)
  useEffect(() => {
    if (matchedCards.length === 16 && matchedCards.length > 0 && !gameWon) {
      setGameWon(true);
      handleVictory(timer, moves);
    }
  }, [matchedCards.length, gameWon, timer, moves, handleVictory]);

  // Mélanger les cartes
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Démarrer le jeu
  const startGame = () => {
    const shuffledCards = shuffleArray(cardEmojis).map((emoji, index) => ({
      id: index,
      emoji,
      isFlipped: false,
      isMatched: false
    }));
    
    setCards(shuffledCards);
    setFlippedCards([]);
    setMatchedCards([]);
    setMoves(0);
    setGameStarted(true);
    setGameWon(false);
    setStartTime(new Date());
    setTimer(0);
  };

  // Gérer le clic sur une carte
  const handleCardClick = (cardId) => {
    if (flippedCards.length >= 2 || flippedCards.includes(cardId) || matchedCards.includes(cardId) || gameWon) {
      return;
    }

    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
      
      const [firstCard, secondCard] = newFlippedCards.map(id => 
        cards.find(card => card.id === id)
      );

      if (firstCard.emoji === secondCard.emoji) {
        // Paire trouvée !
        setMatchedCards(prev => [...prev, ...newFlippedCards]);
        setFlippedCards([]);
      } else {
        // Pas de correspondance
        setTimeout(() => {
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  // Réinitialiser le jeu
  const resetGame = () => {
    setGameStarted(false);
    setCards([]);
    setFlippedCards([]);
    setMatchedCards([]);
    setMoves(0);
    setGameWon(false);
    setStartTime(null);
    setTimer(0);
  };

  // Formater le temps
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="memory-game">
      <h2>🧠 Memory Game</h2>
      
      <div className="game-controls">
        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">⏱️ Temps:</span>
            <span className="stat-value">{formatTime(timer)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">🎯 Mouvements:</span>
            <span className="stat-value">{moves}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">✅ Paires:</span>
            <span className="stat-value">{matchedCards.length / 2}/8</span>
          </div>
        </div>
        
        <div className="control-buttons">
          <button onClick={startGame} className="start-btn">
            {gameStarted ? 'Nouvelle partie' : 'Démarrer'}
          </button>
          <button onClick={resetGame} className="reset-btn">Réinitialiser</button>
        </div>
      </div>

      {gameStarted && (
        <div className="cards-grid">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`memory-card ${
                flippedCards.includes(card.id) || matchedCards.includes(card.id)
                  ? 'flipped'
                  : ''
              } ${matchedCards.includes(card.id) ? 'matched' : ''}`}
              onClick={() => handleCardClick(card.id)}
            >
              <div className="card-front">
                <span className="card-emoji">{card.emoji}</span>
              </div>
              <div className="card-back">
                <span className="card-question">?</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {gameWon && (
        <div className="game-result win">
          <h3>🎉 Félicitations ! Toutes les paires trouvées !</h3>
          <p>Temps: <strong>{formatTime(timer)}</strong></p>
          <p>Mouvements: <strong>{moves}</strong></p>
          <p>Score: <strong>{gameWon ? calculateMemoryScore(timer, moves, true) : 0}/10</strong></p>
        </div>
      )}

      {!gameStarted && (
        <div className="game-instructions">
          <h3>📋 Instructions</h3>
          <ul>
            <li>Retournez les cartes pour trouver les paires identiques</li>
            <li>Vous ne pouvez retourner que 2 cartes à la fois</li>
            <li>Mémorisez les positions pour être plus efficace</li>
            <li>Trouvez toutes les 8 paires le plus rapidement possible</li>
            <li>Score basé sur le temps et le nombre de mouvements</li>
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

export default MemoryGame;