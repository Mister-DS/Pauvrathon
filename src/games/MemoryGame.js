import React, { useState, useEffect } from 'react';
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

  // Vérifier la victoire
  useEffect(() => {
    if (matchedCards.length === cards.length && cards.length > 0) {
      setGameWon(true);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      // Calcul du score (basé sur le temps et les mouvements)
      const baseScore = 1000;
      const timePenalty = Math.min(timer * 2, 500);
      const movesPenalty = Math.min(moves * 10, 400);
      const finalScore = Math.max(100, baseScore - timePenalty - movesPenalty);
      
      showVictory(
        'Toutes les paires trouvées ! 🎉',
        `Terminé en ${timer}s avec ${moves} mouvements !`
      );
      
      if (onGameComplete) {
        onGameComplete({
          won: true,
          score: finalScore,
          attempts: moves,
          duration: duration
        });
      }
    }
  }, [matchedCards, cards.length, timer, moves, startTime, gameWon, onGameComplete, showVictory]);

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
    
    // AUCUNE notification pour démarrage
  };

  // Gérer le clic sur une carte
  const handleCardClick = (cardId) => {
    if (flippedCards.length >= 2 || flippedCards.includes(cardId) || matchedCards.includes(cardId)) {
      return;
    }

    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    if (newFlippedCards.length === 2) {
      setMoves(moves + 1);
      
      const [firstCard, secondCard] = newFlippedCards.map(id => 
        cards.find(card => card.id === id)
      );

      if (firstCard.emoji === secondCard.emoji) {
        // Paire trouvée !
        setMatchedCards([...matchedCards, ...newFlippedCards]);
        setFlippedCards([]);
        // AUCUNE notification pour paires trouvées
      } else {
        // Pas de correspondance
        setTimeout(() => {
          setFlippedCards([]);
        }, 1000);
        // AUCUNE notification pour erreurs
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
    
    // AUCUNE notification pour reset
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
          <p>Score: <strong>{Math.max(100, 1000 - timer * 2 - moves * 10)}/1000</strong></p>
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