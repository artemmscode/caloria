import { api } from './api.js';
import { telegram } from './telegram.js';
import {
  escapeHtml,
  formatDateLong,
  formatDateShort,
  formatMacro,
  formatWeight,
  signed,
  todayInZone,
} from './utils.js';
import {
  confirmDialog,
  emptyState,
  errorState,
  icon,
  openSheet,
  refreshIcons,
  screenHeader,
  segmented,
  setBusy,
  skeletonList,
  statCard,
  toast,
} from './components.js';

const PERIODS = [
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
  { value: 'all', label: 'Всё' },
];

let period = '90d';
let charts = [];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function makeChart(canvas, config) {
  if (!window.Chart || !canvas) return null;
  try {
    const chart = new window.Chart(canvas, config);
    charts.push(chart);
    return chart;
  } catch {
    return null;
  }
}

function progressHero(data) {
  const current = data.currentWeight == null ? null : Number(data.currentWeight);
  const target = data.targetWeight == null ? null : Number(data.targetWeight);
  const toTarget = data.toTarget == null ? null : Number(data.toTarget);
  const change = Number(data.change) || 0;

  return `
    <section class="card progress-hero">
      <p class="progress-hero__label">Текущий вес</p>
      <p class="progress-hero__value">${current == null ? '—' : formatWeight(current)}<span> кг</span></p>
      <p class="progress-hero__meta">
        ${
          target != null
            ? toTarget === 0
              ? '<b>Цель достигнута.</b> Можно пересмотреть ориентиры вместе со специалистом.'
              : `${toTarget > 0 ? 'До цели' : 'Ниже цели на'} <b>${formatWeight(Math.abs(toTarget))} кг</b> · цель ${formatWeight(target)} кг`
            : 'Цель по весу не задана — можно добавить её в профиле.'
        }
      </p>
      <div class="insight-row" style="justify-content:center">
        ${icon(change < 0 ? 'trending-down' : change > 0 ? 'trending-up' : 'minus', '', 15)}
        <span>За период: <b>${change === 0 ? 'без изменений' : `${signed(change)} кг`}</b></span>
      </div>
    </section>`;
}

function weightHistory(data) {
  const all = [...(data.allWeights || [])].reverse();
  return `
    <article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Вес</h3>
          <p class="card__hint">${all.length ? `${all.length} ${all.length === 1 ? 'запись' : all.length < 5 ? 'записи' : 'записей'}` : 'Пока нет записей'}</p>
        </div>
        <button type="button" class="btn btn--secondary btn--sm" data-action="add-weight">${icon('plus', '', 15)} Добавить</button>
      </div>
      ${
        all.length
          ? `<div class="list">
              ${all
                .slice(0, 6)
                .map(
                  (item) => `
                <div class="list-row">
                  <span class="list-row__icon">${icon('scale', '', 18)}</span>
                  <span class="list-row__body">
                    <span class="list-row__title">${formatWeight(item.value)} кг</span>
                    <span class="list-row__hint">${escapeHtml(formatDateLong(item.date, { withYear: item.date.slice(0, 4) !== todayInZone().slice(0, 4) }))}</span>
                  </span>
                  <span class="list-row__trailing">
                    <button type="button" data-delete-weight="${escapeHtml(item.id)}" aria-label="Удалить запись веса">${icon('trash-2', '', 15)}</button>
                  </span>
                </div>`,
                )
                .join('')}
            </div>`
          : `<p class="field__hint">Добавьте первый вес, чтобы увидеть динамику. Взвешивайтесь в спокойном темпе — ежедневные колебания нормальны.</p>`
      }
    </article>`;
}

