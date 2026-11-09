/**
 * Admin alerts: notification sound and browser (desktop) notifications.
 */
import notificationSound from '../assets/notification.mp3';

let audio = null;

/** Play the new-order chime. Browsers may block it until the page was clicked once. */
export const playNotificationSound = () => {
  try {
    if (!audio) {
      audio = new Audio(notificationSound);
      audio.volume = 0.9;
    }
    audio.currentTime = 0;
    const playing = audio.play();
    if (playing && playing.catch) playing.catch(() => {});
  } catch {
    /* audio not supported */
  }
};

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermission = () => (notificationsSupported() ? Notification.permission : 'unsupported');

/** Ask for desktop notification permission (only asks when not decided yet). */
export const requestNotificationPermission = async () => {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

/**
 * Show a desktop notification when the admin tab is in the background
 * (when it is visible the in-app toast is enough).
 */
export const showBrowserNotification = (title, body, onClick) => {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    const notification = new Notification(title, { body, icon: '/favicon.png', tag: title });
    notification.onclick = () => {
      window.focus();
      if (onClick) onClick();
      notification.close();
    };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
};
