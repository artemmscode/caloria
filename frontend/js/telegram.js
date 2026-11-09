/* Compatibility wrapper around the Telegram Web Apps SDK. */

const tg = () => window.Telegram?.WebApp;

export const telegram = {
  get available() {
    return Boolean(tg()?.initData);
  },
  get platform() {
    return tg()?.platform || 'web';
  },
  get initData() {
    return tg()?.initData || '';
  },
  get user() {
    return tg()?.initDataUnsafe?.user || null;
  },
  get colorScheme() {
    return tg()?.colorScheme || 'dark';
  },
  init() {
    const app = tg();
    if (!app) return;
    try {
      app.ready();
      app.expand();
      if (typeof app.disableVerticalSwipes === 'function') app.disableVerticalSwipes();
      if (typeof app.enableClosingConfirmation === 'function') {
        // Off by default: the app saves immediately after every action.
      }
      this.syncTheme();
      this.syncViewport();
      app.onEvent?.('viewportChanged', () => this.syncViewport());
      app.onEvent?.('themeChanged', () => this.syncTheme());
    } catch {
      // Older Telegram clients may not expose every method.
    }
  },
  syncViewport() {
    const app = tg();
    if (!app) return;
    try {
      app.expand?.();
      const safe = app.safeAreaInset || {};
      const content = app.contentSafeAreaInset || {};
      const root = document.documentElement;
      root.style.setProperty('--tg-safe-top', `${Math.max(safe.top || 0, content.top || 0)}px`);
      root.style.setProperty('--tg-safe-bottom', `${Math.max(safe.bottom || 0, content.bottom || 0)}px`);
    } catch {
      // no-op
    }
  },
  syncTheme() {
    const app = tg();
    if (!app) return;
    const light = document.documentElement.dataset.theme === 'light';
    try {
      app.setHeaderColor?.(light ? '#F5F5F7' : '#08090B');
      app.setBackgroundColor?.(light ? '#F5F5F7' : '#08090B');
      app.setBottomBarColor?.(light ? '#F5F5F7' : '#08090B');
    } catch {
      // no-op
    }
  },
  haptic(type = 'light') {
    try {
      if (type === 'success' || type === 'error' || type === 'warning') {
        tg()?.HapticFeedback?.notificationOccurred(type);
      } else {
        tg()?.HapticFeedback?.impactOccurred(type);
      }
    } catch {
      // no-op
    }
  },
  close() {
    tg()?.close?.();
  },
  openBot(username) {
    if (!username) return false;
    const url = `https://t.me/${username}`;
    if (tg()?.openTelegramLink) tg().openTelegramLink(url);
    else window.open(url, '_blank', 'noopener');
    return true;
  },
};
