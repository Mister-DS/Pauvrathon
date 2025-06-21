import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Clock, Check, X, Eye, ExternalLink, User, Calendar, 
  Users, Filter, RefreshCw, MessageSquare, AlertCircle,
  CheckCircle, XCircle, Search, ArrowUp, ArrowDown
} from 'lucide-react';
import './StreamerRequestsPage.css';

const StreamerRequestsPage = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectMessage, setRejectMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    thisMonth: 0
  });

  useEffect(() => {
    if (user) {
      loadRequests();
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

    setStats({ pending, approved, rejected, thisMonth });
  };

  // Filtrer et trier les demandes
  const filterAndSortRequests = () => {
    let filtered = [...requests];

    // Filtrer par statut
    if (filter !== 'all') {
      filtered = filtered.filter(r => r.status === filter);
    }

    // Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.twitch_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.twitch_display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.motivation_message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Trier
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

  // ✅ FONCTION CORRIGÉE - Approuver une demande
  const approveRequest = async (request) => {
    try {
      setProcessing(request.id);
      console.log('🔄 Début approbation pour:', request.twitch_display_name);

      // 1. Mettre à jour le statut de la demande (SANS processed_by pour éviter l'erreur UUID)
      const { error: updateError } = await supabase
        .from('streamer_requests')
        .update({ 
          status: 'approved',
          processed_at: new Date().toISOString()
          // ❌ RETIRÉ: processed_by: user.id (causait l'erreur UUID)
        })
        .eq('id', request.id);

      if (updateError) throw updateError;
      console.log('✅ Statut mis à jour');

      // 2. Créer l'utilisateur s'il n'existe pas
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('twitch_user_id', request.twitch_user_id)
        .single();

      if (userError && userError.code === 'PGRST116') {
        console.log('👤 Création nouvel utilisateur...');
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
        console.log('✅ Utilisateur créé:', userData.id);
      } else if (userError) {
        throw userError;
      } else {
        console.log('👤 Utilisateur existant trouvé:', userData.id);
      }

      // 3. Vérifier si une config streamer existe déjà
      const { data: existingStreamer, error: checkStreamerError } = await supabase
        .from('streamers')
        .select('id')
        .eq('user_id', userData.id)
        .single();

      if (checkStreamerError && checkStreamerError.code !== 'PGRST116') {
        throw checkStreamerError;
      }

      // 4. Créer la configuration streamer seulement si elle n'existe pas
      if (!existingStreamer) {
        console.log('🎬 Création configuration streamer...');
        const { error: streamerError } = await supabase
          .from('streamers')
          .insert([{
            user_id: userData.id,
            is_live: false,
            subathon_active: false,
            current_timer: 0,
            timer_max: 28800, // 8 heures
            timer_min: 300,   // 5 minutes
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
            theme_color: '#9146ff',
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
        console.log('✅ Configuration streamer créée');
      } else {
        console.log('🎬 Configuration streamer existante trouvée');
      }

      // 5. Recharger les demandes
      await loadRequests();
      console.log('🎉 Approbation terminée avec succès !');
      
    } catch (err) {
      console.error('❌ Erreur approbation:', err);
      alert(`Erreur lors de l'approbation: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // ✅ FONCTION CORRIGÉE - Rejeter une demande
  const rejectRequest = async (request, message = '') => {
    try {
      setProcessing(request.id);
      console.log('🔄 Début rejet pour:', request.twitch_display_name);

      const { error } = await supabase
        .from('streamer_requests')
        .update({ 
          status: 'rejected',
          processed_at: new Date().toISOString(),
          rejection_reason: message
          // ❌ RETIRÉ: processed_by: user.id (causait l'erreur UUID)
        })
        .eq('id', request.id);

      if (error) throw error;

      // Recharger les demandes
      await loadRequests();
      setShowRejectModal(false);
      setRejectMessage('');
      setSelectedRequest(null);
      
      console.log('✅ Demande rejetée avec succès');
      
    } catch (err) {
      console.error('❌ Erreur rejet:', err);
      alert(`Erreur lors du rejet: ${err.message}`);
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

  // Formater les dates
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

  // Formater les nombres
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  // Calculer l'âge du compte
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
          <p>Chargement des demandes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-page">
      {/* En-tête */}
      <div className="requests-header">
        <h1>📋 Demandes de Streamers</h1>
        <button onClick={loadRequests} className="btn btn-primary">
          <RefreshCw size={16} /> Actualiser
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
        
        <div className="stat-card month">
          <div className="stat-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.thisMonth}</span>
            <span className="stat-label">Ce mois</span>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
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
                  <span>
                    {request.status === 'pending' ? 'En attente' :
                     request.status === 'approved' ? 'Approuvé' : 'Rejeté'}
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

              {request.status === 'rejected' && request.rejection_reason && (
                <div className="rejection-reason">
                  <AlertCircle size={16} />
                  <p><strong>Raison du rejet:</strong> {request.rejection_reason}</p>
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
              
              <div className="reject-message-section">
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
    </div>
  );
};

export default StreamerRequestsPage;