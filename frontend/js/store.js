import { localTimezone, todayInZone } from './utils.js';

const listeners = new Set();

export const state = {
  booted: false,
  online: navigator.onLine,
  theme: 'dark',
  user: null,
  profile: null,
  goals: null,
  plan: null,
  screen: 'home',
  date: todayInZone(localTimezone()),
  timezone: localTimezone(),
  data: {},
  loading: {},
  errors: {},
  lastSyncAt: null,
};

export function setState(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) listener(state, patch);
}

export function setScreenData(screen, value) {
  state.data[screen] = value;
  setState({ lastSyncAt: new Date().toISOString() });
}

export function getScreenData(screen) {
  return state.data[screen];
}

export function invalidate(screen) {
  if (screen) delete state.data[screen];
  else state.data = {};
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applySession(payload) {
  if (!payload) return;
  setState({
    user: payload.user,
    profile: payload.user,
    goals: payload.goals,
    plan: payload.plan,
    timezone: payload.user?.timezone || state.timezone,
    date: todayInZone(payload.user?.timezone || state.timezone),
  });
}

export function applyProfile(payload) {
  if (!payload) return;
  setState({
    user: payload.user,
    profile: payload.user,
    goals: payload.goals,
    plan: payload.plan,
    timezone: payload.user?.timezone || state.timezone,
  });
}

export function resetSession() {
  setState({
    user: null,
    profile: null,
    goals: null,
    plan: null,
    data: {},
    booted: false,
  });
}
