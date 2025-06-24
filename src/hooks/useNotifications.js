// src/hooks/useNotifications.js

import { useState, useEffect, useCallback, useRef } from 'react';
import NotificationService from '../services/NotificationService';

export const useNotifications = (currentUser) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState(null);
  
  const subscriptionRef = useRef(null);
  const mountedRef = useRef(true);

  // Charger les notifications
  const loadNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      const result = await NotificationService.getAllNotifications(currentUser.id, 50);
      if (result.success && mountedRef.current) {
        setNotifications(result.notifications);
        console.log('✅ Hook: Notifications chargées:', result.notifications.length);
      }
    } catch (error) {
      console.error('❌ Hook: Erreur chargement notifications:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [currentUser?.id]);

  // Charger le nombre de notifications non lues
  const loadUnreadCount = useCallback(async () => {
    if (!currentUser?.id) return;
    
    try {
      const result = await NotificationService.getUnreadCount(currentUser.id);
      if (result.success && mountedRef.current) {
        setUnreadCount(result.count);
        console.log('📊 Hook: Non lues:', result.count);
      }
    } catch (error) {
      console.error('❌ Hook: Erreur comptage non lues:', error);
    }
  }, [currentUser?.id]);

  // Charger les préférences de notification
  const loadPreferences = useCallback(async () => {
    if (!currentUser?.id) return;
    
    try {
      const result = await NotificationService.getNotificationPreferences(currentUser.id);
      if (result.success && mountedRef.current) {
        setPreferences(result.preferences);
      }
    } catch (error) {
      console.error('❌ Hook: Erreur chargement préférences:', error);
    }
  }, [currentUser?.id]);

  // Marquer une notification comme lue
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const result = await NotificationService.markAsRead(notificationId);
      if (result.success && mountedRef.current) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        return true;
      }
    } catch (error) {
      console.error('❌ Hook: Erreur marquage lu:', error);
    }
    return false;
  }, []);

  // Marquer toutes les notifications comme lues
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.id) return false;
    
    try {
      const result = await NotificationService.markAllAsRead(currentUser.id);
      if (result.success && mountedRef.current) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
        return true;
      }
    } catch (error) {
      console.error('❌ Hook: Erreur marquage tout lu:', error);
    }
    return false;
  }, [currentUser?.id]);

  // Sauvegarder les préférences
  const savePreferences = useCallback(async (newPreferences) => {
    if (!currentUser?.id) return false;
    
    try {
      const result = await NotificationService.saveNotificationPreferences(
        currentUser.id, 
        newPreferences
      );
      if (result.success && mountedRef.current) {
        setPreferences(newPreferences);
        return true;
      }
    } catch (error) {
      console.error('❌ Hook: Erreur sauvegarde préférences:', error);
    }
    return false;
  }, [currentUser?.id]);

  // Suivre un streamer
  const followStreamer = useCallback(async (streamerId) => {
    if (!currentUser?.id) return false;
    
    try {
      const result = await NotificationService.followStreamer(currentUser.id, streamerId);
      return result.success;
    } catch (error) {
      console.error('❌ Hook: Erreur suivi streamer:', error);
      return false;
    }
  }, [currentUser?.id]);

  // Ne plus suivre un streamer
  const unfollowStreamer = useCallback(async (streamerId) => {
    if (!currentUser?.id) return false;
    
    try {
      const result = await NotificationService.unfollowStreamer(currentUser.id, streamerId);
      return result.success;
    } catch (error) {
      console.error('❌ Hook: Erreur désabonnement streamer:', error);
      return false;
    }
  }, [currentUser?.id]);

  // Vérifier si on suit un streamer
  const isFollowing = useCallback(async (streamerId) => {
    if (!currentUser?.id) return false;
    
    try {
      const result = await NotificationService.isFollowingStreamer(currentUser.id, streamerId);
      return result.success ? result.isFollowing : false;
    } catch (error) {
      console.error('❌ Hook: Erreur vérification suivi:', error);
      return false;
    }
  }, [currentUser?.id]);

  // Rafraîchir les données
  const refresh = useCallback(async () => {
    if (currentUser?.id) {
      await Promise.all([
        loadNotifications(),
        loadUnreadCount(),
        loadPreferences()
      ]);
    }
  }, [currentUser?.id, loadNotifications, loadUnreadCount, loadPreferences]);

  // Effet pour charger les données initiales
  useEffect(() => {
    if (currentUser?.id) {
      loadNotifications();
      loadUnreadCount();
      loadPreferences();
    }
  }, [currentUser?.id, loadNotifications, loadUnreadCount, loadPreferences]);

  // Effet pour s'abonner aux nouvelles notifications
  useEffect(() => {
    if (currentUser?.id) {
      console.log('📡 Hook: Connexion temps réel...');
      
      // Nettoyer l'ancien abonnement
      if (subscriptionRef.current) {
        NotificationService.unsubscribeFromNotifications(subscriptionRef.current);
      }

      // Créer le nouvel abonnement
      subscriptionRef.current = NotificationService.subscribeToNotifications(
        currentUser.id,
        (newNotification) => {
          console.log('🔔 Hook: Nouvelle notification:', newNotification);
          
          if (mountedRef.current) {
            setNotifications(prev => {
              // Éviter les doublons
              const exists = prev.some(n => n.id === newNotification.id);
              if (exists) return prev;
              
              return [newNotification, ...prev];
            });
            setUnreadCount(prev => prev + 1);
          }
        }
      );

      return () => {
        if (subscriptionRef.current) {
          NotificationService.unsubscribeFromNotifications(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      };
    }
  }, [currentUser?.id]);

  // Effet de nettoyage général
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (subscriptionRef.current) {
        NotificationService.unsubscribeFromNotifications(subscriptionRef.current);
      }
    };
  }, []);

  return {
    // État
    notifications,
    unreadCount,
    loading,
    preferences,
    
    // Actions
    actions: {
      loadNotifications,
      loadUnreadCount,
      markAsRead,
      markAllAsRead,
      savePreferences,
      followStreamer,
      unfollowStreamer,
      isFollowing,
      refresh
    }
  };
};