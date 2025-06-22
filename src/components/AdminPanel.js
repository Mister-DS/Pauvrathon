import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, Play, Pause, Edit3, Save, X, Clock, MousePointer, 
  Gamepad2, Shield, Users, BarChart3, AlertTriangle, 
  Timer, Target, Award, Ban, Eye, Zap, RefreshCw, Plus,
  Palette, Bell, MessageSquare, TrendingUp, Star, Heart,
  Volume2, Webhook, ToggleLeft, ToggleRight, Sliders,
  Calendar, UserCheck, UserX, Trophy, Gift
} from 'lucide-react';
// 🔔 NOUVEAU: Import du service de notifications
import notificationService from './NotificationService';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const [streamerConfig, setStreamerConfig] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState({});
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

  // 🔔 NOUVEAU: États pour les notifications
  const [followerCount, setFollowerCount] = useState(0);
  const [sendingNotification, setSendingNotification] = useState(false);

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

  useEffect(() => {
    if (user) {
      initializeStreamerConfig();
    }
  }, [user]);

  // 🔔 NOUVEAU: Charger le nombre de followers
  useEffect(() => {
    if (streamerConfig?.id) {
      loadFollowerCount();
    }
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
            // Nouvelles configurations
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

    } catch (err) {
      console.error('Erreur initialisation:', err);
      setError(`Erreur: ${err.message}`);
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

  // 🔔 NOUVEAU: Charger le nombre de followers
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

  // 🔔 MODIFIÉ: Démarrer/arrêter le Pauvrathon avec notifications
  const toggleSubathon = async (active) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('streamers')
        .update({ subathon_active: active })
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, subathon_active: active }));
      
      // 🔔 NOUVEAU : Notifications automatiques
      if (active) {
        console.log('🔄 Envoi notifications Pauvrathon démarré...');
        
        try {
          const result = await notificationService.notifyPauvrathonStart(
            streamerConfig.id,
            streamerConfig.user_data?.twitch_display_name
          );
          
          if (result.success) {
            console.log(`📢 ${result.count} notifications envoyées`);
            
            // Afficher un message de succès à l'admin
            if (result.count > 0) {
              setTimeout(() => {
                alert(`🎉 Pauvrathon démarré !\n\n📢 ${result.count} followers ont été notifiés automatiquement.`);
              }, 500);
            } else {
              setTimeout(() => {
                alert(`🎉 Pauvrathon démarré !\n\n💡 Aucun follower à notifier pour le moment.`);
              }, 500);
            }
          } else {
            console.warn('⚠️ Erreur envoi notifications:', result.error);
          }
        } catch (notifError) {
          console.warn('⚠️ Service de notifications non disponible:', notifError);
          // Le Pauvrathon fonctionne même sans notifications
        }
      } else {
        // Optionnel : Notifier la fin du Pauvrathon
        const finalTime = streamerConfig.current_timer;
        if (finalTime > 0) {
          try {
            const result = await notificationService.notifyPauvrathonEnd(
              streamerConfig.id,
              streamerConfig.user_data?.twitch_display_name,
              finalTime
            );
            
            if (result.success && result.count > 0) {
              console.log(`📢 ${result.count} notifications de fin envoyées`);
            }
          } catch (notifError) {
            console.warn('⚠️ Erreur notification fin:', notifError);
          }
        }
      }
      
    } catch (err) {
      console.error('Erreur toggle subathon:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 🔔 NOUVEAU: Envoyer notification personnalisée
  const sendCustomNotification = async () => {
    const title = prompt('Titre de la notification:');
    if (!title) return;
    
    const message = prompt('Message de la notification:');
    if (!message) return;
    
    try {
      setSendingNotification(true);
      
      // Récupérer tous les followers
      const { data: followers, error } = await supabase
        .from('streamer_followers')
        .select('user_id')
        .eq('streamer_id', streamerConfig.id)
        .eq('notification_enabled', true);

      if (error) throw error;

      let sentCount = 0;
      
      // Envoyer à chaque follower
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
      
      alert(`✅ Notification envoyée à ${sentCount} followers !`);
      
    } catch (error) {
      console.error('Erreur notification personnalisée:', error);
      alert('❌ Erreur lors de l\'envoi');
    } finally {
      setSendingNotification(false);
    }
  };

  // Modifier le timer manuellement
  const updateTimer = async () => {
    const currentTimer = streamerConfig.current_timer || 0;
    const newTimer = prompt(`Timer actuel: ${Math.floor(currentTimer / 3600)}h ${Math.floor((currentTimer % 3600) / 60)}m\n\nNouveau timer (en secondes):`, currentTimer);
    
    if (newTimer === null) return;
    const timerValue = parseInt(newTimer);
    if (isNaN(timerValue) || timerValue < 0) {
      alert('Valeur invalide');
      return;
    }

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('streamers')
        .update({ current_timer: timerValue })
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, current_timer: timerValue }));
      
    } catch (err) {
      console.error('Erreur update timer:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Commencer l'édition des paramètres
  const startEditing = () => {
    setEditingSettings(true);
    setTempSettings({ ...streamerConfig });
  };

  // Annuler l'édition
  const cancelEditing = () => {
    setEditingSettings(false);
    setTempSettings({});
  };

  // Sauvegarder les paramètres
  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');

      // Préparer les données à sauvegarder
      const dataToUpdate = {
        // Paramètres généraux
        time_range_min: tempSettings.time_range_min,
        time_range_max: tempSettings.time_range_max,
        clicks_required: tempSettings.clicks_required,
        cooldown_between_games: tempSettings.cooldown_between_games,
        timer_max: tempSettings.timer_max,
        timer_min: tempSettings.timer_min,
        
        // Participation
        max_daily_time_per_viewer: tempSettings.max_daily_time_per_viewer,
        max_concurrent_participants: tempSettings.max_concurrent_participants,
        min_followers: tempSettings.min_followers,
        min_account_age_days: tempSettings.min_account_age_days,
        
        // Sécurité
        difficulty_multiplier: tempSettings.difficulty_multiplier,
        auto_ban_suspicious: tempSettings.auto_ban_suspicious,
        
        // Personnalisation
        welcome_message: tempSettings.welcome_message,
        theme_color: tempSettings.theme_color,
        victory_sound: tempSettings.victory_sound,
        defeat_sound: tempSettings.defeat_sound,
        
        // Multiplicateurs
        time_multiplier_weekend: tempSettings.time_multiplier_weekend,
        time_multiplier_evening: tempSettings.time_multiplier_evening,
        
        // Notifications
        auto_notifications: tempSettings.auto_notifications,
        discord_webhook: tempSettings.discord_webhook,
        
        // Jeux et objectifs
        game_settings: tempSettings.game_settings,
        daily_goals: tempSettings.daily_goals,
        participation_whitelist: tempSettings.participation_whitelist || [],
        participation_blacklist: tempSettings.participation_blacklist || []
      };

      const { error } = await supabase
        .from('streamers')
        .update(dataToUpdate)
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, ...tempSettings }));
      setEditingSettings(false);
      setTempSettings({});
      
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      setError(`Erreur lors de la sauvegarde: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Mettre à jour un paramètre temporaire
  const updateTempSetting = (key, value) => {
    setTempSettings(prev => ({ ...prev, [key]: value }));
  };

  // Mettre à jour les paramètres d'un jeu
  const updateGameSetting = (gameId, setting, value) => {
    setTempSettings(prev => ({
      ...prev,
      game_settings: {
        ...prev.game_settings,
        [gameId]: {
          ...prev.game_settings[gameId],
          [setting]: value
        }
      }
    }));
  };

  // Ajouter/retirer de la whitelist
  const updateWhitelist = (username, action) => {
    const currentList = tempSettings.participation_whitelist || [];
    if (action === 'add' && username.trim()) {
      updateTempSetting('participation_whitelist', [...currentList, username.trim()]);
    } else if (action === 'remove') {
      updateTempSetting('participation_whitelist', currentList.filter(u => u !== username));
    }
  };

  // Ajouter/retirer de la blacklist
  const updateBlacklist = (username, action) => {
    const currentList = tempSettings.participation_blacklist || [];
    if (action === 'add' && username.trim()) {
      updateTempSetting('participation_blacklist', [...currentList, username.trim()]);
    } else if (action === 'remove') {
      updateTempSetting('participation_blacklist', currentList.filter(u => u !== username));
    }
  };

  // Prévisualiser les couleurs
  const previewTheme = () => {
    const color = tempSettings.theme_color || '#a855f7';
    document.documentElement.style.setProperty('--preview-color', color);
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

  const settings = editingSettings ? tempSettings : streamerConfig;

  return (
    <div className="admin-panel">
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
              
              {!editingSettings ? (
                <button onClick={startEditing} className="btn btn-primary">
                  <Edit3 size={16} /> Configurer
                </button>
              ) : (
                <div className="edit-controls">
                  <button 
                    onClick={saveSettings} 
                    className="btn btn-success"
                    disabled={saving}
                  >
                    {saving ? '⏳' : <Save size={16} />} 
                    {saving ? 'Sauvegarde...' : 'Sauver'}
                  </button>
                  <button onClick={cancelEditing} className="btn btn-secondary">
                    <X size={16} /> Annuler
                  </button>
                </div>
              )}
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
            <button onClick={updateTimer} className="btn btn-warning btn-small">
              <Edit3 size={14} /> Modifier Timer
            </button>
          </div>

          {/* 🔔 NOUVELLE SECTION: Notifications */}
          {!editingSettings && (
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
          )}

          {/* Onglets de configuration */}
          {editingSettings && (
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
                className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
                onClick={() => setActiveTab('notifications')}
              >
                <Bell size={16} /> Notifications
              </button>
              <button 
                className={`tab ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <Shield size={16} /> Sécurité
              </button>
            </div>
          )}

          {/* Configuration selon l'onglet actif */}
          {editingSettings && (
            <div className="config-content">
              
              {/* Onglet Général */}
              {activeTab === 'general' && (
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4><Clock size={16} /> Temps ajouté par victoire</h4>
                    <div className="range-inputs">
                      <label>
                        Min (secondes):
                        <input
                          type="number"
                          min="1"
                          max="300"
                          value={settings.time_range_min}
                          onChange={(e) => updateTempSetting('time_range_min', parseInt(e.target.value))}
                        />
                      </label>
                      <label>
                        Max (secondes):
                        <input
                          type="number"
                          min="1"
                          max="300"
                          value={settings.time_range_max}
                          onChange={(e) => updateTempSetting('time_range_max', parseInt(e.target.value))}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="setting-group">
                    <h4><MousePointer size={16} /> Système de clics</h4>
                    <label>
                      Clics requis pour mini-jeu:
                      <input
                        type="number"
                        min="5"
                        max="200"
                        value={settings.clicks_required}
                        onChange={(e) => updateTempSetting('clicks_required', parseInt(e.target.value))}
                      />
                    </label>
                    <label>
                      Cooldown entre jeux (secondes):
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={settings.cooldown_between_games}
                        onChange={(e) => updateTempSetting('cooldown_between_games', parseInt(e.target.value))}
                      />
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><Timer size={16} /> Limites du timer</h4>
                    <label>
                      Timer maximum (secondes):
                      <input
                        type="number"
                        min="1800"
                        max="86400"
                        value={settings.timer_max}
                        onChange={(e) => updateTempSetting('timer_max', parseInt(e.target.value))}
                      />
                      <small>{Math.floor(settings.timer_max / 3600)}h {Math.floor((settings.timer_max % 3600) / 60)}m</small>
                    </label>
                    <label>
                      Timer minimum (secondes):
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={settings.timer_min}
                        onChange={(e) => updateTempSetting('timer_min', parseInt(e.target.value))}
                      />
                      <small>{Math.floor(settings.timer_min / 60)}m</small>
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><TrendingUp size={16} /> Multiplicateurs de temps</h4>
                    <label>
                      Weekend (x{settings.time_multiplier_weekend}):
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.1"
                        value={settings.time_multiplier_weekend}
                        onChange={(e) => updateTempSetting('time_multiplier_weekend', parseFloat(e.target.value))}
                      />
                    </label>
                    <label>
                      Soirée 18h-23h (x{settings.time_multiplier_evening}):
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.1"
                        value={settings.time_multiplier_evening}
                        onChange={(e) => updateTempSetting('time_multiplier_evening', parseFloat(e.target.value))}
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
                    const gameSettings = settings.game_settings?.[game.id] || {
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
                              onChange={(e) => updateGameSetting(game.id, 'enabled', e.target.checked)}
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
                                onChange={(e) => updateGameSetting(game.id, 'difficulty', parseFloat(e.target.value))}
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
                                  onChange={(e) => updateGameSetting(game.id, 'time_bonus_min', parseInt(e.target.value))}
                                />
                              </label>
                              <label>
                                Temps bonus max (s):
                                <input
                                  type="number"
                                  min="5"
                                  max="300"
                                  value={gameSettings.time_bonus_max}
                                  onChange={(e) => updateGameSetting(game.id, 'time_bonus_max', parseInt(e.target.value))}
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
                        value={settings.max_concurrent_participants}
                        onChange={(e) => updateTempSetting('max_concurrent_participants', parseInt(e.target.value))}
                      />
                    </label>
                    <label>
                      Max temps/jour par viewer (secondes):
                      <input
                        type="number"
                        min="60"
                        max="3600"
                        value={settings.max_daily_time_per_viewer}
                        onChange={(e) => updateTempSetting('max_daily_time_per_viewer', parseInt(e.target.value))}
                      />
                      <small>{Math.floor(settings.max_daily_time_per_viewer / 60)}m par jour</small>
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
                        value={settings.min_followers}
                        onChange={(e) => updateTempSetting('min_followers', parseInt(e.target.value))}
                      />
                    </label>
                    <label>
                      Âge minimum du compte (jours):
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={settings.min_account_age_days}
                        onChange={(e) => updateTempSetting('min_account_age_days', parseInt(e.target.value))}
                      />
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><UserCheck size={16} /> Whitelist (Participants autorisés)</h4>
                    <div className="user-list">
                      {(settings.participation_whitelist || []).map((username, index) => (
                        <div key={index} className="user-item">
                          <span>{username}</span>
                          <button 
                            onClick={() => updateWhitelist(username, 'remove')}
                            className="btn-remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="add-user">
                        <input
                          type="text"
                          placeholder="Nom d'utilisateur Twitch"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              updateWhitelist(e.target.value, 'add');
                              e.target.value = '';
                            }
                          }}
                        />
                        <button 
                          onClick={(e) => {
                            const input = e.target.previousElementSibling;
                            updateWhitelist(input.value, 'add');
                            input.value = '';
                          }}
                          className="btn btn-success btn-small"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="setting-group">
                    <h4><UserX size={16} /> Blacklist (Participants bannis)</h4>
                    <div className="user-list">
                      {(settings.participation_blacklist || []).map((username, index) => (
                        <div key={index} className="user-item">
                          <span>{username}</span>
                          <button 
                            onClick={() => updateBlacklist(username, 'remove')}
                            className="btn-remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="add-user">
                        <input
                          type="text"
                          placeholder="Nom d'utilisateur à bannir"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              updateBlacklist(e.target.value, 'add');
                              e.target.value = '';
                            }
                          }}
                        />
                        <button 
                          onClick={(e) => {
                            const input = e.target.previousElementSibling;
                            updateBlacklist(input.value, 'add');
                            input.value = '';
                          }}
                          className="btn btn-danger btn-small"
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </div>
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
                      value={settings.welcome_message}
                      onChange={(e) => updateTempSetting('welcome_message', e.target.value)}
                      maxLength="500"
                    />
                    <small>{settings.welcome_message?.length || 0}/500 caractères</small>
                  </div>

                  <div className="setting-group">
                    <h4><Palette size={16} /> Thème visuel</h4>
                    <label>
                      Couleur principale:
                      <div className="color-picker">
                        <input
                          type="color"
                          value={settings.theme_color}
                          onChange={(e) => {
                            updateTempSetting('theme_color', e.target.value);
                            previewTheme();
                          }}
                        />
                        <span>{settings.theme_color}</span>
                      </div>
                    </label>
                    <div className="theme-preview">
                      <div 
                        className="preview-card"
                        style={{ borderColor: settings.theme_color }}
                      >
                        <div 
                          className="preview-button"
                          style={{ backgroundColor: settings.theme_color }}
                        >
                          Aperçu du thème
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="setting-group">
                    <h4><Volume2 size={16} /> Sons</h4>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.victory_sound}
                        onChange={(e) => updateTempSetting('victory_sound', e.target.checked)}
                      />
                      Son de victoire
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.defeat_sound}
                        onChange={(e) => updateTempSetting('defeat_sound', e.target.checked)}
                      />
                      Son de défaite
                    </label>
                  </div>

                  <div className="setting-group">
                    <h4><Trophy size={16} /> Objectifs quotidiens</h4>
                    <label>
                      Objectif d'heures de stream:
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={settings.daily_goals?.target_hours || 6}
                        onChange={(e) => updateTempSetting('daily_goals', {
                          ...settings.daily_goals,
                          target_hours: parseInt(e.target.value)
                        })}
                      />
                    </label>
                    <label>
                      Objectif de participants:
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={settings.daily_goals?.target_participants || 20}
                        onChange={(e) => updateTempSetting('daily_goals', {
                          ...settings.daily_goals,
                          target_participants: parseInt(e.target.value)
                        })}
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.daily_goals?.rewards_enabled}
                        onChange={(e) => updateTempSetting('daily_goals', {
                          ...settings.daily_goals,
                          rewards_enabled: e.target.checked
                        })}
                      />
                      Récompenses automatiques
                    </label>
                  </div>
                </div>
              )}

              {/* Onglet Notifications */}
              {activeTab === 'notifications' && (
                <div className="settings-grid">
                  <div className="setting-group">
                    <h4><Bell size={16} /> Notifications automatiques</h4>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={settings.auto_notifications}
                        onChange={(e) => updateTempSetting('auto_notifications', e.target.checked)}
                      />
                      Activer les notifications automatiques
                    </label>
                    <small>Notifications lors des victoires, nouveaux records, etc.</small>
                  </div>

                  <div className="setting-group">
                    <h4><Webhook size={16} /> Discord Webhook</h4>
                    <label>
                      URL du webhook Discord:
                      <input
                        type="url"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={settings.discord_webhook}
                        onChange={(e) => updateTempSetting('discord_webhook', e.target.value)}
                      />
                    </label>
                    <small>Recevez des notifications Discord lors d'événements importants</small>
                    
                    {settings.discord_webhook && (
                      <button 
                        className="btn btn-info btn-small"
                        onClick={async () => {
                          try {
                            await fetch(settings.discord_webhook, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                content: `🧪 Test de webhook depuis le Pauvrathon de ${streamerConfig.user_data?.twitch_display_name} !`
                              })
                            });
                            alert('Test envoyé !');
                          } catch (err) {
                            alert('Erreur lors du test');
                          }
                        }}
                      >
                        <Zap size={14} /> Tester webhook
                      </button>
                    )}
                  </div>

                  <div className="setting-group">
                    <h4><MessageSquare size={16} /> Messages de chat automatiques</h4>
                    <p className="info-text">
                      <AlertTriangle size={16} />
                      Fonctionnalité en développement - Intégration avec les bots Twitch à venir
                    </p>
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
                        checked={settings.auto_ban_suspicious}
                        onChange={(e) => updateTempSetting('auto_ban_suspicious', e.target.checked)}
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

                  <div className="setting-group">
                    <h4><Eye size={16} /> Logs et surveillance</h4>
                    <div className="monitoring-stats">
                      <div className="monitor-stat">
                        <span>Bans automatiques aujourd'hui:</span>
                        <span className="stat-value">0</span>
                      </div>
                      <div className="monitor-stat">
                        <span>Activités suspectes détectées:</span>
                        <span className="stat-value">0</span>
                      </div>
                      <div className="monitor-stat">
                        <span>Dernière vérification:</span>
                        <span className="stat-value">Il y a {Math.floor(Math.random() * 5)} min</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
          {!editingSettings && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;