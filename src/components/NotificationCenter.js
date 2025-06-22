// src/components/NotificationCenter.js
import React, { useState, useEffect } from 'react';
import { Bell, X, Settings, CheckCircle, Clock, Users, Gamepad2 } from 'lucide-react';
import notificationService from '../services/NotificationService';
import './NotificationCenter.css';

const NotificationCenter = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (user) {
      loadNotifications();
      setupRealtimeSubscription();
      
      return () => {
        if (subscription) {
          notificationService.unsubscribeFromNotifications(subscription);
        }
      };
    }
  }, [user]);

  // Charger les notifications
  const loadNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [notifResult, countResult] = await Promise.all([
        notificationService.getAllNotifications(user.id, 20),
        notificationService.getUnreadCount(user.id)
      ]);
      
      if (notifResult.success) {
        setNotifications(notifResult.notifications);
      }
      
      if (countResult.success) {
        setUnreadCount(countResult.count);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Configuration temps réel
  const setupRealtimeSubscription = () => {
    if (!user) return;

    const sub = notificationService.subscribeToNotifications(user.id, (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    
    setSubscription(sub);
  };

  // Marquer une notification comme lue
  const markAsRead = async (notificationId) => {
    const result = await notificationService.markAsRead(notificationId);
    
    if (result.success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    const result = await notificationService.markAllAsRead(user.id);
    
    if (result.success) {
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    }
  };

  // Gérer le clic sur une notification
  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Redirection selon le type
    if (notification.data?.action_url) {
      window.location.href = notification.data.action_url;
    }
    
    setShowPanel(false);
  };

  // Icône selon le type de notification
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'pauvrathon_start':
        return <Gamepad2 size={16} className="notification-icon pauvrathon-start" />;
      case 'pauvrathon_end':
        return <Clock size={16} className="notification-icon pauvrathon-end" />;
      case 'new_streamer':
        return <Users size={16} className="notification-icon new-streamer" />;
      case 'system':
        return <Settings size={16} className="notification-icon system" />;
      default:
        return <Bell size={16} className="notification-icon default" />;
    }
  };

  // Formater le temps relatif
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}j`;
  };

  if (!user) return null;

  return (
    <div className="notification-center">
      <button 
        onClick={() => setShowPanel(!showPanel)}
        className="notification-trigger"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {showPanel && (
        <>
          <div className="notification-overlay" onClick={() => setShowPanel(false)} />
          <div className="notification-panel">
            <div className="notification-header">
              <h3>🔔 Notifications</h3>
              <div className="notification-header-actions">
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="mark-all-read-btn"
                    title="Tout marquer comme lu"
                  >
                    <CheckCircle size={16} />
                  </button>
                )}
                <button 
                  onClick={() => setShowPanel(false)}
                  className="close-panel-btn"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="notification-list">
              {loading ? (
                <div className="notification-loading">
                  <div className="loading-spinner"></div>
                  <p>Chargement des notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="no-notifications">
                  <Bell size={48} className="no-notif-icon" />
                  <h4>Aucune notification</h4>
                  <p>Vous serez notifié des nouveaux Pauvrathons ici !</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div 
                    key={notification.id}
                    className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                    data-type={notification.type}
                  >
                    <div className="notification-icon-container">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="notification-content">
                      <h4 className="notification-title">{notification.title}</h4>
                      <p className="notification-message">{notification.message}</p>
                      <span className="notification-time">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                    
                    {!notification.is_read && (
                      <div className="unread-indicator"></div>
                    )}
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="notification-footer">
                <button 
                  onClick={() => {
                    setShowPanel(false);
                    // Rediriger vers une page de notifications complète si vous en avez une
                    // window.location.href = '/notifications';
                  }}
                  className="view-all-btn"
                >
                  Voir toutes les notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;