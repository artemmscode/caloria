export const config = window.CALORIA_CONFIG || {
  API_BASE_URL: 'http://localhost:3000',
  BOT_USERNAME: '',
  APP_VERSION: 'dev',
  DEV_MODE: true,
  REQUEST_TIMEOUT_MS: 20000,
};

const TOKEN_KEY = 'caloria.session';

export class ApiError extends Error {
  constructor(message, { code = 'ERROR', status = 0, details = null, requestId = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage may be blocked inside some webviews.
    }
  },
  clear() {
    this.set(null);
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const newIdempotencyKey = () =>
  `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

function buildUrl(path, query) {
  const base = `${config.API_BASE_URL}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${base}?${suffix}` : base;
}

async function request(method, path, options = {}) {
  const { body, query, auth = true, retries = method === 'GET' ? 2 : 0, timeout = config.REQUEST_TIMEOUT_MS } = options;
  const token = tokenStore.get();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-Idempotency-Key'] = options.idempotencyKey || newIdempotencyKey();
  }

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
      });
      clearTimeout(timer);
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (response.status === 401 && auth) {
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent('caloria:unauthorized'));
      }
      if (!response.ok || !payload?.ok) {
        const message =
          payload?.error?.message ||
          (response.status === 0 ? 'Нет соединения' : `Ошибка сервера (${response.status})`);
        throw new ApiError(message, {
          code: payload?.error?.code || `HTTP_${response.status}`,
          status: response.status,
          details: payload?.error?.details,
          requestId: payload?.error?.requestId,
        });
      }
      return payload.data;
    } catch (error) {
      clearTimeout(timer);
      const isAbort = error.name === 'AbortError';
      const isNetwork = error instanceof TypeError || isAbort;
      if (isAbort && attempt < retries) {
        attempt += 1;
        await sleep(350 * attempt);
        continue;
      }
      if (isNetwork && attempt < retries) {
        attempt += 1;
        await sleep(400 * attempt);
        continue;
      }
      if (error instanceof ApiError) throw error;
      if (isAbort) {
        throw new ApiError('Сервер отвечает слишком долго. Попробуйте ещё раз.', {
          code: 'TIMEOUT',
        });
      }
      throw new ApiError(
        navigator.onLine
          ? 'Не удалось связаться с сервером. Проверьте соединение.'
          : 'Нет подключения к интернету.',
        { code: 'OFFLINE' },
      );
    }
  }
}

const get = (path, query) => request('GET', path, { query });
const post = (path, body, options = {}) => request('POST', path, { ...options, body });
const put = (path, body, options = {}) => request('PUT', path, { ...options, body });
const del = (path) => request('DELETE', path);

export const api = {
  authTelegram: (initData) => post('/api/auth/telegram', { initData }, { auth: false }),
  authDev: (telegramId) =>
    post('/api/auth/dev', telegramId ? { telegramId } : {}, { auth: false }),

  health: () => get('/api/health'),

  getProfile: () => get('/api/user/profile'),
  saveProfile: (profile) => post('/api/user/profile', profile),
  previewPlan: (profile) => post('/api/user/plan-preview', profile),
  updateGoals: (goals) => put('/api/user/goals', goals),

  dashboard: (date) => get('/api/dashboard', { date }),
  diary: (date) => get(`/api/diary/${date}`),
  addEntry: (entry) => post('/api/diary', entry),
  updateEntry: (id, patch) => put(`/api/diary/${id}`, patch),
  deleteEntry: (id) => del(`/api/diary/${id}`),
  copyDay: (payload) => post('/api/diary/copy', payload),
  previousDay: (date) => get('/api/diary/previous', { date }),

  searchFoods: (q, limit = 25) => get('/api/food/search', { q, limit }),
  foodDiscovery: () => get('/api/food/discovery'),
  food: (id) => get(`/api/food/${id}`),
  customFood: (food) => post('/api/food/custom', food),
  toggleFavorite: (id) => post(`/api/food/favorites/${id}`, {}),

  statistics: (period) => get('/api/statistics', { period }),
  progress: (period) => get('/api/progress', { period }),
  addWeight: (payload) => post('/api/weight', payload),
  deleteWeight: (id) => del(`/api/weight/${id}`),
  addMeasurement: (payload) => post('/api/measurements', payload),
  deleteMeasurement: (id) => del(`/api/measurements/${id}`),
  addPhoto: (payload) => post('/api/photos', payload),
  deletePhoto: (id) => del(`/api/photos/${id}`),

  getWater: (date) => get('/api/water', { date }),
  addWater: (payload) => post('/api/water', payload),

  getReminders: () => get('/api/reminders'),
  updateReminders: (patch) => put('/api/reminders', patch),
};

export { request };
