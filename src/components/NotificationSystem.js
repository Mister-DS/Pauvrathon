import React, { useState, useEffect } from 'react';
import './NotificationSystem.css';

const NotificationSystem = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        onClose();
      }, notification.duration || 4000);
      
      return () => clearTimeout(timer);
    }
  }, [notification.show, onClose, notification.duration]);

  if (!notification.show) return null;

  const getNotificationConfig = () => {
    switch (notification.type) {
      case 'victory':
        return {
          bgColor: 'notification-victory',
          icon: '🏆',
          title: 'Félicitations !',
          animation: 'notification-bounce'
        };
      case 'error':
        return {
          bgColor: 'notification-error',
          icon: '❌',
          title: 'Erreur',
          animation: 'notification-shake'
        };
      case 'warning':
        return {
          bgColor: 'notification-warning',
          icon: '⚠️',
          title: 'Attention',
          animation: 'notification-pulse'
        };
      case 'info':
        return {
          bgColor: 'notification-info',
          icon: 'ℹ️',
          title: 'Information',
          animation: 'notification-slide'
        };
      case 'success':
        return {
          bgColor: 'notification-success',
          icon: '✅',
          title: 'Succès',
          animation: 'notification-zoom'
        };
      default:
        return {
          bgColor: 'notification-default',
          icon: '🎮',
          title: 'Message',
          animation: 'notification-fade'
        };
    }
  };

  const config = getNotificationConfig();

  return (
    <div className="notification-overlay">
      <div className={`notification ${config.bgColor} ${config.animation}`}>
        <button
          className="notification-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          ×
        </button>
        
        <div className="notification-content">
          <div className="notification-icon">
            {config.icon}
          </div>
          <div className="notification-text">
            <h3 className="notification-title">{config.title}</h3>
            <p className="notification-message">{notification.message}</p>
            {notification.subMessage && (
              <p className="notification-sub">{notification.subMessage}</p>
            )}
          </div>
        </div>
        
        <div className="notification-sparkles">
          <div className="sparkle sparkle-1"></div>
          <div className="sparkle sparkle-2"></div>
          <div className="sparkle sparkle-3"></div>
          <div className="sparkle sparkle-4"></div>
        </div>
      </div>
    </div>
  );
};

// Hook pour gérer les notifications
export const useNotifications = () => {
  const [notification, setNotification] = useState({
    show: false,
    type: 'info',
    message: '',
    subMessage: '',
    duration: 4000
  });

  const showNotification = (type, message, subMessage = '', duration = 4000) => {
    setNotification({
      show: true,
      type,
      message,
      subMessage,
      duration
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({
      ...prev,
      show: false
    }));
  };

  // Fonctions spécifiques pour remplacer les alerts
  const showError = (message, subMessage = '') => {
    showNotification('error', message, subMessage);
  };

  const showWarning = (message, subMessage = '') => {
    showNotification('warning', message, subMessage);
  };

  const showSuccess = (message, subMessage = '') => {
    showNotification('success', message, subMessage);
  };

  const showVictory = (message, subMessage = '') => {
    showNotification('victory', message, subMessage);
  };

  const showInfo = (message, subMessage = '') => {
    showNotification('info', message, subMessage);
  };

  return {
    notification,
    showNotification,
    hideNotification,
    showError,
    showWarning,
    showSuccess,
    showVictory,
    showInfo
  };
};

export default NotificationSystem;