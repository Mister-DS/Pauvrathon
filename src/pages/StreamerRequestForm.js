import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  User, Mail, MessageSquare, Send, AlertCircle, 
  CheckCircle, Clock, Twitch, Users, Eye,
  ArrowLeft, Info
} from 'lucide-react';
import './StreamerRequestForm.css';

const StreamerRequestForm = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    motivation_message: '',
    email: user?.email || ''
  });
  const [twitchData, setTwitchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingRequest, setExistingRequest] = useState(null);

  useEffect(() => {
    if (user) {
      fetchTwitchData();
      checkExistingRequest();
    }
  }, [user]);

  // Vérifier s'il y a déjà une demande en cours
  const checkExistingRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('streamer_requests')
        .select('*')
        .eq('twitch_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const request = data[0];
        // Si la demande est en attente ou approuvée, on l'affiche
        if (request.status === 'pending' || request.status === 'approved') {
          setExistingRequest(request);
        }
      }
    } catch (err) {
      console.error('Erreur vérification demande:', err);
    }
  };

  // Récupérer les données détaillées de Twitch
  const fetchTwitchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('twitch_access_token');
      
      if (!token) {
        setError('Token Twitch manquant');
        return;
      }

      // Récupérer les infos du channel
      const channelResponse = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      // Récupérer le nombre de followers
      const followersResponse = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': process.env.REACT_APP_TWITCH_CLIENT_ID
        }
      });

      let channelData = null;
      let followersData = null;

      if (channelResponse.ok) {
        const channelResult = await channelResponse.json();
        channelData = channelResult.data[0];
      }

      if (followersResponse.ok) {
        const followersResult = await followersResponse.json();
        followersData = followersResult;
      }

      setTwitchData({
        ...user,
        game_name: channelData?.game_name || 'Non défini',
        followers_count: followersData?.total || 0,
        created_at: user.created_at
      });

    } catch (err) {
      console.error('Erreur récupération données Twitch:', err);
      setError('Impossible de récupérer vos données Twitch');
    } finally {
      setLoading(false);
    }
  };

  // Gérer les changements du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Soumettre la demande
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.motivation_message.trim()) {
      setError('Veuillez expliquer votre motivation');
      return;
    }

    if (formData.motivation_message.length < 50) {
      setError('Votre motivation doit contenir au moins 50 caractères');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const { error } = await supabase
        .from('streamer_requests')
        .insert([{
          twitch_user_id: user.id,
          twitch_username: user.login,
          twitch_display_name: user.display_name,
          profile_image_url: user.profile_image_url,
          email: formData.email,
          motivation_message: formData.motivation_message.trim(),
          followers_count: twitchData?.followers_count || 0,
          game_name: twitchData?.game_name,
          account_created_at: user.created_at,
          status: 'pending'
        }]);

      if (error) throw error;

      setSuccess(true);
      
      // Rediriger après 3 secondes
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (err) {
      console.error('Erreur soumission demande:', err);
      setError('Erreur lors de la soumission : ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Formater la date de création du compte
  const formatAccountAge = (createdAt) => {
    if (!createdAt) return 'Inconnue';
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} jours`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mois`;
    return `${Math.floor(diffDays / 365)} ans`;
  };

  // Formater le nombre de followers
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  if (!user) {
    return (
      <div className="request-form-page">
        <div className="auth-required">
          <AlertCircle size={48} />
          <h2>Connexion requise</h2>
          <p>Vous devez être connecté avec Twitch pour faire une demande de statut streamer.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="request-form-page">
        <div className="success-message">
          <CheckCircle size={64} />
          <h2>Demande envoyée avec succès !</h2>
          <p>Votre demande de statut streamer a été soumise et sera examinée par notre équipe.</p>
          <p>Vous recevrez une réponse par email.</p>
          <div className="success-actions">
            <button onClick={() => navigate('/')} className="btn btn-primary">
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (existingRequest) {
    return (
      <div className="request-form-page">
        <div className="existing-request">
          <div className="request-status">
            {existingRequest.status === 'pending' && (
              <>
                <Clock size={48} />
                <h2>Demande en cours</h2>
                <p>Votre demande de statut streamer est en cours d'examen.</p>
              </>
            )}
            {existingRequest.status === 'approved' && (
              <>
                <CheckCircle size={48} />
                <h2>Demande approuvée</h2>
                <p>Félicitations ! Votre demande a été approuvée.</p>
              </>
            )}
          </div>
          
          <div className="request-details">
            <h3>Détails de votre demande</h3>
            <div className="detail-item">
              <strong>Soumise le :</strong> {new Date(existingRequest.created_at).toLocaleDateString('fr-FR')}
            </div>
            <div className="detail-item">
              <strong>Statut :</strong> 
              <span className={`status ${existingRequest.status}`}>
                {existingRequest.status === 'pending' ? 'En attente' : 'Approuvée'}
              </span>
            </div>
            {existingRequest.processed_at && (
              <div className="detail-item">
                <strong>Traitée le :</strong> {new Date(existingRequest.processed_at).toLocaleDateString('fr-FR')}
              </div>
            )}
          </div>

          <button onClick={() => navigate('/')} className="btn btn-primary">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="request-form-page">
      <div className="form-container">
        {/* En-tête */}
        <div className="form-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <h1>🎬 Demande de statut Streamer</h1>
          <p>Rejoignez la communauté des streamers Pauvrathon !</p>
        </div>

        {/* Informations importantes */}
        <div className="info-section">
          <div className="info-card">
            <Info size={20} />
            <div>
              <h3>Conditions requises</h3>
              <ul>
                <li>Compte Twitch actif et en règle</li>
                <li>Diffusion régulière de contenu</li>
                <li>Respect de la communauté Pauvrathon</li>
                <li>Motivation claire et détaillée</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Profil Twitch */}
        {loading ? (
          <div className="loading-profile">
            <div className="spinner"></div>
            <p>Chargement de votre profil Twitch...</p>
          </div>
        ) : twitchData && (
          <div className="twitch-profile">
            <h3>Votre profil Twitch</h3>
            <div className="profile-content">
              <img 
                src={twitchData.profile_image_url} 
                alt={twitchData.display_name}
                className="profile-avatar"
              />
              <div className="profile-info">
                <h4>{twitchData.display_name}</h4>
                <p>@{twitchData.login}</p>
                <div className="profile-stats">
                  <div className="stat">
                    <Users size={16} />
                    <span>{formatNumber(twitchData.followers_count)} followers</span>
                  </div>
                  <div className="stat">
                    <User size={16} />
                    <span>Compte créé: {formatAccountAge(twitchData.created_at)}</span>
                  </div>
                  {twitchData.game_name && (
                    <div className="stat">
                      <Eye size={16} />
                      <span>{twitchData.game_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="request-form">
          <div className="form-group">
            <label htmlFor="email">
              <Mail size={20} />
              Email de contact
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="votre@email.com"
              required
            />
            <small>Nous vous contacterons à cette adresse</small>
          </div>

          <div className="form-group">
            <label htmlFor="motivation_message">
              <MessageSquare size={20} />
              Motivation *
            </label>
            <textarea
              id="motivation_message"
              name="motivation_message"
              value={formData.motivation_message}
              onChange={handleInputChange}
              placeholder="Expliquez pourquoi vous souhaitez rejoindre Pauvrathon en tant que streamer. Parlez de votre contenu, vos objectifs, et ce que vous apporteriez à la communauté..."
              rows="6"
              maxLength="1000"
              required
            />
            <div className="char-count">
              <span className={formData.motivation_message.length < 50 ? 'insufficient' : 'sufficient'}>
                {formData.motivation_message.length}/1000 caractères
              </span>
              {formData.motivation_message.length > 0 && formData.motivation_message.length < 50 && (
                <span className="min-required">Minimum 50 caractères requis</span>
              )}
            </div>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-actions">
            <button 
              type="button" 
              onClick={() => navigate('/')}
              className="btn btn-secondary"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting || formData.motivation_message.length < 50}
            >
              {submitting ? (
                <>
                  <div className="spinner"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Envoyer la demande
                </>
              )}
            </button>
          </div>
        </form>

        {/* Note finale */}
        <div className="final-note">
          <p>
            <strong>Note :</strong> Une fois votre demande soumise, vous recevrez une réponse 
            sous 2-5 jours ouvrables. En cas d'approbation, vous aurez accès à votre 
            panneau de gestion Pauvrathon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StreamerRequestForm;