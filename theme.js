// DVIR DESIGNS theme: phones follow the OS; desktops start in light mode.
(function () {
  'use strict';
  const KEY = 'dvir_designs_theme_v1';
  const root = document.documentElement;
  const handheld = window.matchMedia ? window.matchMedia('(pointer: coarse) and (hover: none)') : null;
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function readChoice() {
    try {
      const stored = window.localStorage.getItem(KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch (_) { return null; }
  }
  let choice = readChoice();
  function effectiveTheme() {
    return choice || (handheld && handheld.matches && systemDark && systemDark.matches ? 'dark' : 'light');
  }
  function applyTheme() {
    const theme = effectiveTheme();
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#29242a' : '#f4e5e2');
    const button = document.getElementById('theme-toggle');
    if (button) {
      const target = theme === 'dark' ? 'בהיר' : 'כהה';
      button.setAttribute('aria-label', 'מעבר למצב ' + target);
      button.setAttribute('title', 'מעבר למצב ' + target);
      const label = button.querySelector('.theme-label');
      if (label) label.textContent = 'מצב ' + target;
    }
  }
  function watch(media) {
    if (!media) return;
    if (typeof media.addEventListener === 'function') media.addEventListener('change', applyTheme);
    else if (typeof media.addListener === 'function') media.addListener(applyTheme);
  }
  applyTheme(); // Run in the document head to avoid a flash of the wrong theme.
  watch(handheld);
  watch(systemDark);
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) {
      choice = readChoice();
      applyTheme();
    }
  });
  document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    button.addEventListener('click', function () {
      choice = effectiveTheme() === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(KEY, choice); } catch (_) {}
      applyTheme();
    });
    applyTheme();
  });
})();
