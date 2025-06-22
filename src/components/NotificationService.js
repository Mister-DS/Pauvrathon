// src/services/NotificationService.js
import { supabase } from '../lib/supabase';

class NotificationService {
  constructor() {
    this.supabase = supabase;
  }

  // Envoyer notification de début de Pauvrathon
  async notifyPauvrathonStart(streamerId, streamerName) {
    try {
      console.log(`🔔 Envoi notifications Pauvrathon démarré: ${streamerName}`);

      // 1. Récupérer les followers qui veulent être notifiés
      const { data: followers, error } = await this.supabase
        .from('notification_preferences')
        .select(`
          user_id,
          preferences,
          user:users!notification_preferences_user_id_fkey(
            twitch_display_name,
            email
          )
        `)
        .eq('preferences->pauvrathon_start', true);

      if (error) throw error;

      // 2. Créer les notifications en BDD
      const notifications = followers.map(follower => ({
        user_id: follower.user_id,
        type: 'pauvrathon_start',
        title: '🎮 Pauvrathon démarré !',
        message: `${streamerName} a lancé son Pauvrathon ! Cliquez pour participer.`,
        data: {
          streamer_id: streamerId,
          streamer_name: streamerName,
          action_url: `/participate/${streamerId}`
        },
        is_read: false,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        const { error: insertError } = await this.supabase
          .from('notifications')
          .insert(notifications);

        if (insertError) throw insertError;
      }

      // 3. Envoyer notifications navigateur
      await this.sendBrowserNotifications(followers, {
        title: '🎮 Pauvrathon démarré !',
        body: `${streamerName} a lancé son Pauvrathon !`,
        icon: '/logo192.png',
        tag: `pauvrathon-${streamerId}`,
        data: { url: `/participate/${streamerId}` }
      });

      console.log(`✅ ${notifications.length} notifications envoyées`);
      return { success: true, count: notifications.length };

    } catch (error) {
      console.error('Erreur envoi notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Envoyer notification de fin de Pauvrathon
  async notifyPauvrathonEnd(streamerId, streamerName, finalTime) {
    try {
      const { data: followers } = await this.supabase
        .from('notification_preferences')
        .select('user_id, preferences')
        .eq('preferences->pauvrathon_end', true);

      const notifications = followers.map(follower => ({
        user_id: follower.user_id,
        type: 'pauvrathon_end',
        title: '⏰ Pauvrathon terminé',
        message: `Le Pauvrathon de ${streamerName} s'est terminé après ${this.formatTime(finalTime)} !`,
        data: {
          streamer_id: streamerId,
          streamer_name: streamerName,
          final_time: finalTime
        },
        is_read: false,
        created_at: new Date().toISOString()
      }));

      if (notifications.length > 0) {
        await this.supabase.from('notifications').insert(notifications);
      }

      await this.sendBrowserNotifications(followers, {
        title: '⏰ Pauvrathon terminé',
        body: `${streamerName} a terminé après ${this.formatTime(finalTime)} !`,
        icon: '/logo192.png'
      });

      return { success: true, count: notifications.length };
    } catch (error) {
      console.error('Erreur notification fin:', error);
      return { success: false, error: error.message };
    }
  }

  // Envoyer notifications navigateur
  async sendBrowserNotifications(users, notificationData) {
    if ('Notification' in window && Notification.permission === 'granted') {
      users.forEach(user => {
        if (user.preferences?.browser_notifications) {
          const notification = new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            tag: notificationData.tag,
            data: notificationData.data
          });

          // Gérer le clic sur la notification
          notification.onclick = function(event) {
            event.preventDefault();
            if (notificationData.data?.url) {
              window.open(notificationData.data.url, '_blank');
            }
            notification.close();
          };
        }
      });
    }
  }

  // Marquer notification comme lue
  async markAsRead(notificationId) {
    try {
      const { error } = await this.supabase
        .rpc('mark_notification_read', { p_notification_id: notificationId });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erreur marquage lu:', error);
      return { success: false, error: error.message };
    }
  }

  // Marquer toutes les notifications comme lues
  async markAllAsRead(userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('mark_all_notifications_read', { p_user_id: userId });

      if (error) throw error;
      return { success: true, count: data.updated_count };
    } catch (error) {
      console.error('Erreur marquage tout lu:', error);
      return { success: false, error: error.message };
    }
  }

  // Récupérer notifications non lues
  async getUnreadNotifications(userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_unread_notifications', { p_user_id: userId });

      if (error) throw error;
      return { success: true, notifications: data || [] };
    } catch (error) {
      console.error('Erreur récupération notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Récupérer toutes les notifications (lues et non lues)
  async getAllNotifications(userId, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, notifications: data || [] };
    } catch (error) {
      console.error('Erreur récupération toutes notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Suivre un streamer
  async followStreamer(userId, streamerId) {
    try {
      const { data, error } = await this.supabase
        .rpc('follow_streamer', {
          p_user_id: userId,
          p_streamer_id: streamerId
        });

      if (error) throw error;
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Erreur suivi streamer:', error);
      return { success: false, error: error.message };
    }
  }

  // Ne plus suivre un streamer
  async unfollowStreamer(userId, streamerId) {
    try {
      const { data, error } = await this.supabase
        .rpc('unfollow_streamer', {
          p_user_id: userId,
          p_streamer_id: streamerId
        });

      if (error) throw error;
      return { success: true, message: data.message };
    } catch (error) {
      console.error('Erreur désabonnement streamer:', error);
      return { success: false, error: error.message };
    }
  }

  // Vérifier si un utilisateur suit un streamer
  async isFollowingStreamer(userId, streamerId) {
    try {
      const { data, error } = await this.supabase
        .from('streamer_followers')
        .select('id')
        .eq('user_id', userId)
        .eq('streamer_id', streamerId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { success: true, isFollowing: !!data };
    } catch (error) {
      console.error('Erreur vérification suivi:', error);
      return { success: false, error: error.message };
    }
  }

  // Récupérer les streamers suivis
  async getFollowedStreamers(userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_followed_streamers', { p_user_id: userId });

      if (error) throw error;
      return { success: true, streamers: data || [] };
    } catch (error) {
      console.error('Erreur récupération streamers suivis:', error);
      return { success: false, error: error.message };
    }
  }

  // Récupérer les préférences de notification
  async getNotificationPreferences(userId) {
    try {
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      const defaultPreferences = {
        pauvrathon_start: true,
        pauvrathon_end: false,
        new_streamers: true,
        browser_notifications: true,
        email_notifications: false
      };

      return { 
        success: true, 
        preferences: data?.preferences || defaultPreferences 
      };
    } catch (error) {
      console.error('Erreur récupération préférences:', error);
      return { success: false, error: error.message };
    }
  }

  // Sauvegarder les préférences de notification
  async saveNotificationPreferences(userId, preferences) {
    try {
      const { error } = await this.supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          preferences: preferences,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erreur sauvegarde préférences:', error);
      return { success: false, error: error.message };
    }
  }

  // Envoyer notification personnalisée (admin)
  async sendCustomNotification(userId, title, message, type = 'custom', data = {}) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: type,
          title: title,
          message: message,
          data: data,
          is_read: false,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erreur envoi notification personnalisée:', error);
      return { success: false, error: error.message };
    }
  }

  // Écouter les nouvelles notifications en temps réel
  subscribeToNotifications(userId, callback) {
    const subscription = this.supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (callback) callback(payload.new);
          
          // Notification navigateur automatique
          if (payload.new.type === 'pauvrathon_start' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(payload.new.title, {
              body: payload.new.message,
              icon: '/logo192.png',
              tag: `notification-${payload.new.id}`
            });
          }
        }
      )
      .subscribe();

    return subscription;
  }

  // Nettoyer l'abonnement
  unsubscribeFromNotifications(subscription) {
    if (subscription) {
      this.supabase.removeChannel(subscription);
    }
  }

  // Demander permission navigateur
  async requestBrowserPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
    }
    return false;
  }

  // Utilitaire pour formater le temps
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Obtenir le nombre de notifications non lues
  async getUnreadCount(userId) {
    try {
      const { count, error } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return { success: true, count: count || 0 };
    } catch (error) {
      console.error('Erreur comptage non lues:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton
const notificationService = new NotificationService();
export default notificationService;
export { NotificationService };