function measurementsCard(data) {
  const items = data.measurements || [];
  const latest = items[items.length - 1] || null;
  const recent = [...items].reverse().slice(0, 3);
  return `
    <article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Обхваты</h3>
          <p class="card__hint">${latest ? `Последнее измерение: ${escapeHtml(formatDateShort(latest.date))}` : 'Дополнительный способ видеть изменения'}</p>
        </div>
        <button type="button" class="btn btn--secondary btn--sm" data-action="add-measurement">${icon('plus', '', 15)} Добавить</button>
      </div>
      ${
        latest
          ? `<div class="measurement-grid">
              <div class="measurement-cell"><div class="measurement-cell__label">Талия</div><div class="measurement-cell__value">${latest.waist == null ? '—' : formatMacro(latest.waist)}<span> см</span></div></div>
              <div class="measurement-cell"><div class="measurement-cell__label">Бёдра</div><div class="measurement-cell__value">${latest.hips == null ? '—' : formatMacro(latest.hips)}<span> см</span></div></div>
              <div class="measurement-cell"><div class="measurement-cell__label">Грудь</div><div class="measurement-cell__value">${latest.chest == null ? '—' : formatMacro(latest.chest)}<span> см</span></div></div>
            </div>
            ${
              recent.length
                ? `<div class="list" style="margin-top:12px">
                    ${recent
                      .map(
                        (item) => `
                      <div class="list-row">
                        <span class="list-row__icon">${icon('ruler', '', 18)}</span>
                        <span class="list-row__body">
                          <span class="list-row__title">${escapeHtml(formatDateShort(item.date))}</span>
                          <span class="list-row__hint">Талия ${item.waist == null ? '—' : `${formatMacro(item.waist)} см`} · Бёдра ${item.hips == null ? '—' : `${formatMacro(item.hips)} см`} · Грудь ${item.chest == null ? '—' : `${formatMacro(item.chest)} см`}</span>
                        </span>
                        <span class="list-row__trailing">
                          <button type="button" data-delete-measurement="${escapeHtml(item.id)}" aria-label="Удалить измерение">${icon('trash-2', '', 15)}</button>
                        </span>
                      </div>`,
                      )
                      .join('')}
                  </div>`
                : ''
            }`
          : `<p class="field__hint">Если вам комфортно измерять обхваты — записывайте их раз в 2–4 недели при одинаковых условиях.</p>`
      }
    </article>`;
}

function photosCard(data) {
  const photos = [...(data.photos || [])].reverse();
  return `
    <article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Фото прогресса</h3>
          <p class="card__hint">${photos.length ? `${photos.length} фото` : 'Только для вас'}</p>
        </div>
        <button type="button" class="btn btn--secondary btn--sm" data-action="add-photo">${icon('camera', '', 15)} Добавить</button>
      </div>
      <div class="photo-grid">
        ${photos
          .map(
            (photo) => `
          <button type="button" class="photo-item" data-photo-id="${escapeHtml(photo.id)}" aria-label="Открыть фото от ${escapeHtml(formatDateShort(photo.date))}">
            <img src="${escapeHtml(photo.dataUrl)}" alt="Фото прогресса от ${escapeHtml(formatDateShort(photo.date))}" loading="lazy" />
            <span class="photo-item__date">${escapeHtml(formatDateShort(photo.date))}</span>
          </button>`,
          )
          .join('')}
        <button type="button" class="photo-add" data-action="add-photo">
          ${icon('image-plus', '', 22)}
          <span>Добавить фото</span>
        </button>
      </div>
      <p class="field__hint" style="margin-top:10px">Фото хранятся как сжатые изображения и доступны только вам.</p>
    </article>`;
}

function weightChartCard(data) {
  const points = (data.allWeights || []).filter((item) => Number(item.value) > 0);
  if (points.length < 2) return '';
  return `
    <article class="card chart-card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Динамика веса</h3>
          <p class="card__hint">Сглаженный тренд, без ежедневной оценки</p>
        </div>
      </div>
      <div class="chart-wrap chart-wrap--sm">
        <canvas data-chart="weight-progress" aria-label="График динамики веса" role="img"></canvas>
        ${window.Chart ? '' : '<div class="chart-empty">График недоступен, но записи сохранены.</div>'}
      </div>
    </article>`;
}

