import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, Play, Pause, Edit3, Save, X, Clock, MousePointer, 
  Gamepad2, Shield, Users, BarChart3, AlertTriangle, 
  Timer, Target, Award, Ban, Eye, Zap, RefreshCw, Plus,
  Palette, Bell, MessageSquare, TrendingUp, Star, Heart,
  Volume2, Webhook, ToggleLeft, ToggleRight, Sliders,
  Calendar, UserCheck, UserX, Trophy, Gift, Edit, Check,
  Minus, PlayCircle, PauseCircle, RotateCcw
} from 'lucide-react';
import notificationService from '../services/NotificationService';
import './AdminPanel.css';

// 🆕 Composant pour les notifications dans l'AdminPanel
const AdminNotification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`admin-notification ${isVisible ? 'show' : ''}`} data-type={notification.type}>
      <div className="notification-content">
        <div className="notification-icon">
          {notification.type === 'success' && '✅'}
          {notification.type === 'error' && '❌'}
          {notification.type === 'info' && 'ℹ️'}
          {notification.type === 'warning' && '⚠️'}
        </div>
        <div className="notification-message">
          <h4>{notification.title}</h4>
          <p>{notification.message}</p>
        </div>
        <button className="notification-close" onClick={handleClose}>×</button>
      </div>
    </div>
  );
};

