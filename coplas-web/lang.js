// Pick a language before first paint, remember the choice, and let the reader
// override it. Loaded synchronously in <head> so the page never flashes both
// languages — but that means the DOM does not exist yet, so anything that
// touches elements has to wait for DOMContentLoaded.
(function () {
  var KEY = 'coplas.lang';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; } // private mode
  }

  function paintButtons(lang) {
    var btns = document.querySelectorAll('.langbar button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-set-lang') === lang));
    }
  }

  function apply(lang) {
    current = lang;
    root.classList.toggle('es', lang === 'es');
    root.lang = lang;
    if (document.body) paintButtons(lang);
  }

  var nav = (navigator.language || 'en').toLowerCase();
  var current;
  apply(stored() || (nav.indexOf('es') === 0 ? 'es' : 'en'));
  root.classList.add('ready');

  document.addEventListener('DOMContentLoaded', function () {
    paintButtons(current);
    var bar = document.querySelector('.langbar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var lang = b.getAttribute('data-set-lang');
      apply(lang);
      try { localStorage.setItem(KEY, lang); } catch (err) { /* ignore */ }
    });
  });
})();
