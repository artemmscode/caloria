import { api } from './api.js';
import { telegram } from './telegram.js';
import {
  escapeHtml,
  formatCalories,
  formatDateLong,
  formatMacro,
  formatWeekday,
  greeting,
  mealFromHour,
  MEAL_ICONS,
  MEAL_LABELS,
  plural,
  todayInZone,
} from './utils.js';
import {
  calorieRing,
  emptyState,
  errorState,
  icon,
  macroBar,
  openSheet,
  refreshIcons,
  setBusy,
  skeletonDashboard,
  toast,
} from './components.js';

function macroGrid(goals, totals) {
  return `<div class="macro-grid">
    ${macroBar('protein', 'Белки', totals.protein, goals.protein, '#FF375F')}
    ${macroBar('fat', 'Жиры', totals.fat, goals.fat, '#FF9F0A')}
    ${macroBar('carbohydrates', 'Углеводы', totals.carbohydrates, goals.carbohydrates, '#0A84FF')}
  </div>`;
}

function waterCard(water) {
  const amount = Number(water.amountMl) || 0;
  const goal = Math.max(1, Number(water.goalMl) || 2000);
  const pct = Math.min(100, Math.round((amount / goal) * 100));
  return `
    <article class="card water-card" data-water-card>
      <span class="water-card__icon">${icon('droplets', '', 23)}</span>
      <div class="water-card__body">
        <div class="water-card__top">
          <span class="water-card__value"><span data-water-value>${formatCalories(amount)}</span><span> мл</span></span>
          <span class="water-card__goal">из ${formatCalories(goal)} мл</span>
        </div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${amount}" aria-label="Выпито воды">
          <span class="bar__fill" data-water-bar style="width:${pct}%"></span>
        </div>
        <div class="water-card__actions">
          <button type="button" class="quick-btn" data-action="water-add" data-amount="250">+250 мл</button>
          <button type="button" class="quick-btn" data-action="water-add" data-amount="500">+500 мл</button>
          <button type="button" class="quick-btn quick-btn--muted" data-action="water-custom">Другое</button>
        </div>
      </div>
    </article>`;
}

function weekChart(week, goal, date) {
  const max = Math.max(1, Number(goal) || 0, ...week.map((day) => Number(day.calories) || 0));
  return `
    <article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Последние 7 дней</h3>
          <p class="card__hint">Калории по дням</p>
        </div>
        <button type="button" class="card__link" data-action="open-stats">Статистика</button>
      </div>
      <div class="week-chart" role="list">
        ${week
          .map((day) => {
            const value = Number(day.calories) || 0;
            const height = value > 0 ? Math.min(100, Math.max(8, (value / max) * 100)) : 3;
            const isToday = day.date === date;
            return `
              <button type="button" class="week-bar ${isToday ? 'is-today' : ''} ${value ? '' : 'is-empty'}"
                role="listitem" data-week-date="${day.date}"
                title="${escapeHtml(formatDateLong(day.date))}: ${formatCalories(value)} ккал"
                aria-label="${escapeHtml(formatDateLong(day.date))}: ${formatCalories(value)} ккал">
                <span class="week-bar__track"><span class="week-bar__fill" style="height:${height}%"></span></span>
                <span class="week-bar__label">${escapeHtml(formatWeekday(day.date))}</span>
              </button>`;
          })
          .join('')}
      </div>
    </article>`;
}

function mealCards(meals, date) {
  return `
    <div class="meal-list">
      ${meals
        .map((meal) => {
          const count = Number(meal.count) || 0;
          const kcal = meal.totals?.calories || 0;
          const macros = meal.totals || {};
          return `
            <article class="meal-card">
              <div class="meal-card__head">
                <span class="meal-card__icon">${icon(MEAL_ICONS[meal.type] || 'utensils', '', 21)}</span>
                <span class="meal-card__body">
                  <span class="meal-card__title">${escapeHtml(meal.label || MEAL_LABELS[meal.type])}</span>
                  <span class="meal-card__meta">${
                    count
                      ? `${count} ${plural(count, 'запись', 'записи', 'записей')} · Б ${formatMacro(macros.protein)} · Ж ${formatMacro(macros.fat)} · У ${formatMacro(macros.carbohydrates)}`
                      : 'Пока пусто — это нормально'
                  }</span>
                </span>
                <span class="meal-card__kcal">${formatCalories(kcal)} <span>ккал</span></span>
                <button type="button" class="meal-card__add" data-action="add-meal" data-meal="${meal.type}"
                  aria-label="Добавить в ${escapeHtml((meal.label || '').toLowerCase())}">${icon('plus', '', 17)}</button>
              </div>
            </article>`;
        })
        .join('')}
    </div>`;
}

function recentCard(recentFoods) {
  if (!recentFoods?.length) {
    return `
      <article class="card">
        ${emptyState({
          iconName: 'sparkles',
          title: 'Начните с первого продукта',
          text: 'Добавьте то, что уже съели сегодня. Даже примерная запись лучше, чем ничего.',
          action: `<button class="btn btn--primary btn--sm" type="button" data-action="add-food">${icon('plus', '', 16)} Добавить продукт</button>`,
        })}
      </article>`;
  }

  return `
    <article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Недавние продукты</h3>
          <p class="card__hint">Быстро вернуть в дневник</p>
        </div>
      </div>
      <div class="list">
        ${recentFoods
          .map(
            (food) => `
          <button type="button" class="food-row" data-action="quick-food" data-food-id="${escapeHtml(food.id)}">
            <span class="food-row__emoji" aria-hidden="true">${escapeHtml(food.emoji || '🍽️')}</span>
            <span class="food-row__main">
              <span class="food-row__name">${escapeHtml(food.name)}</span>
              <span class="food-row__meta">${
                food.lastAmountGrams ? `Последняя порция: ${formatMacro(food.lastAmountGrams)} г` : escapeHtml(food.category || 'Продукт')
              }</span>
            </span>
            <span class="food-row__kcal">
              <strong>${formatCalories(food.calories)}</strong>
              <span>ккал / 100 г</span>
            </span>
            <span class="food-row__add" aria-hidden="true">${icon('plus', '', 16)}</span>
          </button>`,
          )
          .join('')}
      </div>
    </article>`;
}

function heroHtml(data) {
  const name = data.user?.firstName ? `, ${escapeHtml(data.user.firstName)}` : '';
  const streak = Number(data.streak?.current) || 0;
  const over = Number(data.totals.calories) > Number(data.goals.calories);
  const remaining = Math.round(Number(data.remaining?.calories) || 0);

  return `
    <section class="card hero">
      <div class="hero__top">
        <div>
          <p class="hero__greeting">${escapeHtml(formatDateLong(data.date))}</p>
          <p class="hero__name">${escapeHtml(greeting())}${name}</p>
        </div>
        <span class="hero__badge">
          ${icon('flame', '', 14)}
          ${streak > 0 ? `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд` : 'Новый старт'}
        </span>
      </div>
      ${calorieRing({
        consumed: data.totals.calories,
        goal: data.goals.calories,
        remaining,
        over,
        percent: data.percent,
      })}
      <div class="hero__footer">
        <span class="hero__stat">
          <strong>${over ? `+${formatCalories(Math.abs(remaining))}` : formatCalories(Math.max(0, remaining))}</strong>
          <span>${over ? 'сверх цели' : 'осталось'}</span>
        </span>
        <span class="hero__divider" aria-hidden="true"></span>
        <span class="hero__stat">
          <strong>${formatCalories(data.mealCount)}</strong>
          <span>${plural(data.mealCount, 'запись', 'записи', 'записей')}</span>
        </span>
        <span class="hero__divider" aria-hidden="true"></span>
        <span class="hero__stat">
          <strong>${formatCalories(data.water?.amountMl)}</strong>
          <span>мл воды</span>
        </span>
      </div>
    </section>`;
}

