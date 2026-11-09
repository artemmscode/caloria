import { api, config, tokenStore, ApiError } from './api.js';
import { telegram } from './telegram.js';
import {
  state,
  setState,
  applySession,
  applyProfile,
  resetSession,
} from './store.js';
import { localTimezone, todayInZone, formatDateLong } from './utils.js';
import { avatar, refreshIcons, toast } from './components.js';
import { openOnboarding } from './onboarding.js';
import { openFoodPicker } from './food.js';
import * as dashboardScreen from './dashboard.js';
import * as diaryScreen from './diary.js';
import * as statisticsScreen from './statistics.js';
import * as progressScreen from './progress.js';
import * as profileScreen from './profile.js';

const SCREENS = {
  home: dashboardScreen,
  diary: diaryScreen,
  statistics: statisticsScreen,
  progress: progressScreen,
  profile: profileScreen,
};

const THEME_KEY = 'caloria.theme';
const DEV_ID_KEY = 'caloria.devTelegramId';

const $ = (selector) => document.querySelector(selector);

const elements = {
  splash: $('#splash'),
  bootError: $('#boot-error'),
  bootErrorText: $('#boot-error-text'),
  bootRetry: $('#boot-retry'),
  app: $('#app'),
  view: $('#view'),
  bottomNav: $('#bottom-nav'),
  themeToggle: $('#theme-toggle'),
  topbarAvatar: $('#topbar-avatar'),
  offlineBanner: $('#offline-banner'),
  onboarding: $('#onboarding'),
  bootBotUsername: $('#boot-bot-username'),
};

let currentScreen = null;
let screenAbort = null;
let navSeq = 0;
let pendingDiaryDate = null;
let booting = false;
let onboardingOpen = false;
let unauthorizedLock = false;
let lastVisibleRefresh = 0;

/* Theme ------------------------------------------------------------------- */

function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  setState({ theme: next });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'light' ? '#F2F2F7' : '#08090B');
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be disabled in some webviews.
    }
  }
  if (elements.themeToggle) {
    elements.themeToggle.innerHTML = `<i data-lucide="${next === 'light' ? 'sun' : 'moon-star'}"></i>`;
    refreshIcons(elements.themeToggle);
  }
  telegram.syncTheme();
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  telegram.haptic('light');
}

/* Chrome ------------------------------------------------------------------ */

function updateChrome() {
  if (elements.topbarAvatar) {
    elements.topbarAvatar.innerHTML = avatar(state.user || {}, 36);
    elements.topbarAvatar.setAttribute(
      'aria-label',
      state.user?.firstName ? `Профиль ${state.user.firstName}` : 'Открыть профиль',
    );
  }
  document.title = state.user?.firstName
    ? `CALORIA — ${state.user.firstName}`
    : 'CALORIA — дневник питания';
}

function setOnline(online) {
  setState({ online });
  if (elements.offlineBanner) elements.offlineBanner.hidden = online;
}

function showBootError(message, { retry = true } = {}) {
  elements.splash?.classList.add('is-leaving');
  if (elements.app) elements.app.hidden = true;
  if (elements.bootError) elements.bootError.hidden = false;
  if (elements.bootErrorText) {
    elements.bootErrorText.textContent =
      message || 'Проверьте соединение и откройте приложение ещё раз.';
  }
  if (elements.bootRetry) elements.bootRetry.hidden = !retry;
}

function hideBootError() {
  if (elements.bootError) elements.bootError.hidden = true;
}

function hideSplash() {
  if (!elements.splash) return;
  elements.splash.classList.add('is-leaving');
  window.setTimeout(() => {
    if (elements.splash) elements.splash.hidden = true;
  }, 560);
}

function showApp() {
  hideBootError();
  hideSplash();
  if (elements.app) elements.app.hidden = false;
}

/* Context ----------------------------------------------------------------- */

function makeContext(screen, seq) {
  return {
    screen,
    state,
    config,
    isActive: () => state.screen === screen && seq === navSeq,
    navigate,
    refresh: () => renderScreen(screen, { force: true, keepScroll: true }),
    openDiary: (date) => openDiary(date),
    openProfile: () => navigate('profile'),
    openFoodPicker,
    takePendingDiaryDate: () => {
      const value = pendingDiaryDate;
      pendingDiaryDate = null;
      return value;
    },
    toggleTheme,
    updateChrome,
    notify: toast,
    signal: screenAbort?.signal,
  };
}

/* Navigation -------------------------------------------------------------- */

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '').trim();
  const name = raw.split('/')[0];
  return SCREENS[name] ? name : 'home';
}