function renderWeightChart(data) {
  const canvas = document.querySelector('[data-chart="weight-progress"]');
  if (!canvas || !window.Chart) return;
  const points = (data.allWeights || []).filter((item) => Number(item.value) > 0);
  if (points.length < 2) return;

  makeChart(canvas, {
    type: 'line',
    data: {
      labels: points.map((item) => formatDateShort(item.date)),
      datasets: [
        {
          label: 'Вес',
          data: points.map((item) => Number(item.value)),
          borderColor: cssVar('--accent') || '#c9f96d',
          backgroundColor: 'rgba(201,249,109,.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: cssVar('--accent') || '#c9f96d',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cssVar('--surface-solid') || '#14161b',
          titleColor: cssVar('--text') || '#f5f5f7',
          bodyColor: cssVar('--text-secondary') || '#a3a3ad',
          borderColor: cssVar('--border') || 'rgba(255,255,255,.08)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context) => `${formatWeight(context.parsed.y)} кг`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: cssVar('--text-tertiary'), font: { size: 9 }, maxTicksLimit: 6 },
        },
        y: {
          grid: { color: cssVar('--border'), drawTicks: false },
          border: { display: false },
          ticks: {
            color: cssVar('--text-tertiary'),
            font: { size: 9 },
            maxTicksLimit: 4,
            callback: (value) => formatWeight(value),
          },
        },
      },
    },
  });
}

function openWeightSheet(ctx, today) {
  const content = document.createElement('div');
  content.innerHTML = `
    <label class="field">
      <span class="field__label">Вес</span>
      <div class="input-wrap">
        <input class="input" type="number" inputmode="decimal" min="30" max="300" step="0.1" value="${formatWeight(ctx.state.user?.weight || 70)}" data-weight-input />
        <span class="input-wrap__suffix">кг</span>
      </div>
    </label>
    <label class="field" style="margin-top:12px">
      <span class="field__label">Дата</span>
      <input class="input" type="date" max="${today}" value="${today}" data-weight-date />
    </label>
    <button class="btn btn--primary btn--block" type="button" data-action="save-weight" style="margin-top:18px">
      ${icon('check', '', 18)} Сохранить вес
    </button>
    <p class="field__hint" style="margin-top:10px;text-align:center">Одна запись в день; повторное сохранение обновит значение.</p>`;
  const sheet = openSheet({ title: 'Новый вес', subtitle: 'Наблюдение, а не оценка', content });
  refreshIcons(content);

  content.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="save-weight"]')) return;
    const value = Number(content.querySelector('[data-weight-input]')?.value);
    const date = content.querySelector('[data-weight-date]')?.value || today;
    if (!Number.isFinite(value) || value < 30 || value > 300) {
      toast('Вес должен быть от 30 до 300 кг', 'error');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast('Выберите корректную дату', 'error');
      return;
    }
    const button = content.querySelector('[data-action="save-weight"]');
    setBusy(button, true, 'Сохраняем…');
    try {
      await api.addWeight({ weight: Math.round(value * 10) / 10, date });
      if (ctx.state.user) ctx.state.user.weight = Math.round(value * 10) / 10;
      telegram.haptic('success');
      toast('Вес сохранён', 'success');
      sheet.close();
      ctx.refresh();
    } catch (error) {
      setBusy(button, false);
      toast(error?.message || 'Не удалось сохранить вес', 'error');
    }
  });
}

