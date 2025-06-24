import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import HangmanGame from '../games/HangmanGame';
import NumberGuessGame from '../games/NumberGuessGame';
import MemoryGame from '../games/MemoryGame';
import ReactionGame from '../games/ReactionGame';
import NotificationSystem, { useNotifications } from '../components/NotificationSystem';
import NotificationCenter from '../components/NotificationCenter';
import './ParticipationPage.css';

const ParticipationPage = ({ user }) => {
  const { streamerId } = useParams();
  const navigate = useNavigate();

  // Hook pour les notifications
  const {
    notification,
    hideNotification,
    showError,
    showSuccess,
    showVictory
  } = useNotifications();

  // États pour le streamer et sa configuration
  const [streamer, setStreamer] = useState(null);
  const [streamerUser, setStreamerUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // États pour le système de clics Pauvrathon
  const [clickCount, setClickCount] = useState(0);
  const [gameUnlocked, setGameUnlocked] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState(null);
  const [onCooldown, setOnCooldown] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  
  // Sessions de participation
  const [participationSession, setParticipationSession] = useState(null);
  const [totalTimeAdded, setTotalTimeAdded] = useState(0);

  // Jeux disponibles
  const availableGames = [
    { id: 'trouve_le_chiffre', name: 'Trouve le chiffre', icon: '🎯', component: NumberGuessGame },
    { id: 'hangman', name: 'Jeu du pendu', icon: '🎪', component: HangmanGame },
    { id: 'memory', name: 'Memory Game', icon: '🧠', component: MemoryGame },
    { id: 'reaction', name: 'Jeu de Réaction', icon: '⚡', component: ReactionGame }
  ];

  useEffect(() => {
    if (user && streamerId) {
      loadStreamerData();
    }
  }, [user, streamerId]);

  // Cooldown timer
  useEffect(() => {
    let interval;
    if (onCooldown && cooldownTime > 0) {
      interval = setInterval(() => {
        setCooldownTime(prev => {
          if (prev <= 1) {
            setOnCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [onCooldown, cooldownTime]);

  // Charger les données du streamer
  const loadStreamerData = async () => {
    try {
      setLoading(true);
      setError('');

      // Récupérer le streamer avec ses infos utilisateur
      const { data: streamerData, error: streamerError } = await supabase
        .from('streamers')
        .select(`
          *,
          users!inner(
            twitch_user_id,
            twitch_username,
            twitch_display_name,
            profile_image_url
          )
        `)
        .eq('id', streamerId)
        .single();

      if (streamerError) {
        throw new Error('Streamer non trouvé');
      }

      if (!streamerData.subathon_active) {
        setError('Ce streamer a désactivé son Pauvrathon.');
        return;
      }

      setStreamer(streamerData);
      setStreamerUser(streamerData.users);

      // Créer ou récupérer la session de participation
      await initializeParticipationSession(streamerData.id);

    } catch (err) {
      console.error('Erreur chargement streamer:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialiser la session de participation
  const initializeParticipationSession = async (streamerId) => {
    try {
      // Récupérer l'utilisateur
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('twitch_user_id', user.id)
        .single();

      if (!userData) {
        throw new Error('Utilisateur non trouvé');
      }

      // Chercher une session active existante
      const { data: existingSession } = await supabase
        .from('pauvrathon_sessions')
        .select('*')
        .eq('viewer_id', userData.id)
        .eq('streamer_id', streamerId)
        .eq('is_active', true)
        .single();

      if (existingSession) {
        setParticipationSession(existingSession);
        setClickCount(existingSession.clicks_count || 0);
        setTotalTimeAdded(existingSession.time_added_total || 0);
      } else {
        // Créer une nouvelle session
        const { data: newSession, error: sessionError } = await supabase
          .from('pauvrathon_sessions')
          .insert({
            viewer_id: userData.id,
            streamer_id: streamerId,
            clicks_count: 0,
            time_added_total: 0,
            is_active: true
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        setParticipationSession(newSession);
      }
    } catch (err) {
      console.error('Erreur session:', err);
    }
  };

  // ✅ CORRECTION : Gérer les clics sur le streamer
  const handleStreamerClick = async () => {
    if (onCooldown || gameUnlocked || !streamer || !participationSession) return;

    const newCount = clickCount + 1;
    setClickCount(newCount);

    try {
      // ✅ CORRECTION : Utiliser RPC au lieu de SQL
      const { data: clickResult, error: clickError } = await supabase
        .rpc('increment_clicks', {
          p_streamer_id: streamer.id,
          p_viewer_id: participationSession.viewer_id
        });

      if (clickError) {
        console.warn('RPC increment_clicks échoué, fallback manuel:', clickError);
        // Fallback manuel si RPC échoue
        await supabase
          .from('pauvrathon_sessions')
          .update({ 
            clicks_count: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', participationSession.id);
      }

      // ✅ CORRECTION : Incrémenter les stats sans SQL
      const { data: currentStats } = await supabase
        .from('user_stats')
        .select('total_clicks')
        .eq('user_id', participationSession.viewer_id)
        .single();

      if (currentStats) {
        await supabase
          .from('user_stats')
          .update({ 
            total_clicks: (currentStats.total_clicks || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', participationSession.viewer_id);
      } else {
        // Créer les stats si elles n'existent pas
        await supabase
          .from('user_stats')
          .insert({
            user_id: participationSession.viewer_id,
            total_clicks: 1,
            total_games_played: 0,
            total_games_won: 0,
            best_score: 0
          });
      }

      // Vérifier si le jeu doit être débloqué
      if (newCount >= streamer.clicks_required) {
        // Filtrer les jeux activés
        const enabledGames = availableGames.filter(game => 
          streamer.game_settings?.[game.id]?.enabled !== false
        );
        
        const randomGame = enabledGames.length > 0 
          ? enabledGames[Math.floor(Math.random() * enabledGames.length)]
          : availableGames[Math.floor(Math.random() * availableGames.length)];
          
        setSelectedGameType(randomGame);
        setGameUnlocked(true);
        showSuccess(`🎮 Jeu débloqué ! "${randomGame.name}" sélectionné !`);
      }

    } catch (error) {
      console.error('Erreur mise à jour clics:', error);
      showError('Erreur lors de l\'enregistrement du clic');
    }
  };

  // ✅ CORRECTION : Gérer la completion du jeu
  const handleGameComplete = async (result) => {
    if (!streamer || !participationSession) return;

    try {
      setLoading(true);

      // Enregistrer la session de jeu
      const { data: gameSession, error: gameError } = await supabase
        .from('game_sessions')
        .insert({
          user_id: participationSession.viewer_id,
          game_type: selectedGameType.id,
          score: result.score,
          clicks_count: clickCount,
          duration: result.duration || 0,
          completed: true,
          won: result.won
        })
        .select()
        .single();

      if (gameError) throw gameError;

      if (result.won) {
        // VICTOIRE : Ajouter du temps
        const timeToAdd = Math.floor(
          Math.random() * (streamer.time_range_max - streamer.time_range_min + 1)
        ) + streamer.time_range_min;

        // Mettre à jour le timer du streamer
        const newTimer = streamer.current_timer + timeToAdd;
        await supabase
          .from('streamers')
          .update({ 
            current_timer: newTimer,
            updated_at: new Date().toISOString()
          })
          .eq('id', streamer.id);

        // Enregistrer l'ajout de temps
        await supabase
          .from('time_additions')
          .insert({
            pauvrathon_session_id: participationSession.id,
            game_session_id: gameSession.id,
            time_added: timeToAdd
          });

        // Mettre à jour la session de participation
        const newTotalTime = totalTimeAdded + timeToAdd;
        await supabase
          .from('pauvrathon_sessions')
          .update({
            time_added_total: newTotalTime,
            clicks_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', participationSession.id);

        // ✅ CORRECTION : Mettre à jour les stats sans SQL
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('total_games_played, total_games_won, best_score')
          .eq('user_id', participationSession.viewer_id)
          .single();

        if (currentStats) {
          await supabase
            .from('user_stats')
            .update({
              total_games_played: (currentStats.total_games_played || 0) + 1,
              total_games_won: (currentStats.total_games_won || 0) + 1,
              best_score: Math.max(currentStats.best_score || 0, result.score),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', participationSession.viewer_id);
        } else {
          // Créer les stats si elles n'existent pas
          await supabase
            .from('user_stats')
            .insert({
              user_id: participationSession.viewer_id,
              total_clicks: 0,
              total_games_played: 1,
              total_games_won: 1,
              best_score: result.score
            });
        }

        // Mettre à jour les états locaux
        setStreamer(prev => ({ ...prev, current_timer: newTimer }));
        setTotalTimeAdded(newTotalTime);
        setConsecutiveFailures(0);

        showVictory(
          `🎉 Victoire ! +${timeToAdd} secondes ajoutées !`,
          `Timer: ${Math.floor(newTimer / 3600)}h ${Math.floor((newTimer % 3600) / 60)}m`
        );

      } else {
        // DÉFAITE : Gérer les échecs
        const newFailures = consecutiveFailures + 1;
        setConsecutiveFailures(newFailures);

        // ✅ CORRECTION : Mettre à jour les stats sans SQL
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('total_games_played')
          .eq('user_id', participationSession.viewer_id)
          .single();

        if (currentStats) {
          await supabase
            .from('user_stats')
            .update({
              total_games_played: (currentStats.total_games_played || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', participationSession.viewer_id);
        } else {
          // Créer les stats si elles n'existent pas
          await supabase
            .from('user_stats')
            .insert({
              user_id: participationSession.viewer_id,
              total_clicks: 0,
              total_games_played: 1,
              total_games_won: 0,
              best_score: 0
            });
        }

        // Reset après 3 échecs consécutifs
        if (newFailures >= 3) {
          await supabase
            .from('pauvrathon_sessions')
            .update({
              clicks_count: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', participationSession.id);
          
          setConsecutiveFailures(0);
          showError(
            `❌ 3 échecs consécutifs ! Compteur remis à zéro.`,
            `${result.targetNumber ? `Le nombre était ${result.targetNumber}` : 'Réessayez !'}`
          );
        } else {
          // Reset clics à 0
          await supabase
            .from('pauvrathon_sessions')
            .update({
              clicks_count: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', participationSession.id);

          showError(
            `❌ Défaite ! Échec ${newFailures}/3`,
            `${result.targetNumber ? `Le nombre était ${result.targetNumber}` : 'Réessayez !'}`
          );
        }
      }

      // Appliquer le cooldown (victoire OU défaite)
      const cooldownDuration = streamer.cooldown_between_games || 30;
      setOnCooldown(true);
      setCooldownTime(cooldownDuration);

    } catch (error) {
      console.error('Erreur completion jeu:', error);
      showError('Erreur lors de la validation du jeu');
    } finally {
      // Reset du jeu
      setClickCount(0);
      setGameUnlocked(false);
      setSelectedGameType(null);
      setLoading(false);
    }
  };

  // Quitter la session
  const handleLeaveSession = async () => {
    if (participationSession) {
      await supabase
        .from('pauvrathon_sessions')
        .update({
          is_active: false,
          session_end: new Date().toISOString()
        })
        .eq('id', participationSession.id);
    }
    navigate('/discover');
  };

  // Utilitaires
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatCooldown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getProgressPercentage = () => {
    if (!streamer) return 0;
    return Math.min((clickCount / streamer.clicks_required) * 100, 100);
  };

  if (!user) {
    return (
      <div className="participation-page">
        <div className="auth-required">
          <h2>🔒 Connexion requise</h2>
          <p>Connectez-vous avec Twitch pour participer aux Pauvrathons !</p>
          <Link to="/discover" className="back-button">Retour à la découverte</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="participation-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement du Pauvrathon...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="participation-page">
        <div className="error-section">
          <h2>😅 Oups !</h2>
          <p>{error}</p>
          <Link to="/discover" className="back-button">Retour à la découverte</Link>
        </div>
      </div>
    );
  }

  if (!streamer || !streamerUser) {
    return (
      <div className="participation-page">
        <div className="error-section">
          <h2>❌ Streamer non trouvé</h2>
          <Link to="/discover" className="back-button">Retour à la découverte</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="participation-page">
      {/* Header du streamer avec notifications */}
      <div className="streamer-header">
        <div className="streamer-info">
          <img 
            src={streamerUser.profile_image_url} 
            alt={streamerUser.twitch_display_name}
            className="streamer-avatar-large"
          />
          <div className="streamer-details">
            <h1>🎮 Pauvrathon de {streamerUser.twitch_display_name}</h1>
            <p>Soutenez ce streamer en participant à son subathon !</p>
            <div className="streamer-stats">
              <span className="stat">⏰ Timer: {formatTime(streamer.current_timer)}</span>
              <span className="stat">🎯 Clics requis: {streamer.clicks_required}</span>
              <span className="stat">⏱️ Temps ajouté: {streamer.time_range_min}-{streamer.time_range_max}s</span>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          {user && <NotificationCenter user={user} />}
          <div className="session-stats">
            <div className="session-stat">
              <span className="session-stat-value">{totalTimeAdded}</span>
              <span className="session-stat-label">Secondes ajoutées</span>
            </div>
            <div className="session-stat">
              <span className="session-stat-value">{consecutiveFailures}/3</span>
              <span className="session-stat-label">Échecs consécutifs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 1: Système de clics */}
      {!gameUnlocked && (
        <div className="click-section">
          <div className="click-container">
            <div className="click-target-container">
              <button 
                className={`click-target ${onCooldown ? 'disabled' : ''}`}
                onClick={handleStreamerClick}
                disabled={onCooldown}
              >
                <img 
                  src={streamerUser.profile_image_url} 
                  alt={streamerUser.twitch_display_name}
                  className="click-avatar"
                />
                {onCooldown && (
                  <div className="cooldown-overlay">
                    <span className="cooldown-time">⏰ {formatCooldown(cooldownTime)}</span>
                  </div>
                )}
              </button>
              
              {!onCooldown && (
                <div className="click-instruction">
                  <span className="click-icon">👆</span>
                  <span>Cliquez pour soutenir !</span>
                </div>
              )}
            </div>

            <div className="click-progress">
              <div className="progress-info">
                <h3>Progression vers le mini-jeu</h3>
                <p>{clickCount}/{streamer.clicks_required} clics</p>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
              
              {clickCount < streamer.clicks_required && (
                <p className="encouragement">
                  Plus que {streamer.clicks_required - clickCount} clics pour débloquer un mini-jeu !
                </p>
              )}
            </div>

            {onCooldown && (
              <div className="cooldown-info">
                <h3>⏰ Cooldown en cours</h3>
                <p>Attendez {formatCooldown(cooldownTime)} avant de pouvoir recliquer</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Mini-jeu */}
      {gameUnlocked && selectedGameType && (
        <div className="game-container">
          <div className="game-header-info">
            <h2>{selectedGameType.icon} {selectedGameType.name}</h2>
            <p>Gagnez ce jeu pour ajouter {streamer.time_range_min}-{streamer.time_range_max} secondes au timer !</p>
          </div>

          {/* Rendu du jeu sélectionné */}
          {React.createElement(selectedGameType.component, {
            onGameComplete: handleGameComplete
          })}
        </div>
      )}

      {/* Actions de navigation */}
      <div className="page-actions">
        <button onClick={handleLeaveSession} className="leave-button">
          ← Quitter cette session
        </button>
        <a 
          href={`https://twitch.tv/${streamerUser.twitch_username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="watch-stream-button"
        >
          📺 Regarder le stream
        </a>
      </div>

      {/* Système de notifications */}
      <NotificationSystem
        notification={notification}
        onClose={hideNotification}
      />
    </div>
  );
};

export default ParticipationPage;