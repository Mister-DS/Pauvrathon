import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, Play, Pause, Edit3, Save, X, Clock, MousePointer, 
  Gamepad2, Shield, Users, BarChart3, AlertTriangle, 
  Timer, Target, Award, Ban, Eye, Zap, RefreshCw, Plus
} from 'lucide-react';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const [streamerConfig, setStreamerConfig] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    participants_today: 0,
    total_time_added_today: 0,
    active_sessions: 0,
    total_games_today: 0
  });

  useEffect(() => {
    if (user) {
      initializeStreamerConfig();
    }
  }, [user]);

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
        // Créer la configuration streamer par défaut
        const { data: newStreamer, error: insertStreamerError } = await supabase
          .from('streamers')
          .insert([{
            user_id: userData.id,
            is_live: false,
            subathon_active: false,
            current_timer: 0,
            time_range_min: 10,
            time_range_max: 60,
            clicks_required: 50,
            cooldown_between_games: 30,
            max_daily_time_per_viewer: 300,
            difficulty_multiplier: 1.0,
            auto_ban_suspicious: true,
            min_account_age_days: 7
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

      // Jeux joués aujourd'hui pour ce streamer (via les time_additions)
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

  // Vérifier le statut live sur Twitch
  const checkTwitchStreamStatus = async () => {
    try {
      const token = localStorage.getItem('twitch_access_token');
      if (!token) return;

      const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      if (response.ok) {
        const data = await response.json();
        const isLive = data.data && data.data.length > 0;

        // Mettre à jour le statut dans la base
        const { error } = await supabase
          .from('streamers')
          .update({ is_live: isLive })
          .eq('id', streamerConfig.id);

        if (!error) {
          setStreamerConfig(prev => ({ ...prev, is_live: isLive }));
        }
      }
    } catch (err) {
      console.error('Erreur vérification stream:', err);
    }
  };

  // Démarrer/arrêter le Pauvrathon
  const toggleSubathon = async (active) => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('streamers')
        .update({ subathon_active: active })
        .eq('id', streamerConfig.id);

      if (error) throw error;

      setStreamerConfig(prev => ({ ...prev, subathon_active: active }));
      
    } catch (err) {
      console.error('Erreur toggle subathon:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setSaving(false);
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

      const { error } = await supabase
        .from('streamers')
        .update({
          time_range_min: tempSettings.time_range_min,
          time_range_max: tempSettings.time_range_max,
          clicks_required: tempSettings.clicks_required,
          cooldown_between_games: tempSettings.cooldown_between_games,
          max_daily_time_per_viewer: tempSettings.max_daily_time_per_viewer,
          difficulty_multiplier: tempSettings.difficulty_multiplier,
          auto_ban_suspicious: tempSettings.auto_ban_suspicious,
          min_account_age_days: tempSettings.min_account_age_days
        })
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

  // Reset des stats du jour
  const resetDailyStats = async () => {
    if (!window.confirm('Réinitialiser toutes les statistiques du jour ? Cette action est irréversible.')) return;
    
    try {
      setSaving(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Supprimer les sessions du jour
      const { error: sessionsError } = await supabase
        .from('pauvrathon_sessions')
        .delete()
        .eq('streamer_id', streamerConfig.id)
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);

      if (sessionsError) throw sessionsError;

      // Recharger les stats
      await fetchTodayStats(streamerConfig.id);
      
    } catch (err) {
      console.error('Erreur reset stats:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setSaving(false);
    }
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
              <button onClick={checkTwitchStreamStatus} className="btn btn-info">
                <RefreshCw size={16} /> Vérifier Live
              </button>
              
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

          {/* Configuration des paramètres */}
          <div className="settings-grid">
            <div className="setting-group">
              <h4><Clock size={16} /> Temps ajouté</h4>
              <div className="range-inputs">
                <label>
                  Min (secondes):
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={settings.time_range_min}
                    onChange={(e) => updateTempSetting('time_range_min', parseInt(e.target.value))}
                    disabled={!editingSettings}
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
                    disabled={!editingSettings}
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
                  min="10"
                  max="200"
                  value={settings.clicks_required}
                  onChange={(e) => updateTempSetting('clicks_required', parseInt(e.target.value))}
                  disabled={!editingSettings}
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
                  disabled={!editingSettings}
                />
              </label>
            </div>

            <div className="setting-group">
              <h4><Gamepad2 size={16} /> Mini-jeux</h4>
              <label>
                Multiplicateur difficulté:
                <select
                  value={settings.difficulty_multiplier}
                  onChange={(e) => updateTempSetting('difficulty_multiplier', parseFloat(e.target.value))}
                  disabled={!editingSettings}
                >
                  <option value="0.5">Très facile (×0.5)</option>
                  <option value="0.8">Facile (×0.8)</option>
                  <option value="1.0">Normal (×1.0)</option>
                  <option value="1.2">Difficile (×1.2)</option>
                  <option value="1.5">Très difficile (×1.5)</option>
                </select>
              </label>
            </div>

            <div className="setting-group">
              <h4><Shield size={16} /> Anti-triche</h4>
              <label>
                Max temps/jour par viewer (secondes):
                <input
                  type="number"
                  min="60"
                  max="3600"
                  value={settings.max_daily_time_per_viewer}
                  onChange={(e) => updateTempSetting('max_daily_time_per_viewer', parseInt(e.target.value))}
                  disabled={!editingSettings}
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
                  disabled={!editingSettings}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.auto_ban_suspicious}
                  onChange={(e) => updateTempSetting('auto_ban_suspicious', e.target.checked)}
                  disabled={!editingSettings}
                />
                Ban automatique activité suspecte
              </label>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="quick-actions">
            <button onClick={resetDailyStats} className="btn btn-warning" disabled={saving}>
              <BarChart3 size={16} /> Reset stats du jour
            </button>
            <button 
              onClick={() => window.open(`/overlay/${streamerConfig.id}`, '_blank')}
              className="btn btn-info"
            >
              <Eye size={16} /> Voir overlay
            </button>
            <button 
              onClick={() => fetchTodayStats(streamerConfig.id)}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} /> Actualiser stats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;