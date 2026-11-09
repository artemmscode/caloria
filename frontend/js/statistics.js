import { api } from './api.js';
import {
  escapeHtml,
  formatCalories,
  formatDateShort,
  formatMacro,
  formatWeight,
  plural,
} from './utils.js';
import {
  emptyState,
  errorState,
  icon,
  refreshIcons,
  screenHeader,
  segmented,
  skeletonList,
  statCard,
} from './components.js';

const PERIODS = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
  { value: 'all', label: 'Всё' },
];

let period = '30d';
let charts = [];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function textColor() {
  return cssVar('--text-tertiary') || '#8c8c95';
}

function gridColor() {
  return cssVar('--border') || 'rgba(255,255,255,.08)';
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

function chartFallback() {
  return `<div class="chart-empty">График недоступен в этом браузере, но данные выше актуальны.</div>`;
}

function kpiBlock(data) {
  return `
    <div class="stat-grid">
      ${statCard({
        label: 'Средние калории',
        value: formatCalories(data.average.calories),
        unit: 'ккал',
        hint: 'в дни с записями',
        iconName: 'flame',
        tone: 'accent',
      })}
      ${statCard({
        label: 'Регулярность',
        value: data.regularity.percent,
        unit: '%',
        hint: `дней с записями: ${data.regularity.loggedDays} из ${data.regularity.totalDays}`,
        iconName: 'calendar-days',
      })}
      ${statCard({
        label: 'В цели',
        value: data.regularity.adherenceDays,
        unit: plural(data.regularity.adherenceDays, 'день', 'дня', 'дней'),
        hint: 'в пределах ±15%',
        iconName: 'target',
        tone: 'warning',
      })}
      ${statCard({
        label: 'Записей в дни',
        value: data.regularity.loggedDays,
        unit: plural(data.regularity.loggedDays, 'день', 'дня', 'дней'),
        hint: `среднее БЖУ: ${formatMacro(data.average.protein)} / ${formatMacro(data.average.fat)} / ${formatMacro(data.average.carbohydrates)}`,
        iconName: 'notebook-pen',
      })}
    </div>`;
}

function caloriesChartCard() {
  return `
    <article class="card chart-card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Калории по дням</h3>
          <p class="card__hint">Столбцы — съедено, пунктир — цель</p>
        </div>
      </div>
      <div class="chart-wrap">
        <canvas data-chart="calories" aria-label="График калорий по дням" role="img"></canvas>
        ${window.Chart ? '' : chartFallback()}
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-item__dot" style="--legend-color:var(--accent)"></span>Съедено</span>
        <span class="legend-item"><span class="legend-item__dot" style="--legend-color:var(--pink)"></span>Цель</span>
      </div>
    </article>`;
}

function macroChartCard(data) {
  const total = (data.macros.protein || 0) + (data.macros.fat || 0) + (data.macros.carbohydrates || 0);
  return `
    <article class="card chart-card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Баланс БЖУ</h3>
          <p class="card__hint">Доля калорий из макронутриентов</p>
        </div>
      </div>
      <div class="chart-wrap chart-wrap--doughnut">
        <canvas data-chart="macros" aria-label="Доли белков, жиров и углеводов" role="img"></canvas>
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-item__dot" style="--legend-color:#FF375F"></span>Белки · ${total ? Math.round(data.macros.protein) : 0}%</span>
        <span class="legend-item"><span class="legend-item__dot" style="--legend-color:#FF9F0A"></span>Жиры · ${total ? Math.round(data.macros.fat) : 0}%</span>
        <span class="legend-item"><span class="legend-item__dot" style="--legend-color:#0A84FF"></span>Углеводы · ${total ? Math.round(data.macros.carbohydrates) : 0}%</span>
      </div>
    </article>`;
}

function weightChartCard(data) {
  if (!data.weight?.length) return '';
  return `
    <article class="card chart-card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Вес</h3>
          <p class="card__hint">Тренд важнее одной цифры</p>
        </div>
      </div>
      <div class="chart-wrap chart-wrap--sm">
        <canvas data-chart="weight" aria-label="График веса" role="img"></canvas>
      </div>
    </article>`;
}

function renderCaloriesChart(data) {
  const canvas = document.querySelector('[data-chart="calories"]');
  if (!canvas || !window.Chart) return;
  const labels = data.daily.map((day) => formatDateShort(day.date));
  const values = data.daily.map((day) => Number(day.calories) || 0);
  const goal = Number(data.goals.calories) || 0;
  const barColor = cssVar('--accent') || '#c9f96d';
  const goalColor = cssVar('--pink') || '#ff375f';

  makeChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Съедено',
          data: values,
          backgroundColor: values.map((value) =>
            value ? `${barColor}d9` : 'rgba(140,140,150,.18)',
          ),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 22,
        },
        {
          label: 'Цель',
          data: values.map(() => goal),
          type: 'line',
          borderColor: goalColor,
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
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
            label(context) {
              if (context.dataset.label === 'Цель') return `Цель: ${formatCalories(context.parsed.y)} ккал`;
              return `Съедено: ${formatCalories(context.parsed.y)} ккал`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: textColor(),
            font: { size: 9, family: cssVar('--font-sans') || 'sans-serif' },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(goal * 1.15, ...values, 100),
          grid: { color: gridColor(), drawTicks: false },
          border: { display: false },
          ticks: {
            color: textColor(),
            font: { size: 9, family: cssVar('--font-sans') || 'sans-serif' },
            maxTicksLimit: 4,
            callback: (value) => formatCalories(value),
          },
        },
      },
    },
  });
}

function renderMacroChart(data) {
  const canvas = document.querySelector('[data-chart="macros"]');
  if (!canvas || !window.Chart) return;
  const values = [
    Number(data.macros.protein) || 0,
    Number(data.macros.fat) || 0,
    Number(data.macros.carbohydrates) || 0,
  ];
  if (!values.some(Boolean)) return;

  makeChart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Белки', 'Жиры', 'Углеводы'],
      datasets: [
        {
          data: values,
          backgroundColor: ['#FF375F', '#FF9F0A', '#0A84FF'],
          borderWidth: 0,
          spacing: 3,
          borderRadius: 5,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
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
            label(context) {
              return `${context.label}: ${context.parsed}% калорий`;
            },
          },
        },
      },
    },
  });
}

function renderWeightChart(data) {
  const canvas = document.querySelector('[data-chart="weight"]');
  if (!canvas || !window.Chart) return;
  const points = (data.weight || []).filter((item) => Number(item.value) > 0);
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
            label(context) {
              return `${formatWeight(context.parsed.y)} кг`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: textColor(), font: { size: 9 }, maxTicksLimit: 6 },
        },
        y: {
          grid: { color: gridColor(), drawTicks: false },
          border: { display: false },
          ticks: {
            color: textColor(),
            font: { size: 9 },
            maxTicksLimit: 4,
            callback: (value) => `${formatWeight(value)}`,
          },
        },
      },
    },
  });
}

export async function mount(root, ctx) {
  destroy();
  root.innerHTML = `${screenHeader({
    eyebrow: 'Аналитика',
    title: 'Статистика',
    subtitle: 'Тенденции без оценок и сравнений',
  })}${segmented(PERIODS, period, 'data-stat-period')}${skeletonList(5)}`;
  refreshIcons(root);

  let data;
  try {
    data = await api.statistics(period);
  } catch (error) {
    if (!ctx.isActive()) return;
    root.innerHTML = `${screenHeader({ eyebrow: 'Аналитика', title: 'Статистика' })}${errorState(error?.message)}`;
    root.querySelector('[data-action="retry"]')?.addEventListener('click', () => ctx.refresh());
    refreshIcons(root);
    return;
  }

  if (!ctx.isActive()) return;

  if (!data.hasData) {
    root.innerHTML = `
      ${screenHeader({ eyebrow: 'Аналитика', title: 'Статистика', subtitle: 'Тенденции без оценок и сравнений' })}
      ${segmented(PERIODS, period, 'data-stat-period')}
      <article class="card">
        ${emptyState({
          iconName: 'chart-no-axes-combined',
          title: 'Пока не хватает данных',
          text: 'Добавьте несколько дней в дневник — здесь появятся средние значения, регулярность и графики.',
          action: `<button class="btn btn--primary btn--sm" type="button" data-action="go-diary">${icon('notebook-pen', '', 16)} Открыть дневник</button>`,
        })}
      </article>
      ${weightChartCard(data)}`;
    refreshIcons(root);
    requestAnimationFrame(() => renderWeightChart(data));
    bindPeriod(root, ctx);
    return;
  }

  root.innerHTML = `
    ${screenHeader({ eyebrow: 'Аналитика', title: 'Статистика', subtitle: 'Тенденции без оценок и сравнений' })}
    ${segmented(PERIODS, period, 'data-stat-period')}
    <div class="stack-16">
      ${kpiBlock(data)}
      ${caloriesChartCard()}
      ${macroChartCard(data)}
      ${weightChartCard(data)}
      <article class="card">
        <div class="row row--between">
          <div>
            <h3 class="card__title">Регулярность</h3>
            <p class="card__hint">${data.regularity.loggedDays} ${plural(data.regularity.loggedDays, 'день', 'дня', 'дней')} с записями из ${data.regularity.totalDays}</p>
          </div>
          <span class="badge ${data.regularity.percent >= 60 ? 'badge--accent' : 'badge--muted'}">${data.regularity.percent}%</span>
        </div>
        <div class="bar" style="margin-top:12px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${data.regularity.percent}">
          <span class="bar__fill" style="width:${Math.min(100, data.regularity.percent)}%"></span>
        </div>
        <p class="field__hint" style="margin-top:10px">
          Дни в пределах ±15% от цели: ${data.regularity.adherenceDays}. Это наблюдение, а не экзамен.
        </p>
      </article>
      <p class="disclaimer">
        ${icon('info', '', 16)}
        <span>Средние значения скрывают детали. Если цифры вызывают тревогу или ограничения в еде — обсудите это со специалистом.</span>
      </p>
    </div>`;

  refreshIcons(root);
  bindPeriod(root, ctx);
  requestAnimationFrame(() => {
    renderCaloriesChart(data);
    renderMacroChart(data);
    renderWeightChart(data);
  });
}

function bindPeriod(root, ctx) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stat-period]');
    if (button && button.dataset.statPeriod !== period) {
      period = button.dataset.statPeriod;
      ctx.refresh();
      return;
    }
    if (event.target.closest('[data-action="go-diary"]')) {
      ctx.navigate('diary');
    }
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
