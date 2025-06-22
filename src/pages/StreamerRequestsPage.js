import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Clock, Check, X, Eye, ExternalLink, User, Calendar, 
  Users, Filter, RefreshCw, MessageSquare, AlertCircle,
  CheckCircle, XCircle, Search, ArrowUp, ArrowDown,
  UserMinus, Shield, Trash2, AlertTriangle
} from 'lucide-react';
import './StreamerRequestsPage.css';

const StreamerRequestsPage = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [activeStreamers, setActiveStreamers] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [selectedStreamer, setSelectedStreamer] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [currentTab, setCurrentTab] = useState('requests'); // 'requests' ou 'active'
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    thisMonth: 0,
    activeStreamers: 0
  });

  useEffect(() => {
    if (user) {
      loadRequests();
      loadActiveStreamers();
    }
  }, [user]);

  useEffect(() => {
    filterAndSortRequests();
  }, [requests, filter, searchTerm, sortBy, sortOrder]);

  // Charger toutes les demandes
  const loadRequests = async () => {
    try {
      setLoading(true);
      
      const { data: requestsData, error } = await supabase
        .from('streamer_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(requestsData || []);
      calculateStats(requestsData || []);

    } catch (err) {
      console.error('Erreur chargement demandes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les streamers actifs
  const loadActiveStreamers = async () => {
    try {
      const { data: streamersData, error } = await supabase
        .from('streamers')
        .select(`
          *,
          user:users!streamers_user_id_fkey(
            twitch_user_id,
            twitch_username,
            twitch_display_name,
            profile_image_url,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActiveStreamers(streamersData || []);
      
    } catch (err) {
      console.error('Erreur chargement streamers actifs:', err);
    }
  };

  // Calculer les statistiques
  const calculateStats = (requestsData) => {
    const pending = requestsData.filter(r => r.status === 'pending').length;
    const approved = requestsData.filter(r => r.status === 'approved').length;
    const rejected = requestsData.filter(r => r.status === 'rejected').length;
    
    const thisMonth = requestsData.filter(r => {
      const requestDate = new Date(r.created_at);
      const now = new Date();
      return requestDate.getMonth() === now.getMonth() && 
             requestDate.getFullYear() === now.getFullYear() &&
             r.status === 'approved';
    }).length;

    setStats({ 
      pending, 
      approved, 
      rejected, 
      thisMonth, 
      activeStreamers: activeStreamers.length 
    });
  };

  // Filtrer et trier les demandes
  const filterAndSortRequests = () => {
    let filtered = [...requests];

    if (filter !== 'all') {
      filtered = filtered.filter(r => r.status === filter);
    }

    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.twitch_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.twitch_display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.motivation_message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'created_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredRequests(filtered);
  };

  // Approuver une demande
  const approveRequest = async (request) => {
    try {
      setProcessing(request.id);
      console.log('🔄 Début approbation pour:', request.twitch_display_name);

      // 1. Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('streamer_requests')
        .update({ 
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: user.id
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // 2. Créer l'utilisateur s'il n'existe pas
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('twitch_user_id', request.twitch_user_id)
        .single();

      if (userError && userError.code === 'PGRST116') {
        const { data: newUser, error: insertUserError } = await supabase
          .from('users')
          .insert([{
            twitch_user_id: request.twitch_user_id,
            twitch_username: request.twitch_username,
            twitch_display_name: request.twitch_display_name,
            profile_image_url: request.profile_image_url,
            email: request.email
          }])
          .select()
          .single();

        if (insertUserError) throw insertUserError;
        userData = newUser;
      } else if (userError) {
        throw userError;
      }

      // 3. Vérifier si une config streamer existe déjà
      const { data: existingStreamer } = await supabase
        .from('streamers')
        .select('id')
        .eq('user_id', userData.id)
        .single();

      // 4. Créer la configuration streamer seulement si elle n'existe pas
      if (!existingStreamer) {
        const { error: streamerError } = await supabase
          .from('streamers')
          .insert([{
            user_id: userData.id,
            is_live: false,
            subathon_active: false,
            current_timer: 0,
            timer_max: 28800,
            timer_min: 300,
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
            game_settings: {
              trouve_le_chiffre: { enabled: true, difficulty: 1.0, time_bonus_min: 30, time_bonus_max: 60 },
              hangman: { enabled: true, difficulty: 1.0, time_bonus_min: 45, time_bonus_max: 75 },
              memory: { enabled: true, difficulty: 1.0, time_bonus_min: 60, time_bonus_max: 90 },
              reaction: { enabled: true, difficulty: 1.0, time_bonus_min: 25, time_bonus_max: 55 }
            },
            participation_whitelist: [],
            participation_blacklist: [],
            daily_goals: {
              target_hours: 6,
              target_participants: 20,
              rewards_enabled: true
            }
          }]);

        if (streamerError) throw streamerError;
      }

      await loadRequests();
      await loadActiveStreamers();
      console.log('🎉 Approbation terminée avec succès !');
      
    } catch (err) {
      console.error('❌ Erreur approbation:', err);
      alert(`Erreur lors de l'approbation: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // Rejeter une demande
  const rejectRequest = async (request, message = '') => {
    try {
      setProcessing(request.id);

      const { error } = await supabase
        .from('streamer_requests')
        .update({ 
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          rejection_reason: message || null
        })
        .eq('id', request.id);

      if (error) throw error;

      await loadRequests();
      setShowRejectModal(false);
      setRejectMessage('');
      setSelectedRequest(null);
      
    } catch (err) {
      console.error('❌ Erreur rejet:', err);
      alert(`Erreur lors du rejet: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // ✨ NOUVELLE FONCTION - Révoquer le rôle streamer
  const revokeStreamerRole = async (streamer, reason = '') => {
    try {
      setProcessing(streamer.id);
      console.log('🔄 Révocation du rôle pour:', streamer.user?.twitch_display_name);

      // 1. Supprimer la configuration streamer
      const { error: deleteStreamerError } = await supabase
        .from('streamers')
        .delete()
        .eq('id', streamer.id);

      if (deleteStreamerError) throw deleteStreamerError;

      // 2. Créer un log de révocation dans streamer_requests
      const { error: logError } = await supabase
        .from('streamer_requests')
        .insert([{
          twitch_user_id: streamer.user?.twitch_user_id,
          twitch_username: streamer.user?.twitch_username,
          twitch_display_name: streamer.user?.twitch_display_name,
          profile_image_url: streamer.user?.profile_image_url,
          status: 'revoked',
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          rejection_reason: reason || 'Rôle révoqué par un administrateur',
          motivation_message: 'RÉVOCATION - Ancien streamer'
        }]);

      if (logError) console.warn('Avertissement log révocation:', logError);

      // 3. Optionnel: Nettoyer les sessions actives
      const { error: cleanupError } = await supabase
        .from('pauvrathon_sessions')
        .update({ is_active: false })
        .eq('streamer_id', streamer.id);

      if (cleanupError) console.warn('Avertissement nettoyage sessions:', cleanupError);

      await loadActiveStreamers();
      await loadRequests();
      setShowRevokeModal(false);
      setRevokeReason('');
      setSelectedStreamer(null);
      
      console.log('✅ Rôle révoqué avec succès');
      alert(`Rôle streamer révoqué pour ${streamer.user?.twitch_display_name}`);
      
    } catch (err) {
      console.error('❌ Erreur révocation:', err);
      alert(`Erreur lors de la révocation: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // Ouvrir modal de rejet
  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
    setRejectMessage('');
  };

  // Ouvrir modal de révocation
  const openRevokeModal = (streamer) => {
    setSelectedStreamer(streamer);
    setShowRevokeModal(true);
    setRevokeReason('');
  };

  // Fonctions utilitaires (formatDate, formatNumber, getAccountAge) restent identiques
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  const getAccountAge = (createdAt) => {
    if (!createdAt) return 'Inconnu';
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} jours`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`;
    return `${Math.floor(diffDays / 365)} ans`;
  };

  if (!user) {
    return (
      <div className="requests-page">
        <div className="auth-required">
          <h2>🔒 Accès restreint</h2>
          <p>Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="requests-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-page">
      {/* En-tête */}
      <div className="requests-header">
        <h1>🎛️ Gestion des Streamers</h1>
        <button onClick={() => { loadRequests(); loadActiveStreamers(); }} className="btn btn-primary">
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* Onglets */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${currentTab === 'requests' ? 'active' : ''}`}
          onClick={() => setCurrentTab('requests')}
        >
          <MessageSquare size={16} /> Demandes ({stats.pending} en attente)
        </button>
        <button 
          className={`main-tab ${currentTab === 'active' ? 'active' : ''}`}
          onClick={() => setCurrentTab('active')}
        >
          <Shield size={16} /> Streamers Actifs ({activeStreamers.length})
        </button>
      </div>

      {/* Statistiques */}
      <div className="stats-grid">
        <div className="stat-card pending">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.pending}</span>
            <span className="stat-label">En attente</span>
          </div>
        </div>
        
        <div className="stat-card approved">
          <div className="stat-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.approved}</span>
            <span className="stat-label">Approuvées</span>
          </div>
        </div>
        
        <div className="stat-card rejected">
          <div className="stat-icon">
            <XCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.rejected}</span>
            <span className="stat-label">Rejetées</span>
          </div>
        </div>
        
        <div className="stat-card active">
          <div className="stat-icon">
            <Shield size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-number">{activeStreamers.length}</span>
            <span className="stat-label">Actifs</span>
          </div>
        </div>
      </div>

      {/* Contenu selon l'onglet */}
      {currentTab === 'requests' ? (
        <>
          {/* Filtres et recherche pour les demandes */}
          <div className="filters-section">
            <div className="search-bar">
              <Search size={16} />
              <input
                type="text"
                placeholder="Rechercher par nom ou message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-tabs">
              <button 
                className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
              >
                <Clock size={16} /> En attente ({stats.pending})
              </button>
              <button 
                className={`filter-tab ${filter === 'approved' ? 'active' : ''}`}
                onClick={() => setFilter('approved')}
              >
                <CheckCircle size={16} /> Approuvées ({stats.approved})
              </button>
              <button 
                className={`filter-tab ${filter === 'rejected' ? 'active' : ''}`}
                onClick={() => setFilter('rejected')}
              >
                <XCircle size={16} /> Rejetées ({stats.rejected})
              </button>
              <button 
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                <Filter size={16} /> Toutes ({requests.length})
              </button>
            </div>

            <div className="sort-controls">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_at">Date</option>
                <option value="twitch_display_name">Nom</option>
                <option value="followers_count">Followers</option>
              </select>
              <button 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="sort-direction"
              >
                {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>
            </div>
          </div>

          {/* Liste des demandes */}
          <div className="requests-list">
            {filteredRequests.length === 0 ? (
              <div className="no-requests">
                <AlertCircle size={48} />
                <h3>Aucune demande trouvée</h3>
                <p>
                  {filter === 'pending' ? 'Aucune demande en attente' :
                   filter === 'approved' ? 'Aucune demande approuvée' :
                   filter === 'rejected' ? 'Aucune demande rejetée' :
                   'Aucune demande ne correspond à vos critères'}
                </p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div key={request.id} className={`request-card ${request.status}`}>
                  <div className="request-header">
                    <div className="streamer-info">
                      <img 
                        src={request.profile_image_url} 
                        alt={request.twitch_display_name}
                        className="streamer-avatar"
                      />
                      <div className="streamer-details">
                        <h3>{request.twitch_display_name}</h3>
                        <p>@{request.twitch_username}</p>
                        <div className="request-date">
                          <Calendar size={14} />
                          <span>Demandé le {formatDate(request.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`status-badge ${request.status}`}>
                      {request.status === 'pending' && <Clock size={16} />}
                      {request.status === 'approved' && <CheckCircle size={16} />}
                      {request.status === 'rejected' && <XCircle size={16} />}
                      {request.status === 'revoked' && <UserMinus size={16} />}
                      <span>
                        {request.status === 'pending' ? 'En attente' :
                         request.status === 'approved' ? 'Approuvé' :
                         request.status === 'rejected' ? 'Rejeté' :
                         request.status === 'revoked' ? 'Révoqué' : request.status}
                      </span>
                    </div>
                  </div>

                  <div className="request-stats">
                    <div className="stat">
                      <Users size={16} />
                      <span>{formatNumber(request.followers_count || 0)} followers</span>
                    </div>
                    <div className="stat">
                      <User size={16} />
                      <span>Compte créé: {getAccountAge(request.account_created_at)}</span>
                    </div>
                    {request.avg_viewers && (
                      <div className="stat">
                        <Eye size={16} />
                        <span>{formatNumber(request.avg_viewers)} viewers moy.</span>
                      </div>
                    )}
                  </div>

                  {request.motivation_message && (
                    <div className="request-message">
                      <MessageSquare size={16} />
                      <p>"{request.motivation_message}"</p>
                    </div>
                  )}

                  {(request.status === 'rejected' || request.status === 'revoked') && request.rejection_reason && (
                    <div className="rejection-reason">
                      <AlertCircle size={16} />
                      <p><strong>Raison:</strong> {request.rejection_reason}</p>
                    </div>
                  )}

                  <div className="request-actions">
                    <a 
                      href={`https://twitch.tv/${request.twitch_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-info"
                    >
                      <ExternalLink size={16} /> Voir Twitch
                    </a>

                    {request.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => approveRequest(request)}
                          className="btn btn-success"
                          disabled={processing === request.id}
                        >
                          {processing === request.id ? '⏳' : <Check size={16} />}
                          Approuver
                        </button>
                        <button 
                          onClick={() => openRejectModal(request)}
                          className="btn btn-danger"
                          disabled={processing === request.id}
                        >
                          <X size={16} /> Rejeter
                        </button>
                      </>
                    )}

                    {request.status !== 'pending' && request.processed_at && (
                      <div className="processed-info">
                        <span>Traité le {formatDate(request.processed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        // Liste des streamers actifs
        <div className="active-streamers-section">
          <div className="section-header">
            <h2>🛡️ Streamers Actifs</h2>
            <p>Gérez les streamers ayant accès au Pauvrathon</p>
          </div>

          <div className="streamers-list">
            {activeStreamers.length === 0 ? (
              <div className="no-streamers">
                <Shield size={48} />
                <h3>Aucun streamer actif</h3>
                <p>Aucun streamer n'a encore été approuvé.</p>
              </div>
            ) : (
              activeStreamers.map((streamer) => (
                <div key={streamer.id} className="streamer-card active">
                  <div className="streamer-header">
                    <div className="streamer-info">
                      <img 
                        src={streamer.user?.profile_image_url} 
                        alt={streamer.user?.twitch_display_name}
                        className="streamer-avatar"
                      />
                      <div className="streamer-details">
                        <h3>{streamer.user?.twitch_display_name}</h3>
                        <p>@{streamer.user?.twitch_username}</p>
                        <div className="streamer-meta">
                          <span className={`status ${streamer.is_live ? 'live' : 'offline'}`}>
                            {streamer.is_live ? '🔴 Live' : '⚫ Offline'}
                          </span>
                          <span className={`pauvrathon ${streamer.subathon_active ? 'active' : 'inactive'}`}>
                            {streamer.subathon_active ? '✅ Pauvrathon ON' : '❌ Pauvrathon OFF'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="streamer-stats">
                      <div className="stat">
                        <Clock size={16} />
                        <span>Timer: {Math.floor(streamer.current_timer / 3600)}h {Math.floor((streamer.current_timer % 3600) / 60)}m</span>
                      </div>
                      <div className="stat">
                        <Calendar size={16} />
                        <span>Actif depuis: {formatDate(streamer.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="streamer-actions">
                    <a 
                      href={`https://twitch.tv/${streamer.user?.twitch_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-info"
                    >
                      <ExternalLink size={16} /> Twitch
                    </a>
                    
                    <a 
                      href={`/participate/${streamer.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                    >
                      <Eye size={16} /> Voir page
                    </a>

                    <button 
                      onClick={() => openRevokeModal(streamer)}
                      className="btn btn-danger"
                      disabled={processing === streamer.id}
                    >
                      {processing === streamer.id ? '⏳' : <UserMinus size={16} />}
                      Révoquer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de rejet */}
      {showRejectModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Rejeter la demande</h3>
              <button 
                onClick={() => setShowRejectModal(false)}
                className="modal-close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <p>Êtes-vous sûr de vouloir rejeter la demande de <strong>{selectedRequest.twitch_display_name}</strong> ?</p>
              
              <div className="message-section">
                <label>Message de rejet (optionnel):</label>
                <textarea
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  placeholder="Expliquez pourquoi la demande est rejetée..."
                  rows="3"
                  maxLength="500"
                />
                <small>{rejectMessage.length}/500 caractères</small>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={() => rejectRequest(selectedRequest, rejectMessage)}
                className="btn btn-danger"
                disabled={processing === selectedRequest.id}
              >
                {processing === selectedRequest.id ? '⏳ Traitement...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de révocation */}
      {showRevokeModal && selectedStreamer && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Révoquer le rôle streamer</h3>
              <button 
                onClick={() => setShowRevokeModal(false)}
                className="modal-close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="warning-section">
                <AlertTriangle size={48} color="#f59e0b" />
                <h4>⚠️ Action irréversible</h4>
                <p>
                  Êtes-vous sûr de vouloir révoquer le rôle streamer de <strong>{selectedStreamer.user?.twitch_display_name}</strong> ?
                </p>
                <p className="warning-text">
                  Cette action va :
                </p>
                <ul className="warning-list">
                  <li>Supprimer sa configuration Pauvrathon</li>
                  <li>Désactiver toutes ses sessions en cours</li>
                  <li>Rendre sa page de participation inaccessible</li>
                  <li>Créer un log de révocation</li>
                </ul>
              </div>
              
              <div className="message-section">
                <label>Raison de la révocation :</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Expliquez pourquoi le rôle est révoqué (violation des règles, inactivité, etc.)..."
                  rows="3"
                  maxLength="500"
                  required
                />
                <small>{revokeReason.length}/500 caractères</small>
              </div>

              <div className="confirmation-section">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    id="confirmRevoke"
                    required
                  />
                  Je comprends que cette action est irréversible
                </label>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowRevokeModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  const checkbox = document.getElementById('confirmRevoke');
                  if (!checkbox.checked) {
                    alert('Veuillez confirmer que vous comprenez les conséquences');
                    return;
                  }
                  if (!revokeReason.trim()) {
                    alert('Veuillez indiquer une raison pour la révocation');
                    return;
                  }
                  revokeStreamerRole(selectedStreamer, revokeReason);
                }}
                className="btn btn-danger"
                disabled={processing === selectedStreamer.id}
              >
                {processing === selectedStreamer.id ? '⏳ Révocation...' : '🗑️ Confirmer la révocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamerRequestsPage;