import { escapeHtml, formatCalories, formatMacro, initials } from './utils.js';

export function icon(name, className = '', size = 20) {
  return `<i data-lucide="${escapeHtml(name)}" class="lucide ${className}" style="width:${size}px;height:${size}px" aria-hidden="true"></i>`;
}

export function refreshIcons(root = document) {
  try {
    window.lucide?.createIcons?.({
      attrs: { 'stroke-width': 1.8, 'aria-hidden': 'true' },
      nameAttr: 'data-lucide',
    });
  } catch {
    // Icons are a progressive enhancement.
  }
  if (root instanceof Element) {
    // createIcons scans the whole document, so no extra work is needed.
  }
}

export function avatar(user, size = 44) {
  const url = user?.photoUrl;
  const label = initials(user?.firstName || 'C');
  return `
    <span class="avatar" style="--avatar-size:${size}px">
      ${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span>${escapeHtml(label || 'C')}</span>`}
    </span>`;
}

export function toast(message, type = 'success', { duration = 3200, title = null } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const icons = { success: 'check', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="toast__icon">${icon(icons[type] || 'info', '', 18)}</span>
    <span class="toast__content">${title ? `<strong>${escapeHtml(title)}</strong>` : ''}<span>${escapeHtml(message)}</span></span>
    <button class="toast__close" type="button" aria-label="Закрыть">${icon('x', '', 16)}</button>
  `;
  root.appendChild(el);
  refreshIcons(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast__close')?.addEventListener('click', remove);
  if (duration) setTimeout(remove, duration);
  return remove;
}

let openLayers = 0;

export function openSheet({ title = '', subtitle = '', content = '', onClose = null, className = '' } = {}) {
  const root = document.getElementById('overlay-root');
  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `
    <div class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || 'Диалог')}">
      <div class="sheet__handle" aria-hidden="true"></div>
      <header class="sheet__header">
        <div>
          ${title ? `<h2 class="sheet__title">${escapeHtml(title)}</h2>` : ''}
          ${subtitle ? `<p class="sheet__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button class="icon-btn sheet__close" type="button" aria-label="Закрыть">${icon('x', '', 20)}</button>
      </header>
      <div class="sheet__body"></div>
    </div>
  `;
  const body = layer.querySelector('.sheet__body');
  if (content instanceof Node) body.appendChild(content);
  else body.innerHTML = content;
  root.appendChild(layer);
  openLayers += 1;
  document.body.classList.add('has-overlay');
  refreshIcons(layer);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    layer.classList.remove('is-open');
    openLayers = Math.max(0, openLayers - 1);
    if (!openLayers) document.body.classList.remove('has-overlay');
    setTimeout(() => layer.remove(), 260);
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  layer.querySelector('.sheet__close')?.addEventListener('click', close);
  layer.addEventListener('click', (event) => {
    if (event.target === layer) close();
  });
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => layer.classList.add('is-open'));
  return { close, body, layer };
}

export function confirmDialog({
  title = 'Вы уверены?',
  message = '',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('overlay-root');
    const layer = document.createElement('div');
    layer.className = 'overlay overlay--center';
    layer.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="dialog__icon ${danger ? 'dialog__icon--danger' : ''}">${icon(danger ? 'trash-2' : 'help-circle', '', 24)}</div>
        <h2>${escapeHtml(title)}</h2>
        ${message ? `<p>${escapeHtml(message)}</p>` : ''}
        <div class="dialog__actions">
          <button class="btn btn--ghost" type="button" data-dialog="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-dialog="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    root.appendChild(layer);
    openLayers += 1;
    document.body.classList.add('has-overlay');
    refreshIcons(layer);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      layer.classList.remove('is-open');
      openLayers = Math.max(0, openLayers - 1);
      if (!openLayers) document.body.classList.remove('has-overlay');
      setTimeout(() => layer.remove(), 220);
      resolve(value);
    };
    layer.querySelector('[data-dialog="cancel"]').addEventListener('click', () => finish(false));
    layer.querySelector('[data-dialog="ok"]').addEventListener('click', () => finish(true));
    layer.addEventListener('click', (event) => {
      if (event.target === layer) finish(false);
    });
    const onKey = (event) => {
      if (event.key === 'Escape') finish(false);
    };
    document.addEventListener('keydown', onKey, { once: true });
    requestAnimationFrame(() => layer.classList.add('is-open'));
    layer.querySelector('[data-dialog="ok"]').focus();
  });
}

export function openActionSheet({ title = '', actions = [] } = {}) {
  const content = document.createElement('div');
  content.className = 'action-sheet';
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action-sheet__item ${action.danger ? 'is-danger' : ''}`;
    button.innerHTML = `
      <span class="action-sheet__icon">${icon(action.icon || 'circle', '', 19)}</span>
      <span>${escapeHtml(action.label)}</span>
      ${action.hint ? `<span class="action-sheet__hint">${escapeHtml(action.hint)}</span>` : ''}`;
    button.addEventListener('click', () => {
      sheet.close();
      action.onSelect?.();
    });
    content.appendChild(button);
  }
  const sheet = openSheet({ title, content });
  refreshIcons(content);
  return sheet;
}

