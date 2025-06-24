// src/components/NotificationCenter.js

import React, { useState, useEffect, useRef } from 'react';
import NotificationService from '../services/NotificationService';

const NotificationCenter = ({ isOpen, onClose, currentUser }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef(null);

  // Charger les données quand le panneau s'ouvre
  useEffect(() => {
    if (isOpen && currentUser?.id) {
      console.log('📱 Chargement du NotificationCenter...');
      loadNotifications();
      loadUnreadCount();
    }
  }, [isOpen, currentUser]);

  // S'abonner aux mises à jour en temps réel
  useEffect(() => {
    if (currentUser?.id) {
      console.log('📡 Connexion temps réel...');
      
      // Nettoyer l'ancien abonnement
      if (subscriptionRef.current) {
        NotificationService.unsubscribeFromNotifications(subscriptionRef.current);
      }

      // Créer le nouvel abonnement
      subscriptionRef.current = NotificationService.subscribeToNotifications(
        currentUser.id,
        (newNotification) => {
          console.log('🔔 Notification reçue dans le panneau:', newNotification);
          
          // Ajouter la nouvelle notification en haut de la liste
          setNotifications(prev => {
            // Éviter les doublons
            const exists = prev.some(n => n.id === newNotification.id);
            if (exists) return prev;
            return [newNotification, ...prev];
          });
          
          // Mettre à jour le compteur
          setUnreadCount(prev => prev + 1);
        }
      );

      return () => {
        if (subscriptionRef.current) {
          NotificationService.unsubscribeFromNotifications(subscriptionRef.current);
        }
      };
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      const result = await NotificationService.getAllNotifications(currentUser.id, 50);
      if (result.success) {
        setNotifications(result.notifications);
        console.log('✅ Notifications chargées:', result.notifications.length);
      }
    } catch (error) {
      console.error('❌ Erreur chargement notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!currentUser?.id) return;
    
    try {
      const result = await NotificationService.getUnreadCount(currentUser.id);
      if (result.success) {
        setUnreadCount(result.count);
        console.log('📊 Non lues:', result.count);
      }
    } catch (error) {
      console.error('❌ Erreur comptage non lues:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const result = await NotificationService.markAsRead(notificationId);
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('❌ Erreur marquage lu:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser?.id) return;
    
    try {
      const result = await NotificationService.markAllAsRead(currentUser.id);
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ Erreur marquage tout lu:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    // Marquer comme lu si pas encore lu
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    // Gérer les actions spécifiques selon le type
    if (notification.data?.action_url) {
      window.location.href = notification.data.action_url;
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diff = now - notificationTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return notificationTime.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'pauvrathon_start': return '🎮';
      case 'pauvrathon_end': return '⏰';
      case 'new_streamer': return '👋';
      case 'custom': return '📢';
      default: return '🔔';
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '60px',
      right: '20px',
      width: '400px',
      maxHeight: '600px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      border: '1px solid #e5e7eb',
      zIndex: 1000,
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#111827',
          margin: 0
        }}>
          Notifications {unreadCount > 0 && `(${unreadCount})`}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => { loadNotifications(); loadUnreadCount(); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            title="Actualiser"
          >
            🔄
          </button>
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            >
              Tout marquer lu
            </button>
          )}
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>⏳</span>
            <p style={{ color: '#6b7280', fontSize: '16px', margin: 0 }}>Chargement...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🔔</span>
            <p style={{ color: '#6b7280', fontSize: '16px', margin: 0 }}>Aucune notification</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer',
                background: !notification.is_read ? 'linear-gradient(90deg, #dbeafe 0%, #f3f4f6 100%)' : 'white',
                borderLeft: !notification.is_read ? '4px solid #3b82f6' : 'none',
                position: 'relative'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.target.style.background = !notification.is_read ? 'linear-gradient(90deg, #dbeafe 0%, #f3f4f6 100%)' : 'white'}
            >
              {/* Point bleu pour les non lues */}
              {!notification.is_read && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  width: '8px',
                  height: '8px',
                  background: '#3b82f6',
                  borderRadius: '50%'
                }} />
              )}
              
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <h4 style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111827',
                  margin: 0,
                  flex: 1
                }}>
                  <span style={{ fontSize: '16px' }}>
                    {getNotificationIcon(notification.type)}
                  </span>
                  {notification.title}
                </h4>
                <span style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  whiteSpace: 'nowrap',
                  marginLeft: '8px'
                }}>
                  {formatTime(notification.created_at)}
                </span>
              </div>
              
              {/* Message */}
              <p style={{
                color: '#4b5563',
                fontSize: '13px',
                lineHeight: 1.4,
                margin: 0
              }}>
                {notification.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;