function syncNav(screen) {
  document.querySelectorAll('[data-nav]').forEach((node) => {
    const target = node.closest('.nav-item') || node;
    const active = target.getAttribute('data-nav') === screen;
    if (target.classList.contains('nav-item')) {
      target.classList.toggle('is-active', active);
      target.setAttribute('aria-current', active ? 'page' : 'false');
    }
  });
}

function navigate(name, { replace = false } = {}) {
  const target = SCREENS[name] ? name : 'home';
  if (onboardingOpen) return;
  if (location.hash === `#${target}`) {
    if (state.screen !== target) renderScreen(target, { force: true });
    else renderScreen(target, { force: true, keepScroll: true });
    return;
  }
  if (replace) history.replaceState(null, '', `#${target}`);
  else location.hash = target;
}

function openDiary(date) {
  pendingDiaryDate = date || null;
  navigate('diary');
}

async function renderScreen(name, { force = false, keepScroll = false } = {}) {
  const target = SCREENS[name] ? name : 'home';
  if (!state.booted) return;

  const same = state.screen === target && currentScreen === target;
  if (same && !force) return;

  const previous = SCREENS[currentScreen];
  try {
    screenAbort?.abort();
  } catch {
    // Ignore abort errors from already-settled operations.
  }
  screenAbort = new AbortController();
  try {
    previous?.destroy?.();
  } catch {
    // A screen may fail to clean up; it must never block navigation.
  }

  state.screen = target;
  syncNav(target);
  const seq = ++navSeq;
  currentScreen = target;
  const ctx = makeContext(target, seq);

  if (!keepScroll) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const view = elements.view;
  if (!view) return;
  view.classList.remove('is-switching');
  void view.offsetWidth;
  view.classList.add('is-switching');

  try {
    await SCREENS[target].mount(view, ctx);
  } catch (error) {
    if (!ctx.isActive()) return;
    view.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon"><i data-lucide="unplug"></i></div>
        <h3>Не удалось открыть раздел</h3>
        <p>${escapeText(error?.message || 'Попробуйте ещё раз.')}</p>
        <button class="btn btn--secondary" type="button" data-action="retry-screen">
          <i data-lucide="refresh-cw"></i> Повторить
        </button>
      </div>`;
    view.querySelector('[data-action="retry-screen"]')?.addEventListener('click', () =>
      renderScreen(target, { force: true }),
    );
  }

  refreshIcons(view);
  if (ctx.isActive()) view.focus({ preventScroll: true });
}

function escapeText(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Auth -------------------------------------------------------------------- */

function devTelegramId() {
  try {
    const param = new URLSearchParams(location.search).get('dev');
    if (param && /^\d{1,20}$/.test(param)) {
      localStorage.setItem(DEV_ID_KEY, param);
      return param;
    }
    return localStorage.getItem(DEV_ID_KEY) || '900000001';
  } catch {
    return '900000001';
  }
}

async function authenticate() {
  if (telegram.available) {
    const payload = await api.authTelegram(telegram.initData);
    if (!payload?.token) throw new ApiError('Сервер не выдал сессию');
    tokenStore.set(payload.token);
    applySession(payload);
    state.devMode = Boolean(payload.devMode);
    return payload;
  }

  if (config.DEV_MODE) {
    const payload = await api.authDev(devTelegramId());
    if (!payload?.token) throw new ApiError('Сервер не выдал сессию');
    tokenStore.set(payload.token);
    applySession(payload);
    state.devMode = true;
    return payload;
  }

  throw new ApiError(
    'Откройте CALORIA через Telegram — вход доступен только внутри Mini App.',
    { code: 'TELEGRAM_REQUIRED' },
  );
}

async function restoreSession() {
  const token = tokenStore.get();
  if (!token) return null;
  try {
    const profile = await api.getProfile();
    applyProfile(profile);
    return profile;
  } catch (error) {
    tokenStore.clear();
    if (error instanceof ApiError && error.status && error.status !== 401) throw error;
    return null;
  }
}

async function ensureOnboarding() {
  if (state.user?.onboardingCompleted) return true;

  if (onboardingOpen) return false;
  onboardingOpen = true;
  if (elements.app) elements.app.hidden = true;

  await openOnboarding(elements.onboarding, {
    state,
    config,
    onComplete: (payload) => {
      onboardingOpen = false;
      if (elements.onboarding) elements.onboarding.innerHTML = '';
      applyProfile(payload);
      setState({ booted: true });
      updateChrome();
      showApp();
      if (location.hash && location.hash !== '#home') history.replaceState(null, '', '#home');
      renderScreen('home', { force: true });
      toast('План сохранён. Добро пожаловать в CALORIA!', 'success');
    },
  });

  return false;
}

async function boot() {
  if (booting) return;
  booting = true;
  hideBootError();

  try {
    if (!telegram.available && !config.DEV_MODE) {
      throw new ApiError(
        'CALORIA открывается через Telegram. Перейдите в бота и нажмите «Открыть приложение».',
        { code: 'TELEGRAM_REQUIRED' },
      );
    }

    telegram.init();
    setOnline(navigator.onLine);

    let profile = await restoreSession();
    if (!profile) profile = await authenticate();
    if (!profile?.user) profile = await api.getProfile();
    applyProfile(profile);

    setState({
      booted: true,
      timezone: state.user?.timezone || state.timezone || localTimezone(),
      date: todayInZone(state.user?.timezone || state.timezone),
    });
    updateChrome();

    const ready = await ensureOnboarding();
    if (!ready) {
      hideSplash();
      return;
    }

    showApp();
    const route = parseHash();
    state.screen = route;
    renderScreen(route, { force: true });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Не удалось запустить CALORIA. Проверьте соединение и попробуйте снова.';
    showBootError(message);
  } finally {
    booting = false;
  }
}

async function silentReauth() {
  if (unauthorizedLock) return;
  unauthorizedLock = true;
  tokenStore.clear();
  try {
    await authenticate();
    updateChrome();
    if (state.user?.onboardingCompleted) {
      showApp();
      renderScreen(state.screen || 'home', { force: true, keepScroll: true });
    } else {
      await ensureOnboarding();
    }
  } catch {
    resetSession();
    showBootError('Сессия истекла. Откройте приложение заново через Telegram.');
  } finally {
    window.setTimeout(() => {
      unauthorizedLock = false;
    }, 1500);
  }
}

/* Global events ----------------------------------------------------------- */

function bindEvents() {
  document.addEventListener('click', (event) => {
    const navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      event.preventDefault();
      const name = navTarget.getAttribute('data-nav');
      if (navTarget.matches('a')) navigate(name);
      else navigate(name);
      if (state.booted) telegram.haptic('light');
      return;
    }

    if (event.target.closest('#theme-toggle')) {
      toggleTheme();
      return;
    }

    if (event.target.closest('#topbar-avatar')) {
      navigate('profile');
      telegram.haptic('light');
    }
  });

  elements.bootRetry?.addEventListener('click', () => {
    resetSession();
    boot();
  });

  window.addEventListener('hashchange', () => {
    if (!state.booted || onboardingOpen) return;
    renderScreen(parseHash());
  });

  window.addEventListener('online', () => {
    setOnline(true);
    toast('Соединение восстановлено', 'success', { duration: 2200 });
  });

  window.addEventListener('offline', () => {
    setOnline(false);
    toast('Нет соединения. Данные могут быть неактуальны.', 'warning', {
      duration: 4200,
    });
  });

  window.addEventListener('caloria:unauthorized', () => {
    if (!state.booted) return;
    silentReauth();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.booted || !state.screen) return;
    if (onboardingOpen || document.querySelector('.sheet')) return;

    const today = todayInZone(state.user?.timezone || state.timezone);
    const dateChanged = today !== state.date;
    if (dateChanged) setState({ date: today });

    // Food can be added from the bot while the Mini App is in the background.
    // Refresh the active screen on return so the numbers are not stale.
    const now = Date.now();
    if (dateChanged || now - lastVisibleRefresh > 20_000) {
      lastVisibleRefresh = now;
      renderScreen(state.screen, { force: true, keepScroll: true });
    }
  });

  window.addEventListener('error', () => {
    // Non-fatal rendering errors should not take down the whole Mini App.
  });
}

function initTheme() {
  // CALORIA is dark by default; the choice is remembered after the first switch.
  const preferred = storedTheme() || 'dark';
  applyTheme(preferred, { persist: false });
}

function bootstrap() {
  if (elements.bootBotUsername && config.BOT_USERNAME) {
    elements.bootBotUsername.textContent = `@${config.BOT_USERNAME}`;
  }
  initTheme();
  bindEvents();
  updateChrome();
  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

if (config.DEV_MODE) {
  window.__CALORIA__ = {
    api,
    config,
    state,
    navigate,
    get pendingDiaryDate() {
      return pendingDiaryDate;
    },
    clearPendingDiaryDate() {
      pendingDiaryDate = null;
    },
  };
}

export { navigate, renderScreen };