export function screenHeader({ eyebrow = '', title, subtitle = '', actions = '', className = '' }) {
  return `
    <header class="screen-header ${className}">
      <div class="screen-header__copy">
        ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
        <h1 class="screen-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="screen-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="screen-header__actions">${actions}</div>` : ''}
    </header>`;
}

export function segmented(options, active, dataAttribute = 'data-period') {
  return `
    <div class="segmented" role="tablist">
      ${options
        .map(
          (option) => `
        <button type="button" role="tab" class="segmented__item ${option.value === active ? 'is-active' : ''}"
          ${dataAttribute}="${escapeHtml(option.value)}" aria-selected="${option.value === active}">
          ${escapeHtml(option.label)}
        </button>`,
        )
        .join('')}
    </div>`;
}

export function calorieRing({ consumed, goal, remaining, over = false, percent = 0 }) {
  const safeGoal = Math.max(1, Number(goal) || 1);
  const safeConsumed = Math.max(0, Number(consumed) || 0);
  const ratio = Math.min(1, safeConsumed / safeGoal);
  const circumference = 2 * Math.PI * 92;
  const offset = circumference * (1 - ratio);
  const overflow = Math.max(0, Math.round(safeConsumed - safeGoal));
  const left = Math.max(0, Math.round(safeGoal - safeConsumed));
  const gradientId = `calorie-gradient-${Math.random().toString(36).slice(2, 8)}`;

  return `
    <div class="calorie-ring ${over ? 'is-over' : ''}" style="--ring-pct:${Math.round(percent)}">
      <svg class="calorie-ring__svg" viewBox="0 0 220 220" role="img"
        aria-label="Съедено ${formatCalories(safeConsumed)} из ${formatCalories(safeGoal)} калорий">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${over ? '#FFB340' : '#DFFF8A'}" />
            <stop offset="55%" stop-color="${over ? '#FF7A45' : '#7BED9F'}" />
            <stop offset="100%" stop-color="${over ? '#FF375F' : '#30D158'}" />
          </linearGradient>
          <filter id="${gradientId}-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle class="calorie-ring__track" cx="110" cy="110" r="92" />
        <circle class="calorie-ring__ticks" cx="110" cy="110" r="104" />
        <circle class="calorie-ring__progress" cx="110" cy="110" r="92"
          stroke="url(#${gradientId})"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}" />
        <circle class="calorie-ring__inner" cx="110" cy="110" r="76" />
      </svg>
      <div class="calorie-ring__center">
        <span class="calorie-ring__label">${over ? 'СЪЕДЕНО' : 'СЪЕДЕНО'}</span>
        <strong class="calorie-ring__value">${formatCalories(safeConsumed)}</strong>
        <span class="calorie-ring__unit">ккал</span>
        <span class="calorie-ring__divider"></span>
        <span class="calorie-ring__meta">
          ${over ? `выше цели на <b>${formatCalories(overflow)}</b>` : `осталось <b>${formatCalories(left)}</b>`}
        </span>
        <span class="calorie-ring__goal">цель ${formatCalories(safeGoal)} ккал</span>
      </div>
    </div>`;
}

export function macroBar(key, label, value, goal, color) {
  const pct = goal ? Math.min(100, Math.round((Number(value) / Number(goal)) * 100)) : 0;
  const over = goal && Number(value) > Number(goal);
  return `
    <article class="macro-card" style="--macro-color:${color}">
      <div class="macro-card__top">
        <span class="macro-card__dot"></span>
        <span class="macro-card__label">${escapeHtml(label)}</span>
      </div>
      <p class="macro-card__value">
        <strong>${formatMacro(value)}</strong><span> / ${formatMacro(goal)} г</span>
      </p>
      <div class="macro-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal || 0}" aria-valuenow="${Number(value) || 0}">
        <span style="width:${pct}%" class="${over ? 'is-over' : ''}"></span>
      </div>
    </article>`;
}

export function emptyState({ iconName = 'sparkles', title, text = '', action = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon(iconName, '', 26)}</div>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${action ? `<div class="empty-state__action">${action}</div>` : ''}
    </div>`;
}

