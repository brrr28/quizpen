/* Student player theme before first paint (loaded without defer): the landing's saved choice
   (localStorage qp_theme, same origin) or else the system setting. A separate file because the
   player's CSP allows no inline script. */
(function (d) {
  var KEY = 'qp_theme', COLOR = { light: '#F6F6F2', dark: '#0E1220' };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; }
  }
  function apply(t) {
    d.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', COLOR[t]);
  }
  apply(saved() || (mq && mq.matches ? 'dark' : 'light'));
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(saved() || (mq && mq.matches ? 'dark' : 'light')); });
  if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { if (!saved()) apply(e.matches ? 'dark' : 'light'); });
})(document.documentElement);
