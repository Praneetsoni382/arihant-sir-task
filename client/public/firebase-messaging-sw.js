// ============================================================
// FIREBASE CLOUD MESSAGING (FCM) SERVICE WORKER
// Path: client/public/firebase-messaging-sw.js
// Served from root scope: /firebase-messaging-sw.js
// ============================================================

/* eslint-disable no-undef */

// Load the Firebase app and messaging compat libraries for service worker execution
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0565045974",
  appId: "1:1088662376372:web:5f0e30f453df09c317ece1",
  apiKey: "AIzaSyBZqef1J1Whtrinp7B9GHu0HTZYTp0Qy_c",
  authDomain: "gen-lang-client-0565045974.firebaseapp.com",
  messagingSenderId: "1088662376372"
};

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    // Firebase background message handler
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw] Received background FCM message:', payload);

      const notificationTitle =
        payload.notification?.title || payload.data?.title || 'TaskFlow Notification';

      const notificationBody =
        payload.notification?.body || payload.data?.body || 'You have a new update in TaskFlow.';

      const targetUrl =
        payload.data?.url || (payload.fcmOptions && payload.fcmOptions.link) || '/';

      const notificationOptions = {
        body: notificationBody,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: payload.data?.tag || `taskflow-${Date.now()}`,
        data: {
          url: targetUrl,
          notificationId: payload.data?.notificationId,
          eventType: payload.data?.eventType,
          relatedTaskId: payload.data?.relatedTaskId,
        },
        requireInteraction: false,
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (err) {
  console.warn('[firebase-messaging-sw] Firebase SDK initialization notice:', err);
}

// Resilient native push event listener (ensures display even if compat layer encounters network delays)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const raw = event.data.json();
    const title =
      raw.notification?.title || raw.data?.title || 'TaskFlow Notification';
    const body =
      raw.notification?.body || raw.data?.body || 'You have a new organizational task notification.';
    const targetUrl =
      raw.data?.url || raw.fcmOptions?.link || '/';

    const options = {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: raw.data?.tag || `taskflow-${Date.now()}`,
      data: {
        url: targetUrl,
        ...raw.data,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // If not JSON or already handled by onBackgroundMessage
  }
});

// Handle notification click to navigate to the target application route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Validate internal navigation target URL to prevent untrusted redirects
  let targetUrl = event.notification.data?.url || '/';
  if (!targetUrl.startsWith('/') && !targetUrl.startsWith(self.location.origin)) {
    targetUrl = '/';
  }

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Focus existing open application tab if available
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            if ('navigate' in client && targetUrl !== '/') {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
