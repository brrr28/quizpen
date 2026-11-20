/* Quizpen service worker: keeps the landing and ready examples working on a weak or dropped
   connection after the first visit.
   - Shell files are precached on install (one versioned cache; old ones are deleted on activate).
   - Navigations: network first with a 3 s timeout, then the cached page (index.html as a last resort).
   - Other same-origin static GETs: stale-while-revalidate.
   - Never touched: cross-origin requests (Apps Script API, PostHog, Clarity, Google Fonts), non-GET,
     the same-origin dev API proxy (/api, no file extension) and the Search Console verification file.
   Bump VERSION when the shell list changes; content updates arrive through revalidation anyway. */
'use strict';

// Bump on every deploy so returning visitors get a fresh, consistent shell.
var VERSION = '2026-11-20c';
var CACHE = 'qp-shell-' + VERSION;
var NAV_TIMEOUT_MS = 3000;
var SHELL = [
  'index.html', 'styles.css', 'demo-modes.css', 'nav.css', 'consent.css',
  'config.js', 'analytics.js', 'nav.js', 'app.js', 'ui.js', 'favicon.svg',
  'data/samples.json', 'vendor/qrcode.js',
  'play/index.html', 'play/play.css', 'play/play.js', 'play/theme.js', 'play/codec.js', 'play/share.css', 'play/share.js'
];
// Only files with these extensions are served from the cache (keeps API-like paths out).
var STATIC_RE = /\.(?:html|css|js|json|svg|png|ico|webmanifest|woff2?)$/i;
var NEVER_RE = /\/googlecc0c4bdfc53fdacd\.html$/;

function scopeUrl(path) { return new URL(path, self.registration.scope).href; }
// Cache key of a page: no query or hash; a folder maps to its index.html.
function pageKey(url) {
  var u = new URL(url);
  return u.origin + u.pathname + (u.pathname.slice(-1) === '/' ? 'index.html' : '');
}
function cacheable(res) { return res && res.ok && res.type === 'basic'; }

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    // cache: 'reload' skips the HTTP cache, so the shell is the deployed version.
    return cache.addAll(SHELL.map(function (p) { return new Request(scopeUrl(p), { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('qp-shell-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromNetworkFirst(event, req) {
  var key = pageKey(req.url);
  var fallback = function () {
    return caches.match(key).then(function (hit) { return hit || caches.match(scopeUrl('index.html')); });
  };
  var net = fetch(req);
  // Registered now, while the event is alive: a page that arrives after the timeout still refreshes the cache.
  // This callback runs before the page gets the response, so the clone is taken from an unread body.
  event.waitUntil(net.then(function (res) {
    if (cacheable(res)) { var copy = res.clone(); return caches.open(CACHE).then(function (c) { return c.put(key, copy); }); }
  }).catch(function () { /* offline or quota */ }));
  return new Promise(function (resolve) {
    var settled = false;
    var finish = function (res) { if (!settled) { settled = true; resolve(res); } };
    // Slow network: show the cached page after the timeout, keep waiting if nothing is cached.
    var timer = setTimeout(function () { fallback().then(function (hit) { if (hit) finish(hit); }); }, NAV_TIMEOUT_MS);
    net.then(function (res) {
      clearTimeout(timer);
      finish(res);
    }, function () {
      clearTimeout(timer);
      fallback().then(function (hit) { finish(hit || Response.error()); });
    });
  });
}

function fromCacheThenRevalidate(event, req) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var net = fetch(req);
      // The refresh runs in the background; the clone is taken before the page reads the body.
      event.waitUntil(net.then(function (res) {
        if (cacheable(res)) return cache.put(req, res.clone());
      }).catch(function () { /* offline: the cached copy stays */ }));
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_RE.test(url.pathname)) return;
  // Chrome quirk: only-if-cached outside same-origin mode throws on fetch().
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  if (req.mode === 'navigate') { event.respondWith(fromNetworkFirst(event, req)); return; }
  if (!STATIC_RE.test(url.pathname) || req.headers.has('range')) return;
  event.respondWith(fromCacheThenRevalidate(event, req));
});