const AdminPanel = ({ user }) => {
  const [streamerConfig, setStreamerConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [stats, setStats] = useState({
    participants_today: 0,
    total_time_added_today: 0,
    active_sessions: 0,
    total_games_today: 0
  });

  // 🆕 NOUVEAUX ÉTATS pour l'édition en temps réel
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [tempValues, setTempValues] = useState({});

  // 🔔 États pour les notifications
  const [followerCount, setFollowerCount] = useState(0);
  const [sendingNotification, setSendingNotification] = useState(false);

  // 🆕 État pour les notifications admin
  const [adminNotifications, setAdminNotifications] = useState([]);

  // Jeux disponibles avec configuration par défaut
  const [availableGames] = useState([
    { 
      id: 'trouve_le_chiffre', 
      name: 'Trouve le chiffre', 
      icon: '🎯',
      defaultDifficulty: 1.0,
      defaultTimeBonus: 30
    },
    { 
      id: 'hangman', 
      name: 'Jeu du pendu', 
      icon: '🎪',
      defaultDifficulty: 1.0,
      defaultTimeBonus: 45
    },
    { 
      id: 'memory', 
      name: 'Memory Game', 
      icon: '🧠',
      defaultDifficulty: 1.0,
      defaultTimeBonus: 60
    },
    { 
      id: 'reaction', 
      name: 'Jeu de Réaction', 
      icon: '⚡',
      defaultDifficulty: 1.0,
      defaultTimeBonus: 25
    }
  ]);

  // 🆕 Fonction pour afficher une notification admin
  const showAdminNotification = (type, title, message) => {
    const notification = {
      id: Date.now(),
      type,
      title,
      message
    };
    
    setAdminNotifications(prev => [...prev, notification]);
    
    // Auto-supprimer après 5 secondes
    setTimeout(() => {
      setAdminNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // 🆕 Fonction pour supprimer une notification
  const removeAdminNotification = (id) => {
    setAdminNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    if (user) {
      initializeStreamerConfig();
    }
  }, [user]);

  // Charger le nombre de followers
  useEffect(() => {
    if (streamerConfig?.id) {
      loadFollowerCount();
    }
  }, [streamerConfig?.id]);

  // 🆕 Actualisation automatique des stats toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (streamerConfig?.id) {
        fetchTodayStats(streamerConfig.id);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [streamerConfig?.id]);

  // Initialiser ou récupérer la configuration du streamer
  const initializeStreamerConfig = async () => {
    try {
      setLoading(true);
      setError('');

      // Vérifier si l'utilisateur existe dans la table users
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('twitch_user_id', user.id)
        .single();

      if (userError && userError.code === 'PGRST116') {
        // Créer l'utilisateur s'il n'existe pas
        const { data: newUser, error: insertUserError } = await supabase
          .from('users')
          .insert([{
            twitch_user_id: user.id,
            twitch_username: user.login,
            twitch_display_name: user.display_name,
            profile_image_url: user.profile_image_url,
            email: user.email
          }])
          .select()
          .single();

        if (insertUserError) throw insertUserError;
        userData = newUser;
      } else if (userError) {
        throw userError;
      }

      // Récupérer ou créer la configuration streamer
      let { data: streamerData, error: streamerError } = await supabase
        .from('streamers')
        .select('*')
        .eq('user_id', userData.id)
        .single();

      if (streamerError && streamerError.code === 'PGRST116') {
        // Configuration par défaut enrichie
        const defaultGameSettings = {};
        availableGames.forEach(game => {
          defaultGameSettings[game.id] = {
            enabled: true,
            difficulty: game.defaultDifficulty,
            time_bonus_min: game.defaultTimeBonus,
            time_bonus_max: game.defaultTimeBonus + 30
          };
        });

        const { data: newStreamer, error: insertStreamerError } = await supabase
          .from('streamers')
          .insert([{
            user_id: userData.id,
            is_live: false,
            subathon_active: false,
            current_timer: 0,
            timer_max: 28800, // 8 heures max
            timer_min: 300,   // 5 minutes min
            time_range_min: 10,
            time_range_max: 60,
            clicks_required: 50,
            cooldown_between_games: 30,
            max_daily_time_per_viewer: 300,
            max_concurrent_participants: 50,
            difficulty_multiplier: 1.0,
            auto_ban_suspicious: true,
            min_account_age_days: 7,
            min_followers: 0,
            welcome_message: `Bienvenue sur mon Pauvrathon ! Cliquez sur mon avatar pour participer ! 🎮`,
            theme_color: '#a855f7',
            time_multiplier_weekend: 1.2,
            time_multiplier_evening: 1.1,
            auto_notifications: true,
            discord_webhook: '',
            victory_sound: true,
            defeat_sound: true,
            game_settings: defaultGameSettings,
            participation_whitelist: [],
            participation_blacklist: [],
            daily_goals: {
              target_hours: 6,
              target_participants: 20,
              rewards_enabled: true
            }
          }])
          .select()
          .single();

        if (insertStreamerError) throw insertStreamerError;
        streamerData = newStreamer;
      } else if (streamerError) {
        throw streamerError;
      }

      setStreamerConfig({ ...streamerData, user_data: userData });
      await fetchTodayStats(streamerData.id);

      showAdminNotification(
        'success',
        '🎮 Panneau chargé',
        'Configuration récupérée avec succès'
      );

    } catch (err) {
      console.error('Erreur initialisation:', err);
      setError(`Erreur: ${err.message}`);
      showAdminNotification(
        'error',
        'Erreur de chargement',
        `Impossible de charger la configuration: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les statistiques du jour
  const fetchTodayStats = async (streamerId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Sessions actives aujourd'hui
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('pauvrathon_sessions')
        .select(`
          *,
          viewer:users!pauvrathon_sessions_viewer_id_fkey(twitch_display_name),
          time_additions(time_added)
        `)
        .eq('streamer_id', streamerId)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);

      if (sessionsError) throw sessionsError;

      // Jeux joués aujourd'hui
      const { data: gamesData, error: gamesError } = await supabase
        .from('time_additions')
        .select(`
          *,
          game_session:game_sessions!time_additions_game_session_id_fkey(*),
          pauvrathon_session:pauvrathon_sessions!time_additions_pauvrathon_session_id_fkey(streamer_id)
        `)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);

      if (gamesError) throw gamesError;

      // Calculer les statistiques
      const uniqueParticipants = new Set(sessionsData?.map(s => s.viewer_id) || []).size;
      const totalTimeAdded = sessionsData?.reduce((total, session) => {
        return total + (session.time_additions?.reduce((sum, t) => sum + t.time_added, 0) || 0);
      }, 0) || 0;
      const activeSessions = sessionsData?.filter(s => s.is_active).length || 0;
      const totalGamesToday = gamesData?.filter(g => g.pauvrathon_session?.streamer_id === streamerId).length || 0;

      setStats({
        participants_today: uniqueParticipants,
        total_time_added_today: totalTimeAdded,
        active_sessions: activeSessions,
        total_games_today: totalGamesToday
      });

    } catch (err) {
      console.error('Erreur stats:', err);
    }
  };

  // Charger le nombre de followers
  const loadFollowerCount = async () => {
    try {
      const { count, error } = await supabase
        .from('streamer_followers')
        .select('*', { count: 'exact', head: true })
        .eq('streamer_id', streamerConfig.id)
        .eq('notification_enabled', true);

      if (error) throw error;
      setFollowerCount(count || 0);
    } catch (err) {
      console.error('Erreur chargement followers:', err);
    }
  };

  // 🆕 Démarrer/arrêter le Pauvrathon avec belles notifications
  const toggleSubathon = async (active) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('streamers')
        .update({ subathon_active: active })
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, subathon_active: active }));
      
      // Notifications automatiques
      if (active) {
        console.log('🔄 Envoi notifications Pauvrathon démarré...');
        
        try {
          const result = await notificationService.notifyPauvrathonStart(
            streamerConfig.id,
            streamerConfig.user_data?.twitch_display_name
          );
          
          if (result.success) {
            console.log(`📢 ${result.count} notifications envoyées`);
            
            if (result.count > 0) {
              showAdminNotification(
                'success',
                '🎉 Pauvrathon démarré !',
                `${result.count} followers ont été notifiés automatiquement`
              );
            } else {
              showAdminNotification(
                'info',
                '🎉 Pauvrathon démarré !',
                'Aucun follower à notifier pour le moment'
              );
            }
          } else {
            showAdminNotification(
              'warning',
              'Pauvrathon démarré',
              'Erreur lors de l\'envoi des notifications'
            );
          }
        } catch (notifError) {
          console.warn('⚠️ Service de notifications non disponible:', notifError);
          showAdminNotification(
            'warning',
            'Pauvrathon démarré',
            'Service de notifications temporairement indisponible'
          );
        }
      } else {
        // Notifier la fin du Pauvrathon
        const finalTime = streamerConfig.current_timer;
        if (finalTime > 0) {
          try {
            const result = await notificationService.notifyPauvrathonEnd(
              streamerConfig.id,
              streamerConfig.user_data?.twitch_display_name,
              finalTime
            );
            
            if (result.success && result.count > 0) {
              showAdminNotification(
                'info',
                '⏰ Pauvrathon terminé',
                `${result.count} followers ont été notifiés de la fin`
              );
            } else {
              showAdminNotification(
                'info',
                '⏰ Pauvrathon terminé',
                `Durée finale : ${Math.floor(finalTime / 3600)}h ${Math.floor((finalTime % 3600) / 60)}m`
              );
            }
          } catch (notifError) {
            console.warn('⚠️ Erreur notification fin:', notifError);
          }
        } else {
          showAdminNotification(
            'info',
            '⏰ Pauvrathon terminé',
            'Timer remis à zéro'
          );
        }
      }
      
    } catch (err) {
      console.error('Erreur toggle subathon:', err);
      showAdminNotification(
        'error',
        'Erreur',
        `Impossible de ${active ? 'démarrer' : 'arrêter'} le Pauvrathon`
      );
    } finally {
      setSaving(false);
    }
  };

  // 🆕 FONCTIONS D'ÉDITION EN TEMPS RÉEL

  // Démarrer l'édition d'un champ
  const startQuickEdit = (field, currentValue) => {
    setEditingField(field);
    setTempValues({ ...tempValues, [field]: currentValue });
    setQuickEditMode(true);
  };

  // Sauvegarder un champ en temps réel
  const saveQuickEdit = async (field) => {
    try {
      setSaving(true);
      const newValue = tempValues[field];
      
      const { error } = await supabase
        .from('streamers')
        .update({ [field]: newValue })
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, [field]: newValue }));
      setEditingField(null);
      setQuickEditMode(false);
      
      showAdminNotification(
        'success',
        '⚙️ Configuration sauvegardée',
        `${field} mis à jour avec succès`
      );
      
    } catch (err) {
      console.error('Erreur sauvegarde rapide:', err);
      showAdminNotification(
        'error',
        'Erreur de sauvegarde',
        'Impossible de sauvegarder la modification'
      );
    } finally {
      setSaving(false);
    }
  };

  // Annuler l'édition
  const cancelQuickEdit = () => {
    setEditingField(null);
    setQuickEditMode(false);
    setTempValues({});
  };

  // 🆕 Modifier le timer manuellement avec notifications
  const updateTimer = async (operation, value = null) => {
    try {
      setSaving(true);
      let newTimer;
      
      switch (operation) {
        case 'set':
          const inputTimer = prompt(
            `Timer actuel: ${Math.floor(streamerConfig.current_timer / 3600)}h ${Math.floor((streamerConfig.current_timer % 3600) / 60)}m\n\nNouveau timer (en secondes):`, 
            streamerConfig.current_timer
          );
          if (inputTimer === null) return;
          newTimer = parseInt(inputTimer);
          break;
        case 'add':
          newTimer = streamerConfig.current_timer + (value || 60);
          showAdminNotification(
            'success',
            '⏰ Timer modifié',
            `+${value || 60} secondes ajoutées`
          );
          break;
        case 'subtract':
          newTimer = Math.max(0, streamerConfig.current_timer - (value || 60));
          showAdminNotification(
            'info',
            '⏰ Timer modifié',
            `${value || 60} secondes retirées`
          );
          break;
        case 'reset':
          newTimer = 0;
          showAdminNotification(
            'warning',
            '⏰ Timer remis à zéro',
            'Le timer a été reset'
          );
          break;
        default:
          return;
      }
      
      if (isNaN(newTimer) || newTimer < 0) {
        showAdminNotification('error', 'Erreur', 'Valeur invalide pour le timer');
        return;
      }

      const { error } = await supabase
        .from('streamers')
        .update({ current_timer: newTimer })
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, current_timer: newTimer }));
      
      if (operation === 'set') {
        showAdminNotification(
          'success',
          '⏰ Timer défini',
          `Nouveau timer: ${Math.floor(newTimer / 3600)}h ${Math.floor((newTimer % 3600) / 60)}m`
        );
      }
      
    } catch (err) {
      console.error('Erreur update timer:', err);
      showAdminNotification('error', 'Erreur', 'Impossible de modifier le timer');
    } finally {
      setSaving(false);
    }
  };

  // 🆕 Envoyer notification personnalisée avec belle notification
  const sendCustomNotification = async () => {
    const title = prompt('Titre de la notification:');
    if (!title) return;
    
    const message = prompt('Message de la notification:');
    if (!message) return;
    
    try {
      setSendingNotification(true);
      
      const { data: followers, error } = await supabase
        .from('streamer_followers')
        .select('user_id')
        .eq('streamer_id', streamerConfig.id)
        .eq('notification_enabled', true);

      if (error) throw error;

      let sentCount = 0;
      
      for (const follower of followers) {
        const result = await notificationService.sendCustomNotification(
          follower.user_id,
          title,
          message,
          'custom',
          {
            streamer_id: streamerConfig.id,
            streamer_name: streamerConfig.user_data?.twitch_display_name
          }
        );
        
        if (result.success) sentCount++;
      }
      
      showAdminNotification(
        'success',
        '📢 Notification envoyée',
        `Message envoyé à ${sentCount} followers`
      );
      
    } catch (error) {
      console.error('Erreur notification personnalisée:', error);
      showAdminNotification(
        'error',
        'Erreur d\'envoi',
        'Impossible d\'envoyer la notification'
      );
    } finally {
      setSendingNotification(false);
    }
  };

  // Fonction pour vérifier si l'utilisateur est admin
  const isAdmin = (user) => {
    if (!user) return false;
    const adminIds = ["498366489"];
    const adminUsernames = ["mister_ds_"];
    return adminIds.includes(user.id) || adminUsernames.includes(user.login?.toLowerCase());
  };

  // Interface si pas connecté
  if (!user) {
    return (
      <div className="admin-panel">
        <div className="auth-required">
          <h2>🔒 Connexion requise</h2>
          <p>Connectez-vous avec votre compte Twitch pour accéder au panneau d'administration.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement du panneau d'administration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel">
        <div className="error-message">
          <h2>⚠️ Erreur</h2>
          <p>{error}</p>
          <button onClick={initializeStreamerConfig} className="btn btn-primary">
            <RefreshCw size={16} /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!streamerConfig) {
    return (
      <div className="admin-panel">
        <div className="no-config">
          <h2>⚙️ Configuration manquante</h2>
          <p>Impossible de charger votre configuration de streamer.</p>
          <button onClick={initializeStreamerConfig} className="btn btn-primary">
            <Plus size={16} /> Créer la configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {/* 🆕 Container pour les notifications admin */}
      <div className="admin-notifications-container">
        {adminNotifications.map(notification => (
          <AdminNotification
            key={notification.id}
            notification={notification}
            onClose={() => removeAdminNotification(notification.id)}
          />
        ))}
      </div>

      <div className="admin-header">
        <h1>🎮 Panneau Admin Pauvrathon</h1>
        <div className="global-stats">
          <div className="global-stat">
            <Zap size={20} />
            <span>Connecté: {streamerConfig.user_data?.twitch_display_name}</span>
          </div>
        </div>
      </div>

      <div className="streamers-list">
        <div className="streamer-card">
          {/* En-tête du streamer */}
          <div className="streamer-header">
            <div className="streamer-info">
              <h3>{streamerConfig.user_data?.twitch_display_name}</h3>
              <div className="status-badges">
                <span className={`badge ${streamerConfig.is_live ? 'live' : 'offline'}`}>
                  {streamerConfig.is_live ? '🔴 Live' : '⚫ Offline'}
                </span>
                <span className={`badge ${streamerConfig.subathon_active ? 'active' : 'inactive'}`}>
                  {streamerConfig.subathon_active ? '✅ Pauvrathon ON' : '❌ Pauvrathon OFF'}
                </span>
              </div>
            </div>
            
            <div className="streamer-controls">
              <button 
                onClick={() => toggleSubathon(!streamerConfig.subathon_active)}
                className={`btn ${streamerConfig.subathon_active ? 'btn-danger' : 'btn-success'}`}
                disabled={saving}
              >
                {streamerConfig.subathon_active ? <Pause size={16} /> : <Play size={16} />}
                {streamerConfig.subathon_active ? 'Arrêter' : 'Démarrer'}
              </button>
            </div>
          </div>

          {/* 🆕 SECTION CONTRÔLES TEMPS RÉEL - TOUJOURS VISIBLE */}
          <div className="real-time-controls">
            <h4>⚡ Contrôles Temps Réel</h4>
            
            {/* Timer Controls */}
            <div className="timer-controls">
              <h5>⏰ Gestion du Timer</h5>
              <div className="timer-display">
                <span className="timer-value">
                  {Math.floor(streamerConfig.current_timer / 3600)}h {Math.floor((streamerConfig.current_timer % 3600) / 60)}m {streamerConfig.current_timer % 60}s
                </span>
                <div className="timer-buttons">
                  <button onClick={() => updateTimer('add', 60)} className="btn btn-success btn-small">
                    <Plus size={14} /> +1min
                  </button>
                  <button onClick={() => updateTimer('add', 300)} className="btn btn-success btn-small">
                    <Plus size={14} /> +5min
                  </button>
                  <button onClick={() => updateTimer('subtract', 60)} className="btn btn-warning btn-small">
                    <Minus size={14} /> -1min
                  </button>
                  <button onClick={() => updateTimer('set')} className="btn btn-info btn-small">
                    <Edit size={14} /> Définir
                  </button>
                  <button onClick={() => updateTimer('reset')} className="btn btn-danger btn-small">
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Settings */}
            <div className="quick-settings">
              <h5>⚙️ Paramètres Rapides</h5>
              <div className="quick-settings-grid">
                
                {/* Clics requis */}
                <div className="quick-setting-item">
                  <label>🎯 Clics requis:</label>
                  {editingField === 'clicks_required' ? (
                    <div className="quick-edit">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={tempValues.clicks_required || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, clicks_required: parseInt(e.target.value) }))}
                      />
                      <button onClick={() => saveQuickEdit('clicks_required')} className="btn btn-success btn-small">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelQuickEdit} className="btn btn-secondary btn-small">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="quick-display">
                      <span>{streamerConfig.clicks_required}</span>
                      <button 
                        onClick={() => startQuickEdit('clicks_required', streamerConfig.clicks_required)}
                        className="btn btn-info btn-small"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Temps min ajouté */}
                <div className="quick-setting-item">
                  <label>⏰ Temps min (s):</label>
                  {editingField === 'time_range_min' ? (
                    <div className="quick-edit">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={tempValues.time_range_min || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, time_range_min: parseInt(e.target.value) }))}
                      />
                      <button onClick={() => saveQuickEdit('time_range_min')} className="btn btn-success btn-small">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelQuickEdit} className="btn btn-secondary btn-small">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="quick-display">
                      <span>{streamerConfig.time_range_min}s</span>
                      <button 
                        onClick={() => startQuickEdit('time_range_min', streamerConfig.time_range_min)}
                        className="btn btn-info btn-small"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Temps max ajouté */}
                <div className="quick-setting-item">
                  <label>⏰ Temps max (s):</label>
                  {editingField === 'time_range_max' ? (
                    <div className="quick-edit">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={tempValues.time_range_max || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, time_range_max: parseInt(e.target.value) }))}
                      />
                      <button onClick={() => saveQuickEdit('time_range_max')} className="btn btn-success btn-small">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelQuickEdit} className="btn btn-secondary btn-small">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="quick-display">
                      <span>{streamerConfig.time_range_max}s</span>
                      <button 
                        onClick={() => startQuickEdit('time_range_max', streamerConfig.time_range_max)}
                        className="btn btn-info btn-small"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Cooldown */}
                <div className="quick-setting-item">
                  <label>⏱️ Cooldown (s):</label>
                  {editingField === 'cooldown_between_games' ? (
                    <div className="quick-edit">
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={tempValues.cooldown_between_games || ''}
                        onChange={(e) => setTempValues(prev => ({ ...prev, cooldown_between_games: parseInt(e.target.value) }))}
                      />
                      <button onClick={() => saveQuickEdit('cooldown_between_games')} className="btn btn-success btn-small">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelQuickEdit} className="btn btn-secondary btn-small">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="quick-display">
                      <span>{streamerConfig.cooldown_between_games}s</span>
                      <button 
                        onClick={() => startQuickEdit('cooldown_between_games', streamerConfig.cooldown_between_games)}
                        className="btn btn-info btn-small"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Statistiques temps réel */}
          <div className="stats-row">
            <div className="stat">
              <Timer size={16} />
              <span>Timer: {Math.floor(streamerConfig.current_timer / 3600)}h {Math.floor((streamerConfig.current_timer % 3600) / 60)}m</span>
            </div>
            <div className="stat">
              <Users size={16} />
              <span>Participants: {stats.participants_today}</span>
            </div>
            <div className="stat">
              <Clock size={16} />
              <span>Temps ajouté: +{Math.floor(stats.total_time_added_today / 60)}min</span>
            </div>
            <div className="stat">
              <Gamepad2 size={16} />
              <span>Jeux: {stats.total_games_today}</span>
            </div>
            <button onClick={() => fetchTodayStats(streamerConfig.id)} className="btn btn-secondary btn-small">
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>

          {/* Section Notifications */}
          <div className="notifications-section">
            <h4>📢 Notifications</h4>
            <div className="notification-controls">
              <div className="notification-stats">
                <span className="notification-stat">
                  <Bell size={16} />
                  {followerCount} followers avec notifications
                </span>
                <span className="notification-stat">
                  <MessageSquare size={16} />
                  Notifications {streamerConfig.auto_notifications ? 'activées' : 'désactivées'}
                </span>
              </div>
              
              <button 
                onClick={sendCustomNotification}
                className="btn btn-info"
                disabled={sendingNotification}
                title="Envoyer une notification personnalisée à vos followers"
              >
                {sendingNotification ? '⏳' : <Bell size={16} />}
                {sendingNotification ? 'Envoi...' : 'Notification personnalisée'}
              </button>
            </div>
            
            <div className="notification-info">
              <p>
                💡 <strong>Notifications automatiques :</strong> Vos followers seront automatiquement 
                notifiés quand vous démarrez/arrêtez votre Pauvrathon.
                {followerCount === 0 && (
                  <span style={{ color: '#f59e0b' }}> Aucun follower pour le moment - partagez votre page pour que les gens puissent vous suivre !</span>
                )}
              </p>
            </div>
          </div>

          {/* Configuration Avancée - Mode Onglets */}
          <div className="advanced-config">
            <h4>⚙️ Configuration Avancée</h4>
            
            <div className="config-tabs">
              <button 
                className={`tab ${activeTab === 'general' ? 'active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                <Settings size={16} /> Général
              </button>
              <button 
                className={`tab ${activeTab === 'games' ? 'active' : ''}`}
                onClick={() => setActiveTab('games')}
              >
                <Gamepad2 size={16} /> Jeux
              </button>
              <button 
                className={`tab ${activeTab === 'participation' ? 'active' : ''}`}
                onClick={() => setActiveTab('participation')}
              >
                <Users size={16} /> Participation
              </button>
              <button 
                className={`tab ${activeTab === 'personalization' ? 'active' : ''}`}
                onClick={() => setActiveTab('personalization')}
              >
                <Palette size={16} /> Personnalisation
              </button>
              <button 
                className={`tab ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <Shield size={16} /> Sécurité
              </button>
            </div>

            <div className="config-content">
              
              {/* Onglet Général */}
              {activeTab === 'general' && (
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4><Timer size={16} /> Limites du timer</h4>
                    <label>
                      Timer maximum (secondes):
                      <input
                        type="number"
                        min="1800"
                        max="86400"
                        value={streamerConfig.timer_max}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, timer_max: newValue }));
                          // Sauvegarde automatique après 1 seconde d'inactivité
                          clearTimeout(window.autoSaveTimer);
                          window.autoSaveTimer = setTimeout(() => {
                            supabase.from('streamers').update({ timer_max: newValue }).eq('id', streamerConfig.id);
                          }, 1000);
                        }}
                      />
                      <small>{Math.floor(streamerConfig.timer_max / 3600)}h {Math.floor((streamerConfig.timer_max % 3600) / 60)}m</small>
                    </label>
                    <label>
                      Timer minimum (secondes):
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={streamerConfig.timer_min}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, timer_min: newValue }));
                          clearTimeout(window.autoSaveTimer2);
                          window.autoSaveTimer2 = setTimeout(() => {
                            supabase.from('streamers').update({ timer_min: newValue }).eq('id', streamerConfig.id);
                          }, 1000);
                        }}
                      />
                      <small>{Math.floor(streamerConfig.timer_min / 60)}m</small>
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><TrendingUp size={16} /> Multiplicateurs de temps</h4>
                    <label>
                      Weekend (x{streamerConfig.time_multiplier_weekend}):
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.1"
                        value={streamerConfig.time_multiplier_weekend}
                        onChange={(e) => {
                          const newValue = parseFloat(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, time_multiplier_weekend: newValue }));
                          clearTimeout(window.autoSaveTimer3);
                          window.autoSaveTimer3 = setTimeout(() => {
                            supabase.from('streamers').update({ time_multiplier_weekend: newValue }).eq('id', streamerConfig.id);
                          }, 500);
                        }}
                      />
                    </label>
                    <label>
                      Soirée 18h-23h (x{streamerConfig.time_multiplier_evening}):
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.1"
                        value={streamerConfig.time_multiplier_evening}
                        onChange={(e) => {
                          const newValue = parseFloat(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, time_multiplier_evening: newValue }));
                          clearTimeout(window.autoSaveTimer4);
                          window.autoSaveTimer4 = setTimeout(() => {
                            supabase.from('streamers').update({ time_multiplier_evening: newValue }).eq('id', streamerConfig.id);
                          }, 500);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Onglet Jeux */}
              {activeTab === 'games' && (
                <div className="games-config">
                  <h4><Gamepad2 size={16} /> Configuration des mini-jeux</h4>
                  {availableGames.map(game => {
                    const gameSettings = streamerConfig.game_settings?.[game.id] || {
                      enabled: true,
                      difficulty: 1.0,
                      time_bonus_min: 30,
                      time_bonus_max: 60
                    };
                    
                    return (
                      <div key={game.id} className="game-config-card">
                        <div className="game-header">
                          <div className="game-info">
                            <span className="game-icon">{game.icon}</span>
                            <h5>{game.name}</h5>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={gameSettings.enabled}
                              onChange={(e) => {
                                const newSettings = {
                                  ...streamerConfig.game_settings,
                                  [game.id]: { ...gameSettings, enabled: e.target.checked }
                                };
                                setStreamerConfig(prev => ({ ...prev, game_settings: newSettings }));
                                // Sauvegarde immédiate pour les jeux
                                supabase.from('streamers').update({ game_settings: newSettings }).eq('id', streamerConfig.id);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>
                        
                        {gameSettings.enabled && (
                          <div className="game-settings">
                            <label>
                              Difficulté (x{gameSettings.difficulty}):
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={gameSettings.difficulty}
                                onChange={(e) => {
                                  const newSettings = {
                                    ...streamerConfig.game_settings,
                                    [game.id]: { ...gameSettings, difficulty: parseFloat(e.target.value) }
                                  };
                                  setStreamerConfig(prev => ({ ...prev, game_settings: newSettings }));
                                  clearTimeout(window[`gameTimer_${game.id}_diff`]);
                                  window[`gameTimer_${game.id}_diff`] = setTimeout(() => {
                                    supabase.from('streamers').update({ game_settings: newSettings }).eq('id', streamerConfig.id);
                                  }, 500);
                                }}
                              />
                            </label>
                            <div className="time-bonus-range">
                              <label>
                                Temps bonus min (s):
                                <input
                                  type="number"
                                  min="5"
                                  max="300"
                                  value={gameSettings.time_bonus_min}
                                  onChange={(e) => {
                                    const newSettings = {
                                      ...streamerConfig.game_settings,
                                      [game.id]: { ...gameSettings, time_bonus_min: parseInt(e.target.value) }
                                    };
                                    setStreamerConfig(prev => ({ ...prev, game_settings: newSettings }));
                                    clearTimeout(window[`gameTimer_${game.id}_min`]);
                                    window[`gameTimer_${game.id}_min`] = setTimeout(() => {
                                      supabase.from('streamers').update({ game_settings: newSettings }).eq('id', streamerConfig.id);
                                    }, 1000);
                                  }}
                                />
                              </label>
                              <label>
                                Temps bonus max (s):
                                <input
                                  type="number"
                                  min="5"
                                  max="300"
                                  value={gameSettings.time_bonus_max}
                                  onChange={(e) => {
                                    const newSettings = {
                                      ...streamerConfig.game_settings,
                                      [game.id]: { ...gameSettings, time_bonus_max: parseInt(e.target.value) }
                                    };
                                    setStreamerConfig(prev => ({ ...prev, game_settings: newSettings }));
                                    clearTimeout(window[`gameTimer_${game.id}_max`]);
                                    window[`gameTimer_${game.id}_max`] = setTimeout(() => {
                                      supabase.from('streamers').update({ game_settings: newSettings }).eq('id', streamerConfig.id);
                                    }, 1000);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Onglet Participation */}
              {activeTab === 'participation' && (
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4><Users size={16} /> Limites de participation</h4>
                    <label>
                      Max participants simultanés:
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={streamerConfig.max_concurrent_participants}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, max_concurrent_participants: newValue }));
                          clearTimeout(window.autoSaveParticipants);
                          window.autoSaveParticipants = setTimeout(() => {
                            supabase.from('streamers').update({ max_concurrent_participants: newValue }).eq('id', streamerConfig.id);
                          }, 1000);
                        }}
                      />
                    </label>
                    <label>
                      Max temps/jour par viewer (secondes):
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={streamerConfig.max_daily_time_per_viewer}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, max_daily_time_per_viewer: newValue }));
                          clearTimeout(window.autoSaveDaily);
                          window.autoSaveDaily = setTimeout(() => {
                            supabase.from('streamers').update({ max_daily_time_per_viewer: newValue }).eq('id', streamerConfig.id);
                          }, 1000);
                        }}
                      />
                      <small>{Math.floor(streamerConfig.max_daily_time_per_viewer / 60)}m par jour</small>
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><Star size={16} /> Prérequis de participation</h4>
                    <label>
                      Minimum de followers:
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={streamerConfig.min_followers}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, min_followers: newValue }));
                          clearTimeout(window.autoSaveFollowers);
                          window.autoSaveFollowers = setTimeout(() => {
                            supabase.from('streamers').update({ min_followers: newValue }).eq('id', streamerConfig.id);
                          }, 1000);
                        }}
                      />
                    </label>
                    <label>
                      Âge minimum du compte (jours):
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={streamerConfig.min_account_age_days}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value);
                          setStreamerConfig(prev => ({ ...prev, min_account_age_days: newValue }));
                          clearTimeout(window.autoSaveAge);
                          window.autoSaveAge = setTimeout(() => {
                            supabase.from('streamers').update({ min_account_age_days: newValue }).eq('id', streamerConfig.id);
                          }, 1000);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Onglet Personnalisation */}
              {activeTab === 'personalization' && (
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4><MessageSquare size={16} /> Message de bienvenue</h4>
                    <textarea
                      rows="3"
                      placeholder="Message affiché aux participants sur votre page..."
                      value={streamerConfig.welcome_message}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setStreamerConfig(prev => ({ ...prev, welcome_message: newValue }));
                        clearTimeout(window.autoSaveWelcome);
                        window.autoSaveWelcome = setTimeout(() => {
                          supabase.from('streamers').update({ welcome_message: newValue }).eq('id', streamerConfig.id);
                        }, 1500);
                      }}
                      maxLength="500"
                    />
                    <small>{streamerConfig.welcome_message?.length || 0}/500 caractères</small>
                  </div>

                  <div className="setting-group">
                    <h4><Palette size={16} /> Thème visuel</h4>
                    <label>
                      Couleur principale:
                      <div className="color-picker">
                        <input
                          type="color"
                          value={streamerConfig.theme_color}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setStreamerConfig(prev => ({ ...prev, theme_color: newValue }));
                            // Sauvegarde immédiate pour les couleurs
                            supabase.from('streamers').update({ theme_color: newValue }).eq('id', streamerConfig.id);
                          }}
                        />
                        <span>{streamerConfig.theme_color}</span>
                      </div>
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><Volume2 size={16} /> Sons</h4>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={streamerConfig.victory_sound}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setStreamerConfig(prev => ({ ...prev, victory_sound: newValue }));
                          supabase.from('streamers').update({ victory_sound: newValue }).eq('id', streamerConfig.id);
                        }}
                      />
                      Son de victoire
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={streamerConfig.defeat_sound}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setStreamerConfig(prev => ({ ...prev, defeat_sound: newValue }));
                          supabase.from('streamers').update({ defeat_sound: newValue }).eq('id', streamerConfig.id);
                        }}
                      />
                      Son de défaite
                    </label>
                  </div>
                </div>
              )}

              {/* Onglet Sécurité */}
              {activeTab === 'security' && (
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4><Shield size={16} /> Anti-triche</h4>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={streamerConfig.auto_ban_suspicious}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setStreamerConfig(prev => ({ ...prev, auto_ban_suspicious: newValue }));
                          supabase.from('streamers').update({ auto_ban_suspicious: newValue }).eq('id', streamerConfig.id);
                        }}
                      />
                      Ban automatique activité suspecte
                    </label>
                    <small>Détecte et ban automatiquement les comportements anormaux</small>
                  </div>

                  <div className="setting-group">
                    <h4><BarChart3 size={16} /> Limites de sécurité</h4>
                    <div className="security-limits">
                      <div className="limit-item">
                        <label>Max clics par minute:</label>
                        <span>60 (protection spam)</span>
                      </div>
                      <div className="limit-item">
                        <label>Max tentatives échouées:</label>
                        <span>10 par heure</span>
                      </div>
                      <div className="limit-item">
                        <label>Cooldown minimum:</label>
                        <span>5 secondes</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="quick-actions">
            <button 
              onClick={() => window.open(`/participate/${streamerConfig.id}`, '_blank')}
              className="btn btn-success"
            >
              <Eye size={16} /> Voir ma page
            </button>
            <button 
              onClick={() => window.open(`https://twitch.tv/${streamerConfig.user_data?.twitch_username}`, '_blank')}
              className="btn btn-info"
            >
              <Zap size={16} /> Mon Twitch
            </button>
            <button 
              onClick={() => fetchTodayStats(streamerConfig.id)}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} /> Actualiser stats
            </button>
          </div>

          {/* Résumé des paramètres actuels */}
          <div className="current-settings-summary">
            <h4>⚙️ Configuration actuelle</h4>
            <div className="settings-summary-grid">
              <div className="summary-item">
                <span>🎯 Clics requis:</span>
                <strong>{streamerConfig.clicks_required}</strong>
              </div>
              <div className="summary-item">
                <span>⏱️ Cooldown:</span>
                <strong>{streamerConfig.cooldown_between_games}s</strong>
              </div>
              <div className="summary-item">
                <span>⏰ Temps ajouté:</span>
                <strong>{streamerConfig.time_range_min}-{streamerConfig.time_range_max}s</strong>
              </div>
              <div className="summary-item">
                <span>👥 Max participants:</span>
                <strong>{streamerConfig.max_concurrent_participants || 50}</strong>
              </div>
              <div className="summary-item">
                <span>🎮 Jeux actifs:</span>
                <strong>
                  {Object.values(streamerConfig.game_settings || {}).filter(g => g.enabled).length}/{availableGames.length}
                </strong>
              </div>
              <div className="summary-item">
                <span>🎨 Thème:</span>
                <div 
                  className="color-dot" 
                  style={{ backgroundColor: streamerConfig.theme_color || '#a855f7' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;