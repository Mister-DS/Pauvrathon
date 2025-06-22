// src/components/FollowButton.js
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Heart, HeartOff } from 'lucide-react';
import notificationService from '../services/NotificationService';
import './FollowButton.css';

const FollowButton = ({ 
  streamerId, 
  streamerName, 
  user, 
  variant = 'default', // 'default', 'compact', 'heart'
  showNotificationIcon = true 
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (user && streamerId) {
      checkFollowStatus();
    }
  }, [user, streamerId]);

  // Vérifier si l'utilisateur suit déjà ce streamer
  const checkFollowStatus = async () => {
    try {
      setInitialLoading(true);
      const result = await notificationService.isFollowingStreamer(user.id, streamerId);
      
      if (result.success) {
        setIsFollowing(result.isFollowing);
      }
    } catch (error) {
      console.error('Erreur vérification suivi:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  // Basculer le suivi
  const toggleFollow = async () => {
    if (!user) {
      alert('Connectez-vous pour suivre ce streamer !');
      return;
    }

    setLoading(true);
    try {
      let result;
      
      if (isFollowing) {
        result = await notificationService.unfollowStreamer(user.id, streamerId);
        if (result.success) {
          setIsFollowing(false);
        }
      } else {
        result = await notificationService.followStreamer(user.id, streamerId);
        if (result.success) {
          setIsFollowing(true);
          
          // Demander permission notifications si pas encore fait
          if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              new Notification('🔔 Notifications activées !', {
                body: `Vous serez notifié des Pauvrathons de ${streamerName}`,
                icon: '/logo192.png'
              });
            }
          }
        }
      }

      if (!result.success) {
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur toggle suivi:', error);
      alert('Erreur lors de la modification du suivi');
    } finally {
      setLoading(false);
    }
  };

  // Rendu selon la variante
  const renderButton = () => {
    const baseClasses = `follow-button ${variant} ${isFollowing ? 'following' : 'not-following'}`;
    
    if (variant === 'heart') {
      return (
        <button 
          onClick={toggleFollow}
          disabled={loading || initialLoading}
          className={baseClasses}
          title={isFollowing ? `Ne plus suivre ${streamerName}` : `Suivre ${streamerName}`}
        >
          {loading ? (
            <div className="loading-heart">💙</div>
          ) : isFollowing ? (
            <Heart size={20} fill="currentColor" />
          ) : (
            <HeartOff size={20} />
          )}
        </button>
      );
    }

    if (variant === 'compact') {
      return (
        <button 
          onClick={toggleFollow}
          disabled={loading || initialLoading}
          className={baseClasses}
          title={isFollowing ? `Ne plus suivre ${streamerName}` : `Suivre ${streamerName}`}
        >
          {loading ? (
            '⏳'
          ) : isFollowing ? (
            <>
              {showNotificationIcon && <Bell size={16} />}
              Suivi
            </>
          ) : (
            <>
              {showNotificationIcon && <BellOff size={16} />}
              Suivre
            </>
          )}
        </button>
      );
    }

    // Variante par défaut
    return (
      <button 
        onClick={toggleFollow}
        disabled={loading || initialLoading}
        className={baseClasses}
      >
        {loading ? (
          <span className="loading-content">
            <div className="loading-spinner-small"></div>
            Chargement...
          </span>
        ) : isFollowing ? (
          <span className="follow-content">
            {showNotificationIcon && <Bell size={18} />}
            <span>Suivi</span>
            <span className="follow-status">Notifications ON</span>
          </span>
        ) : (
          <span className="follow-content">
            {showNotificationIcon && <BellOff size={18} />}
            <span>Suivre</span>
            <span className="follow-status">Recevoir les notifications</span>
          </span>
        )}
      </button>
    );
  };

  // Affichage de chargement initial
  if (initialLoading) {
    return (
      <button className={`follow-button ${variant} loading-initial`} disabled>
        <div className="loading-spinner-small"></div>
        {variant !== 'heart' && variant !== 'compact' && 'Chargement...'}
      </button>
    );
  }

  return renderButton();
};

export default FollowButton;