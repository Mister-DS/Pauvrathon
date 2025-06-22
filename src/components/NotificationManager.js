// src/components/NotificationManager.js
import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings, X, Check, Gamepad2, Users, Mail, Monitor } from 'lucide-react';
import notificationService from '../services/NotificationService';
import './NotificationManager.css';

const NotificationManager = ({ user }) => {
  const [preferences, setPreferences] = useState({
    pauvrathon_start: true,
    pauvrathon_end: false,
    new_streamers: true,
    browser_notifications: true,
    email_notifications: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [browserPermission, setBrowserPermission] = useState('default');

  useEffect(() => {
    if (user) {
      loadNotificationPreferences();
      checkBrowserPermission();
    }
  }, [user]);

  // Charger les préférences de notification
  const loadNotificationPreferences = async () => {
    try {
      setLoading(true);
      const result = await notificationService.getNotificationPreferences(user.id);
      
      if (result.success) {
        setPreferences(result.preferences);
      }
    } catch (err) {
      console.error('Erreur chargement préférences:', err);
    } finally {
      setLoading(false);
    }
  };

  // Vérifier la permission du navigateur
  const checkBrowserPermission = () => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  };

  // Sauvegarder les préférences
  const savePreferences = async () => {
    try {
      setSaving(true);
      
      const result = await notificationService.saveNotificationPreferences(user.id, preferences);
      
      if (result.success) {
        setShowSettings(false);
        // Optionnel : afficher un message de succès
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('Erreur sauvegarde préférences:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Demander permission navigateur
  const requestBrowserPermission = async () => {
    const granted = await notificationService.requestBrowserPermission();
    setBrowserPermission(granted ? 'granted' : 'denied');
    
    if (granted) {
      setPreferences(prev => ({ ...prev, browser_notifications: true }));
    }
  };

  // Mettre à jour une préférence
  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  // Tester les notifications
  const testNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🧪 Test de notification', {
        body: 'Vos notifications fonctionnent parfaitement !',
        icon: '/logo192.png',
        tag: 'test-notification'
      });
    } else {
      alert('Les notifications navigateur ne sont pas activées');
    }
  };

  if (!user) return null;

  return (
    <div className="notification-manager">
      <button 
        onClick={() => setShowSettings(true)}
        className="notification-settings-btn"
        title="Paramètres de notifications"
      >
        {preferences.browser_notifications && browserPermission === 'granted' ? (
          <Bell size={20} />
        ) : (
          <BellOff size={20} />
        )}
      </button>

      {showSettings && (
        <>
          <div className="settings-overlay" onClick={() => setShowSettings(false)} />
          <div className="notification-settings-modal">
            <div className="settings-header">
              <h3>🔔 Paramètres de notifications</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="close-settings-btn"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="settings-content">
              {loading ? (
                <div className="settings-loading">
                  <div className="loading-spinner"></div>
                  <p>Chargement des préférences...</p>
                </div>
              ) : (
                <>
                  {/* Section Pauvrathon */}
                  <div className="setting-section">
                    <h4><Gamepad2 size={16} /> Notifications de Pauvrathon</h4>
                    <div className="setting-items">
                      <label className="setting-item">
                        <input
                          type="checkbox"
                          checked={preferences.pauvrathon_start}
                          onChange={(e) => updatePreference('pauvrathon_start', e.target.checked)}
                        />
                        <div className="setting-info">
                          <span className="setting-title">Début de Pauvrathon</span>
                          <span className="setting-desc">Soyez notifié quand vos streamers préférés lancent leur Pauvrathon</span>
                        </div>
                      </label>
                      
                      <label className="setting-item">
                        <input
                          type="checkbox"
                          checked={preferences.pauvrathon_end}
                          onChange={(e) => updatePreference('pauvrathon_end', e.target.checked)}
                        />
                        <div className="setting-info">
                          <span className="setting-title">Fin de Pauvrathon</span>
                          <span className="setting-desc">Recevez un résumé quand un Pauvrathon se termine</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section Communauté */}
                  <div className="setting-section">
                    <h4><Users size={16} /> Communauté</h4>
                    <div className="setting-items">
                      <label className="setting-item">
                        <input
                          type="checkbox"
                          checked={preferences.new_streamers}
                          onChange={(e) => updatePreference('new_streamers', e.target.checked)}
                        />
                        <div className="setting-info">
                          <span className="setting-title">Nouveaux streamers</span>
                          <span className="setting-desc">Découvrez les nouveaux streamers qui rejoignent la plateforme</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Section Méthodes de notification */}
                  <div className="setting-section">
                    <h4><Monitor size={16} /> Méthodes de notification</h4>
                    <div className="setting-items">
                      <div className="setting-item browser-setting">
                        <div className="browser-permission-row">
                          <input
                            type="checkbox"
                            checked={preferences.browser_notifications && browserPermission === 'granted'}
                            onChange={(e) => {
                              if (e.target.checked && browserPermission !== 'granted') {
                                requestBrowserPermission();
                              } else {
                                updatePreference('browser_notifications', e.target.checked);
                              }
                            }}
                            disabled={browserPermission === 'denied'}
                          />
                          <div className="setting-info">
                            <span className="setting-title">Notifications navigateur</span>
                            <span className="setting-desc">
                              {browserPermission === 'granted' 
                                ? 'Recevez des notifications même quand l\'onglet est fermé'
                                : browserPermission === 'denied'
                                ? 'Permission refusée - veuillez l\'activer dans les paramètres du navigateur'
                                : 'Cliquez pour autoriser les notifications navigateur'
                              }
                            </span>
                          </div>
                        </div>
                        
                        {browserPermission === 'granted' && preferences.browser_notifications && (
                          <button 
                            onClick={testNotification}
                            className="test-notification-btn"
                          >
                            🧪 Tester
                          </button>
                        )}
                      </div>
                      
                      <label className="setting-item">
                        <input
                          type="checkbox"
                          checked={preferences.email_notifications}
                          onChange={(e) => updatePreference('email_notifications', e.target.checked)}
                        />
                        <div className="setting-info">
                          <span className="setting-title">Notifications email</span>
                          <span className="setting-desc">Recevez un résumé quotidien par email (bientôt disponible)</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Informations supplémentaires */}
                  <div className="settings-info">
                    <h5>💡 Comment ça marche ?</h5>
                    <ul>
                      <li>Suivez vos streamers préférés pour être notifié de leurs Pauvrathons</li>
                      <li>Les notifications apparaissent en temps réel</li>
                      <li>Vous pouvez cliquer sur une notification pour rejoindre directement</li>
                      <li>Gérez vos préférences à tout moment</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
            
            <div className="settings-actions">
              <button 
                onClick={() => setShowSettings(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button 
                onClick={savePreferences}
                className="btn btn-primary"
                disabled={saving || loading}
              >
                {saving ? (
                  <>⏳ Sauvegarde...</>
                ) : (
                  <><Check size={16} /> Sauvegarder</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationManager;