import React, { useState, useEffect } from 'react';
import './HangmanGame.css';

const HangmanGame = ({ onGameComplete }) => {
  const [wordList] = useState([
    "chat", "chien", "maison", "route", "ordinateur", "fenetre", "voiture", "arbre", "pomme", "musique",
    "plage", "oiseau", "soleil", "montagne", "riviere", "carte", "papier", "stylo", "livre", "porte",
    "lampe", "table", "chaise", "ville", "pays", "carton", "ciseaux", "pierre", "pont", "feu",
    "piscine", "lune", "etoile", "nuage", "fleur", "herbe", "cadeau", "bateau", "train", "avion",
    "guitare", "piano", "violon", "trompette", "flute", "tambour", "sport", "football", "tennis", "voyage"
  ]);

  const [wordToGuess, setWordToGuess] = useState('');
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [wrongLetters, setWrongLetters] = useState([]);
  const [currentLetter, setCurrentLetter] = useState('');
  const [currentWord, setCurrentWord] = useState('');
  const [mistakes, setMistakes] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [startTime, setStartTime] = useState(null);

  const hangmanImages = [
    '─────────', // 0 erreurs
    '│\n─────────', // 1 erreur
    '┌─────┐\n│\n─────────', // 2 erreurs
    '┌─────┐\n│     │\n─────────', // 3 erreurs
    '┌─────┐\n│     │\n│     ○\n─────────', // 4 erreurs
    '┌─────┐\n│     │\n│     ○\n│     │\n─────────', // 5 erreurs
    '┌─────┐\n│     │\n│     ○\n│    ╱│\n─────────', // 6 erreurs
    '┌─────┐\n│     │\n│     ○\n│    ╱│╲\n─────────', // 7 erreurs
    '┌─────┐\n│     │\n│     ○\n│    ╱│╲\n│    ╱\n─────────', // 8 erreurs
    '┌─────┐\n│     │\n│     ○\n│    ╱│╲\n│    ╱ ╲\n─────────', // 9 erreurs
    '┌─────┐\n│     │\n│     ✗\n│    ╱│╲\n│    ╱ ╲\n─────────' // 10 erreurs (mort)
  ];

  useEffect(() => {
    if (gameStarted && !gameWon && !gameLost) {
      const currentGuess = wordToGuess.split('').map(letter => 
        guessedLetters.includes(letter) ? letter : '_'
      ).join(' ');

      if (!currentGuess.includes('_')) {
        const endTime = new Date();
        const duration = Math.floor((endTime - startTime) / 1000);
        setGameWon(true);
        
        if (onGameComplete) {
          onGameComplete({
            won: true,
            score: Math.max(1, 11 - mistakes), // Score basé sur le nombre d'erreurs
            attempts: guessedLetters.length + wrongLetters.length,
            duration: duration,
            word: wordToGuess
          });
        }
      }
    }
  }, [guessedLetters, wordToGuess, gameStarted, gameWon, gameLost, mistakes, startTime, wrongLetters.length, onGameComplete]);

  useEffect(() => {
    if (mistakes >= 10 && !gameLost) {
      setGameLost(true);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      if (onGameComplete) {
        onGameComplete({
          won: false,
          score: 0,
          attempts: guessedLetters.length + wrongLetters.length,
          duration: duration,
          word: wordToGuess
        });
      }
    }
  }, [mistakes, gameLost, startTime, guessedLetters.length, wrongLetters.length, onGameComplete, wordToGuess]);

  const startGame = () => {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    const selectedWord = wordList[randomIndex].toLowerCase();
    
    setWordToGuess(selectedWord);
    setGuessedLetters([]);
    setWrongLetters([]);
    setCurrentLetter('');
    setCurrentWord('');
    setMistakes(0);
    setGameStarted(true);
    setGameWon(false);
    setGameLost(false);
    setStartTime(new Date());
    
    console.log('Mot à deviner:', selectedWord); // Pour le debug
  };

  const checkLetter = () => {
    if (!currentLetter || currentLetter.length !== 1) {
      alert('Veuillez entrer une seule lettre');
      return;
    }

    const letter = currentLetter.toLowerCase();
    
    if (guessedLetters.includes(letter) || wrongLetters.includes(letter)) {
      alert('Lettre déjà proposée');
      setCurrentLetter('');
      return;
    }

    if (wordToGuess.includes(letter)) {
      setGuessedLetters([...guessedLetters, letter]);
    } else {
      setWrongLetters([...wrongLetters, letter]);
      setMistakes(mistakes + 1);
    }
    
    setCurrentLetter('');
  };

  const checkWord = () => {
    if (!currentWord) {
      alert('Veuillez entrer un mot');
      return;
    }

    if (currentWord.toLowerCase() === wordToGuess) {
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      setGameWon(true);
      
      if (onGameComplete) {
        onGameComplete({
          won: true,
          score: Math.max(1, 11 - mistakes),
          attempts: guessedLetters.length + wrongLetters.length + 1,
          duration: duration,
          word: wordToGuess
        });
      }
    } else {
      setMistakes(mistakes + 1);
      alert('Mauvais mot !');
    }
    
    setCurrentWord('');
  };

  const resetGame = () => {
    setGameStarted(false);
    setWordToGuess('');
    setGuessedLetters([]);
    setWrongLetters([]);
    setCurrentLetter('');
    setCurrentWord('');
    setMistakes(0);
    setGameWon(false);
    setGameLost(false);
    setStartTime(null);
  };

  const getDisplayedWord = () => {
    if (!wordToGuess) return '';
    return wordToGuess.split('').map(letter => 
      guessedLetters.includes(letter) ? letter : '_'
    ).join(' ');
  };

  return (
    <div className="hangman-game">
      <h2>🎯 Jeu du Pendu</h2>
      
      <div className="game-controls">
        <div className="game-info">
          <p><strong>Lettres correctes :</strong> {guessedLetters.join(', ') || 'Aucune'}</p>
          <p><strong>Lettres incorrectes :</strong> {wrongLetters.join(', ') || 'Aucune'}</p>
          <div className="control-buttons">
            <button onClick={startGame} className="start-btn">
              {gameStarted ? 'Nouveau mot' : 'Démarrer'}
            </button>
            <button onClick={resetGame} className="reset-btn">Réinitialiser</button>
          </div>
        </div>
      </div>

      {gameStarted && (
        <>
          <div className="hangman-display">
            <pre className="hangman-ascii">
              {hangmanImages[mistakes]}
            </pre>
            <div className="mistakes-counter">
              Erreurs: {mistakes}/10
            </div>
          </div>

          <div className="word-display">
            <h3>Mot à deviner :</h3>
            <div className="word-letters">
              {getDisplayedWord()}
            </div>
          </div>

          <div className="game-inputs">
            <div className="letter-input">
              <label>Proposer une lettre :</label>
              <input
                type="text"
                value={currentLetter}
                onChange={(e) => setCurrentLetter(e.target.value)}
                placeholder="Entrez une lettre"
                maxLength="1"
                disabled={gameWon || gameLost}
                onKeyPress={(e) => e.key === 'Enter' && checkLetter()}
              />
              <button 
                onClick={checkLetter}
                disabled={gameWon || gameLost || !currentLetter}
              >
                Vérifier la lettre
              </button>
            </div>

            <div className="word-input">
              <label>Proposer le mot complet :</label>
              <input
                type="text"
                value={currentWord}
                onChange={(e) => setCurrentWord(e.target.value)}
                placeholder="Proposer le mot"
                disabled={gameWon || gameLost}
                onKeyPress={(e) => e.key === 'Enter' && checkWord()}
              />
              <button 
                onClick={checkWord}
                disabled={gameWon || gameLost || !currentWord}
              >
                Vérifier le mot
              </button>
            </div>
          </div>

          {gameWon && (
            <div className="game-result win">
              <h3>🎉 Félicitations ! Vous avez gagné !</h3>
              <p>Le mot était : <strong>{wordToGuess}</strong></p>
              <p>Score : {Math.max(1, 11 - mistakes)}/10</p>
            </div>
          )}

          {gameLost && (
            <div className="game-result lose">
              <h3>😵 Vous avez perdu !</h3>
              <p>Le mot était : <strong>{wordToGuess}</strong></p>
              <button onClick={startGame} className="retry-btn">Réessayer</button>
            </div>
          )}
        </>
      )}

      {!gameStarted && (
        <div className="game-instructions">
          <h3>📋 Instructions</h3>
          <ul>
            <li>Devinez le mot lettre par lettre</li>
            <li>Vous avez droit à 10 erreurs maximum</li>
            <li>Vous pouvez proposer le mot complet à tout moment</li>
            <li>Plus vous faites d'erreurs, moins votre score sera élevé</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default HangmanGame;