function openMeasurementSheet(ctx, today) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid form-grid--2">
      <label class="field">
        <span class="field__label">Талия</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="30" max="250" step="0.1" data-measure="waist" placeholder="—" />
          <span class="input-wrap__suffix">см</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Бёдра</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="30" max="250" step="0.1" data-measure="hips" placeholder="—" />
          <span class="input-wrap__suffix">см</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Грудь</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="30" max="250" step="0.1" data-measure="chest" placeholder="—" />
          <span class="input-wrap__suffix">см</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Дата</span>
        <input class="input" type="date" max="${today}" value="${today}" data-measure-date />
      </label>
    </div>
    <label class="field" style="margin-top:12px">
      <span class="field__label">Заметка <span class="text-tertiary">(необязательно)</span></span>
      <input class="input" type="text" maxlength="280" data-measure-note placeholder="Например, утром, без одежды" />
    </label>
    <button class="btn btn--primary btn--block" type="button" data-action="save-measurement" style="margin-top:18px">
      ${icon('check', '', 18)} Сохранить измерение
    </button>
    <p class="field__hint" style="margin-top:10px;text-align:center">Заполните хотя бы один параметр.</p>`;
  const sheet = openSheet({ title: 'Обхваты', subtitle: 'Раз в 2–4 недели', content });
  refreshIcons(content);

  content.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="save-measurement"]')) return;
    const payload = { date: content.querySelector('[data-measure-date]')?.value || today };
    for (const field of ['waist', 'hips', 'chest']) {
      const raw = content.querySelector(`[data-measure="${field}"]`)?.value;
      if (raw !== '' && raw != null) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 30 || value > 250) {
          toast('Обхваты должны быть от 30 до 250 см', 'error');
          return;
        }
        payload[field] = Math.round(value * 10) / 10;
      }
    }
    if (!payload.waist && !payload.hips && !payload.chest) {
      toast('Заполните хотя бы один параметр', 'error');
      return;
    }
    const note = content.querySelector('[data-measure-note]')?.value?.trim();
    if (note) payload.note = note;
    const button = content.querySelector('[data-action="save-measurement"]');
    setBusy(button, true, 'Сохраняем…');
    try {
      await api.addMeasurement(payload);
      telegram.haptic('success');
      toast('Измерение сохранено', 'success');
      sheet.close();
      ctx.refresh();
    } catch (error) {
      setBusy(button, false);
      toast(error?.message || 'Не удалось сохранить измерение', 'error');
    }
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Выберите изображение (JPEG, PNG или WebP).'));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error('Файл слишком большой. Выберите изображение до 25 МБ.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Не удалось открыть изображение.'));
      image.onload = () => {
        try {
          let maxSide = 1280;
          let quality = 0.72;
          let result = '';
          for (let attempt = 0; attempt < 10; attempt += 1) {
            const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
            const width = Math.max(1, Math.round(image.width * scale));
            const height = Math.max(1, Math.round(image.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);
            result = canvas.toDataURL('image/jpeg', quality);
            if (result.length <= 690000) {
              resolve(result);
              return;
            }
            if (quality > 0.42) quality -= 0.12;
            else maxSide = Math.round(maxSide * 0.82);
          }
          reject(new Error('Фото слишком большое даже после сжатия. Попробуйте другое.'));
        } catch {
          reject(new Error('Не удалось обработать изображение.'));
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function openPhotoSheet(ctx, today) {
  const content = document.createElement('div');
  content.innerHTML = `
    <label class="photo-picker" for="progress-photo-input" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px dashed var(--border-strong);border-radius:var(--radius-md);cursor:pointer">
      <span class="list-row__icon">${icon('image-plus', '', 18)}</span>
      <span class="grow">
        <span class="list-row__title">Выбрать фото</span>
        <span class="list-row__hint" data-photo-status>JPEG, PNG или WebP. Сожмём автоматически.</span>
      </span>
      <input id="progress-photo-input" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-photo-input />
    </label>
    <div data-photo-preview-wrap hidden style="margin-top:12px">
      <img data-photo-preview alt="Предпросмотр" style="width:100%;max-height:320px;object-fit:contain;border-radius:var(--radius-md);background:var(--surface-strong)" />
    </div>
    <label class="field" style="margin-top:12px">
      <span class="field__label">Дата</span>
      <input class="input" type="date" max="${today}" value="${today}" data-photo-date />
    </label>
    <label class="field" style="margin-top:12px">
      <span class="field__label">Заметка <span class="text-tertiary">(необязательно)</span></span>
      <input class="input" type="text" maxlength="200" data-photo-note placeholder="Например, 1-й месяц" />
    </label>
    <button class="btn btn--primary btn--block" type="button" data-action="save-photo" style="margin-top:18px" disabled>
      ${icon('check', '', 18)} Сохранить фото
    </button>`;
  const sheet = openSheet({ title: 'Фото прогресса', subtitle: 'Только для вас', content, className: 'sheet--tall' });
  refreshIcons(content);

  let dataUrl = '';
  const saveButton = content.querySelector('[data-action="save-photo"]');
  const previewWrap = content.querySelector('[data-photo-preview-wrap]');
  const preview = content.querySelector('[data-photo-preview]');
  const status = content.querySelector('[data-photo-status]');

  content.querySelector('[data-photo-input]')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (status) status.textContent = 'Сжимаем изображение…';
    try {
      dataUrl = await compressImage(file);
      if (preview) preview.src = dataUrl;
      if (previewWrap) previewWrap.hidden = false;
      if (status) status.textContent = 'Фото готово. Можно сохранить.';
      if (saveButton) saveButton.disabled = false;
    } catch (error) {
      dataUrl = '';
      if (status) status.textContent = error?.message || 'Не удалось обработать фото.';
      if (saveButton) saveButton.disabled = true;
      toast(error?.message || 'Не удалось обработать фото', 'error');
    }
  });

  content.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="save-photo"]')) return;
    if (!dataUrl) {
      toast('Сначала выберите фото', 'warning');
      return;
    }
    const payload = { dataUrl, date: content.querySelector('[data-photo-date]')?.value || today };
    const note = content.querySelector('[data-photo-note]')?.value?.trim();
    if (note) payload.note = note;
    setBusy(saveButton, true, 'Сохраняем…');
    try {
      await api.addPhoto(payload);
      telegram.haptic('success');
      toast('Фото сохранено', 'success');
      sheet.close();
      ctx.refresh();
    } catch (error) {
      setBusy(saveButton, false);
      toast(error?.message || 'Не удалось сохранить фото', 'error');
    }
  });
}

function openPhotoView(photo, ctx) {
  const content = document.createElement('div');
  content.innerHTML = `
    <img src="${escapeHtml(photo.dataUrl)}" alt="Фото прогресса" style="width:100%;border-radius:var(--radius-md);background:var(--surface-strong)" />
    <div class="row row--between" style="margin-top:12px">
      <div>
        <p class="card__title">${escapeHtml(formatDateLong(photo.date))}</p>
        ${photo.note ? `<p class="card__hint">${escapeHtml(photo.note)}</p>` : ''}
      </div>
      <button type="button" class="btn btn--ghost btn--sm" data-action="delete-photo" style="color:var(--danger)">
        ${icon('trash-2', '', 16)} Удалить
      </button>
    </div>`;
  const sheet = openSheet({ title: 'Фото прогресса', content, className: 'sheet--tall' });
  refreshIcons(content);

  content.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="delete-photo"]')) return;
    const confirmed = await confirmDialog({
      title: 'Удалить фото?',
      message: 'Фото будет удалено без возможности восстановления.',
      confirmText: 'Удалить',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.deletePhoto(photo.id);
      toast('Фото удалено', 'success');
      sheet.close();
      ctx.refresh();
    } catch (error) {
      toast(error?.message || 'Не удалось удалить фото', 'error');
    }
  });
}

export async function mount(root, ctx) {
  destroy();
  const today = todayInZone(ctx.state.user?.timezone || ctx.state.timezone);

  root.innerHTML = `${screenHeader({
    eyebrow: 'Тело',
    title: 'Прогресс',
    subtitle: 'Мягкое наблюдение за изменениями',
  })}${segmented(PERIODS, period, 'data-progress-period')}${skeletonList(5)}`;
  refreshIcons(root);

  let data;
  try {
    data = await api.progress(period);
  } catch (error) {
    if (!ctx.isActive()) return;
    root.innerHTML = `${screenHeader({ eyebrow: 'Тело', title: 'Прогресс' })}${errorState(error?.message)}`;
    root.querySelector('[data-action="retry"]')?.addEventListener('click', () => ctx.refresh());
    refreshIcons(root);
    return;
  }

  if (!ctx.isActive()) return;

  const photoIndex = new Map((data.photos || []).map((photo) => [String(photo.id), photo]));
  const hasAny = Boolean(
    (data.allWeights || []).length || (data.measurements || []).length || (data.photos || []).length,
  );

  root.innerHTML = `
    ${screenHeader({ eyebrow: 'Тело', title: 'Прогресс', subtitle: 'Мягкое наблюдение за изменениями' })}
    ${segmented(PERIODS, period, 'data-progress-period')}
    <div class="stack-16">
      ${progressHero(data)}
      ${hasAny ? '' : `<article class="card">${emptyState({
        iconName: 'trending-up',
        title: 'Начните наблюдение',
        text: 'Добавьте вес, обхваты или фото. Одного показателя достаточно — не нужно заполнять всё.',
        action: `<button class="btn btn--primary btn--sm" type="button" data-action="add-weight">${icon('plus', '', 16)} Добавить вес</button>`,
      })}</article>`}
      ${hasAny ? `<div class="stat-grid">${statCard({
        label: 'Старт периода',
        value: data.startWeight == null ? '—' : formatWeight(data.startWeight),
        unit: 'кг',
        hint: 'первая запись в периоде',
        iconName: 'scale',
      })}${statCard({
        label: 'Изменение',
        value: data.change === 0 ? '0' : signed(data.change),
        unit: 'кг',
        hint: 'по записям, без оценки',
        iconName: data.change < 0 ? 'trending-down' : data.change > 0 ? 'trending-up' : 'minus',
        tone: 'accent',
      })}${statCard({
        label: 'Цель',
        value: data.targetWeight == null ? '—' : formatWeight(data.targetWeight),
        unit: 'кг',
        hint: data.toTarget == null ? 'не задана в профиле' : `осталось ${formatWeight(Math.abs(data.toTarget))} кг`,
        iconName: 'target',
      })}${statCard({
        label: 'Записей веса',
        value: (data.allWeights || []).length,
        unit: '',
        hint: 'за всё время',
        iconName: 'calendar-days',
      })}</div>` : ''}
      ${weightChartCard(data)}
      ${weightHistory(data)}
      ${measurementsCard(data)}
      ${photosCard(data)}
      <p class="safety-note">
        ${icon('shield-check', '', 17)}
        <span>Вес колеблется из-за воды, сна и цикла — это нормально. Если изменения пугают или появляются ограничения в еде, обратитесь к специалисту.</span>
      </p>
      <p class="disclaimer">
        ${icon('info', '', 16)}
        <span>Фото и измерения — необязательные инструменты. Их отсутствие не делает прогресс менее реальным.</span>
      </p>
    </div>`;

  refreshIcons(root);
  requestAnimationFrame(() => renderWeightChart(data));

  root.addEventListener('click', async (event) => {
    const photoButton = event.target.closest('[data-photo-id]');
    if (photoButton) {
      const photo = photoIndex.get(String(photoButton.dataset.photoId));
      if (photo) openPhotoView(photo, ctx);
      return;
    }

    const deleteWeight = event.target.closest('[data-delete-weight]');
    if (deleteWeight) {
      const confirmed = await confirmDialog({
        title: 'Удалить запись веса?',
        message: 'Запись исчезнет из истории. Остальные данные останутся.',
        confirmText: 'Удалить',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await api.deleteWeight(deleteWeight.dataset.deleteWeight);
        toast('Запись веса удалена', 'success');
        ctx.refresh();
      } catch (error) {
        toast(error?.message || 'Не удалось удалить запись', 'error');
      }
      return;
    }

    const deleteMeasurement = event.target.closest('[data-delete-measurement]');
    if (deleteMeasurement) {
      const confirmed = await confirmDialog({
        title: 'Удалить измерение?',
        message: 'Запись обхватов исчезнет из истории.',
        confirmText: 'Удалить',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await api.deleteMeasurement(deleteMeasurement.dataset.deleteMeasurement);
        toast('Измерение удалено', 'success');
        ctx.refresh();
      } catch (error) {
        toast(error?.message || 'Не удалось удалить измерение', 'error');
      }
      return;
    }

    const periodButton = event.target.closest('[data-progress-period]');
    if (periodButton) {
      if (periodButton.dataset.progressPeriod !== period) {
        period = periodButton.dataset.progressPeriod;
        ctx.refresh();
      }
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'add-weight') openWeightSheet(ctx, today);
    if (action === 'add-measurement') openMeasurementSheet(ctx, today);
    if (action === 'add-photo') openPhotoSheet(ctx, today);
    if (action === 'retry') ctx.refresh();
  }, { signal: ctx.signal });
}

export function destroy() {
  for (const chart of charts) {
    try {
      chart.destroy();
    } catch {
      // Already removed with its canvas.
    }
  }
  charts = [];
}
