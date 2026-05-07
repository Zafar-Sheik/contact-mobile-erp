// Basic service worker that does nothing
// This prevents 404 errors when browsers try to load /sw.js

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle fetch events (pass through to network)
self.addEventListener('fetch', (event) => {
  // Let the browser handle all requests normally
  return;
});