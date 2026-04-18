importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB0--KuOylI-IOnYVJsvqU90rhrdwkwRhc",
  authDomain: "gen-lang-client-0751205135.firebaseapp.com",
  projectId: "gen-lang-client-0751205135",
  storageBucket: "gen-lang-client-0751205135.firebasestorage.app",
  messagingSenderId: "882174749930",
  appId: "1:882174749930:web:f4f6629a342a1947857b93"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://picsum.photos/192/192?random=icon'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
