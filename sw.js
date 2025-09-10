self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('mozfix-v1').then(cache =>
      cache.addAll(['./', './index.html', './styles.css', './app.js', './rules.json', './manifest.webmanifest'])
    )
  );
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