export async function mount(root, ctx) {
  const timezone = ctx.state.user?.timezone || ctx.state.timezone;
  const date = todayInZone(timezone);

  root.innerHTML = `
    ${skeletonDashboard()}`;
  refreshIcons(root);

  let data;
  try {
    data = await api.dashboard(date);
  } catch (error) {
    if (!ctx.isActive()) return;
    root.innerHTML = errorState(error?.message);
    root.querySelector('[data-action="retry"]')?.addEventListener('click', () => ctx.refresh());
    refreshIcons(root);
    return;
  }

  if (!ctx.isActive()) return;

  const today = data.date || date;
  const recentIndex = new Map((data.recentFoods || []).map((food) => [String(food.id), food]));

  root.innerHTML = `
    <div class="stack-16">
      ${heroHtml(data)}
      ${macroGrid(data.goals, data.totals)}
      ${waterCard(data.water || { amountMl: 0, goalMl: data.goals.waterMl || 2000 })}
      ${weekChart(data.week, data.goals.calories, today)}
      <div>
        <div class="row row--between" style="margin-bottom:10px">
          <h2 style="font-size:16px">Приёмы пищи</h2>
          <button type="button" class="card__link" data-action="open-diary">Весь дневник</button>
        </div>
        ${mealCards(data.meals, today)}
      </div>
      ${recentCard(data.recentFoods)}
      <div class="disclaimer">
        ${icon('info', '', 16)}
        <span>Ориентиры рассчитаны по формуле и не являются медицинской рекомендацией. Слушайте тело и обращайтесь к специалисту при сомнениях.</span>
      </div>
    </div>
    <button type="button" class="fab" data-action="add-food" aria-label="Добавить продукт">
      ${icon('plus', '', 24)}
    </button>`;

  refreshIcons(root);

  function openPicker(meal, food = null) {
    ctx.openFoodPicker({
      date: today,
      mealType: meal,
      initialFood: food,
      onAdded: () => ctx.refresh(),
    });
  }

  async function addWater(amountMl, { reset = false } = {}) {
    try {
      const water = await api.addWater({
        date: today,
        amountMl: reset ? 0 : Math.round(Number(amountMl)),
        mode: reset ? 'set' : 'add',
      });
      data.water = { amountMl: water.amountMl, goalMl: water.goalMl || data.water.goalMl };
      const valueNode = root.querySelector('[data-water-value]');
      const barNode = root.querySelector('[data-water-bar]');
      const card = root.querySelector('[data-water-card]');
      const goal = Math.max(1, Number(water.goalMl) || 2000);
      if (valueNode) valueNode.textContent = formatCalories(water.amountMl);
      if (barNode) barNode.style.width = `${Math.min(100, Math.round((Number(water.amountMl) / goal) * 100))}%`;
      if (card) {
        const progress = card.querySelector('.bar');
        progress?.setAttribute('aria-valuenow', String(water.amountMl));
      }
      telegram.haptic('light');
    } catch (error) {
      toast(error?.message || 'Не удалось сохранить воду', 'error');
    }
  }

  root.addEventListener('click', async (event) => {
    const actionNode = event.target.closest('[data-action]');
    const action = actionNode?.dataset.action;

    if (action === 'add-food') {
      openPicker(mealFromHour());
      return;
    }
    if (action === 'add-meal') {
      openPicker(actionNode.dataset.meal);
      return;
    }
    if (action === 'open-diary') {
      ctx.navigate('diary');
      return;
    }
    if (action === 'open-stats') {
      ctx.navigate('statistics');
      return;
    }
    if (action === 'quick-food') {
      const food = recentIndex.get(String(actionNode.dataset.foodId));
      if (food) openPicker(food.lastMealType || mealFromHour(), food);
      return;
    }
    if (action === 'water-add') {
      actionNode.disabled = true;
      await addWater(actionNode.dataset.amount);
      actionNode.disabled = false;
      return;
    }
    if (action === 'water-custom') {
      const content = document.createElement('div');
      content.innerHTML = `
        <label class="field">
          <span class="field__label">Сколько воды добавить?</span>
          <div class="input-wrap">
            <input class="input" type="number" inputmode="numeric" min="1" max="5000" step="50" value="250" data-water-input />
            <span class="input-wrap__suffix">мл</span>
          </div>
        </label>
        <div class="chip-row" style="margin-top:10px">
          ${[200, 250, 300, 400, 500]
            .map((value) => `<button type="button" class="chip" data-water-quick="${value}">${value} мл</button>`)
            .join('')}
        </div>
        <p class="field__hint" style="margin-top:10px">Сегодня уже выпито ${formatCalories(data.water.amountMl)} мл.</p>
        <div class="button-row" style="margin-top:18px">
          <button type="button" class="btn btn--ghost" data-action="water-reset">Сбросить</button>
          <button type="button" class="btn btn--primary" data-action="water-save">Добавить</button>
        </div>`;
      const sheet = openSheet({
        title: 'Вода',
        subtitle: `Цель ${formatCalories(data.water.goalMl)} мл`,
        content,
      });
      refreshIcons(content);

      content.addEventListener('click', async (inner) => {
        const quick = inner.target.closest('[data-water-quick]');
        if (quick) {
          const input = content.querySelector('[data-water-input]');
          if (input) input.value = quick.dataset.waterQuick;
          content.querySelectorAll('[data-water-quick]').forEach((chip) => chip.classList.remove('is-active'));
          quick.classList.add('is-active');
          return;
        }
        const innerAction = inner.target.closest('[data-action]')?.dataset.action;
        if (!innerAction) return;
        if (innerAction === 'water-reset') {
          sheet.close();
          await addWater(0, { reset: true });
          toast('Счётчик воды сброшен', 'info', { duration: 2000 });
        }
        if (innerAction === 'water-save') {
          const value = Number(content.querySelector('[data-water-input]')?.value);
          if (!Number.isFinite(value) || value < 1 || value > 5000) {
            toast('Введите количество от 1 до 5000 мл', 'error');
            return;
          }
          const button = inner.target.closest('[data-action="water-save"]');
          setBusy(button, true, 'Сохраняем…');
          sheet.close();
          await addWater(value);
        }
      });
      return;
    }
    if (action === 'retry') {
      ctx.refresh();
    }
  }, { signal: ctx.signal });

  root.addEventListener('click', (event) => {
    const week = event.target.closest('[data-week-date]');
    if (week) ctx.openDiary(week.dataset.weekDate);
  }, { signal: ctx.signal });
}

export function destroy() {
  // No chart instances or global listeners are kept between mounts.
}
