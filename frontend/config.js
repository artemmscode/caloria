/*
 * CALORIA frontend configuration.
 *
 * `__API_BASE_URL__` and `__BOT_USERNAME__` are replaced by the GitHub Actions
 * workflow at deploy time (from repository Variables). Keeping the placeholders
 * intact means local development uses localhost; production must be configured
 * with the real HTTPS Render URL.
 */
(function () {
  const placeholder = '__API_BASE_URL__';
  const botPlaceholder = '__BOT_USERNAME__';
  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:';
  const stored = (() => {
    try {
      return localStorage.getItem('caloria.apiBase');
    } catch {
      return null;
    }
  })();
  const fallbackProduction = 'https://caloria-api.onrender.com';
  const apiBase = placeholder.startsWith('__')
    ? stored || (isLocal ? 'http://localhost:3000' : fallbackProduction)
    : placeholder;
  const botUsername = botPlaceholder.startsWith('__') ? '' : botPlaceholder;

  window.CALORIA_CONFIG = {
    API_BASE_URL: apiBase.replace(/\/+$/, ''),
    BOT_USERNAME: botUsername.replace(/^@/, ''),
    APP_VERSION: '1.0.0',
    IS_LOCAL: isLocal,
    // The API itself enforces the production ban; this only controls the UI.
    DEV_MODE: isLocal,
    REQUEST_TIMEOUT_MS: 20000,
  };
})();
