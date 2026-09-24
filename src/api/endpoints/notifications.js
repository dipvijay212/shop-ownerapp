// Alert Center + FCM device registration (O-24).

import { http } from '../httpClient';
import { getDeviceId } from '../session';

// Owner-side filters are 'all' | 'orders' | 'subscription'.
export const listNotifications = ({ filter = 'all', cursor, limit } = {}) =>
  http.get('/notifications', { params: { filter, cursor, limit } });

export const getUnreadCount = () => http.get('/notifications/unread-count');

export const markRead = (id) => http.post(`/notifications/${id}/read`, {});

export const markAllRead = () => http.post('/notifications/read-all', {});

export const deleteAll = () => http.delete('/notifications');

// --- Devices ----------------------------------------------------------------

export const registerDevice = async (fcmToken, platform) => {
  await getDeviceId();
  return http.post('/devices', { fcm_token: fcmToken, platform });
};

export const unregisterDevice = (fcmToken) =>
  http.delete('/devices', { data: { fcm_token: fcmToken } });