export function errorState(message, { retry = true } = {}) {
  return `
    <div class="error-state">
      <div class="error-state__icon">${icon('wifi-off', '', 24)}</div>
      <h3>Не удалось загрузить данные</h3>
      <p>${escapeHtml(message || 'Проверьте соединение и попробуйте снова.')}</p>
      ${retry ? `<button class="btn btn--secondary" type="button" data-action="retry">${icon('refresh-cw', '', 16)} Проверить снова</button>` : ''}
    </div>`;
}

export function skeletonDashboard() {
  return `
    <div class="skeleton-page" aria-hidden="true">
      <div class="skeleton skeleton--line" style="width:42%"></div>
      <div class="skeleton skeleton--hero"></div>
      <div class="skeleton-grid">
        <div class="skeleton skeleton--card"></div>
        <div class="skeleton skeleton--card"></div>
        <div class="skeleton skeleton--card"></div>
      </div>
      <div class="skeleton skeleton--card"></div>
    </div>`;
}

export function skeletonList(rows = 3) {
  return `<div class="skeleton-list" aria-hidden="true">${Array.from(
    { length: rows },
    () => '<div class="skeleton skeleton--row"></div>',
  ).join('')}</div>`;
}

export function setBusy(button, busy, busyLabel = 'Сохраняем…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-busy');
    button.innerHTML = `<span class="spinner spinner--sm"></span><span>${escapeHtml(busyLabel)}</span>`;
  } else {
    button.disabled = false;
    button.classList.remove('is-busy');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    refreshIcons(button);
  }
}

export function toggleRow({ id, title, hint = '', checked = false, iconName = '', dataKey = '' }) {
  return `
    <label class="toggle-row" for="${escapeHtml(id)}">
      <span class="toggle-row__lead">
        ${iconName ? `<span class="toggle-row__icon">${icon(iconName, '', 18)}</span>` : ''}
        <span>
          <span class="toggle-row__title">${escapeHtml(title)}</span>
          ${hint ? `<span class="toggle-row__hint">${escapeHtml(hint)}</span>` : ''}
        </span>
      </span>
      <span class="switch">
        <input id="${escapeHtml(id)}" type="checkbox" ${checked ? 'checked' : ''} ${dataKey ? `data-key="${escapeHtml(dataKey)}"` : ''} />
        <span class="switch__track"><span class="switch__thumb"></span></span>
      </span>
    </label>`;
}

export function statCard({ label, value, unit = '', hint = '', iconName = '', tone = 'default' }) {
  return `
    <article class="stat-card stat-card--${tone}">
      <div class="stat-card__top">
        <span>${escapeHtml(label)}</span>
        ${iconName ? icon(iconName, '', 17) : ''}
      </div>
      <p class="stat-card__value">${value}${unit ? `<span>${escapeHtml(unit)}</span>` : ''}</p>
      ${hint ? `<p class="stat-card__hint">${hint}</p>` : ''}
    </article>`;
}

export function spinnerBlock(text = 'Загрузка…') {
  return `<div class="spinner-block"><span class="spinner"></span><span>${escapeHtml(text)}</span></div>`;
}
