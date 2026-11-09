import { api } from './api.js';
import { telegram } from './telegram.js';
import {
  MEAL_ICONS,
  MEAL_LABELS,
  escapeHtml,
  formatCalories,
  formatDateLong,
  formatDateShort,
  formatMacro,
  formatWeekday,
  mealFromHour,
  plural,
  todayInZone,
} from './utils.js';
import {
  confirmDialog,
  emptyState,
  errorState,
  icon,
  macroBar,
  openActionSheet,
  openSheet,
  refreshIcons,
  screenHeader,
  setBusy,
  skeletonList,
  toast,
} from './components.js';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
let selectedDate = null;

function mealSegmented(active, attribute = 'data-edit-meal') {
  return `<div class="segmented" role="tablist" aria-label="Приём пищи">
    ${MEALS.map(
      (meal) => `
      <button type="button" role="tab" class="segmented__item ${meal === active ? 'is-active' : ''}"
        ${attribute}="${meal}" aria-selected="${meal === active}">${MEAL_LABELS[meal]}</button>`,
    ).join('')}
  </div>`;
}

function macroSummary(goals, totals) {
  return `<div class="macro-grid">
    ${macroBar('protein', 'Белки', totals.protein, goals.protein, '#FF375F')}
    ${macroBar('fat', 'Жиры', totals.fat, goals.fat, '#FF9F0A')}
    ${macroBar('carbohydrates', 'Углеводы', totals.carbohydrates, goals.carbohydrates, '#0A84FF')}
  </div>`;
}

function entryRow(entry) {
  return `
    <div class="entry-row">
      <span class="entry-row__emoji" aria-hidden="true">🍽️</span>
      <span class="entry-row__body">
        <span class="entry-row__name">${escapeHtml(entry.productNameSnapshot)}</span>
        <span class="entry-row__amount">${formatMacro(entry.amountGrams)} г · Б ${formatMacro(entry.protein)} · Ж ${formatMacro(entry.fat)} · У ${formatMacro(entry.carbohydrates)}</span>
      </span>
      <span class="entry-row__kcal">${formatCalories(entry.calories)} <span>ккал</span></span>
      <button type="button" class="entry-row__menu" data-entry-menu="${escapeHtml(entry.id)}"
        aria-label="Действия с ${escapeHtml(entry.productNameSnapshot)}">${icon('more-horizontal', '', 16)}</button>
    </div>`;
}

function mealsHtml(diary) {
  return `<div class="meal-list">
    ${diary.meals
      .map((meal) => {
        const entries = meal.entries || [];
        const count = entries.length;
        return `
          <article class="meal-card">
            <div class="meal-card__head">
              <span class="meal-card__icon">${icon(MEAL_ICONS[meal.type] || 'utensils', '', 21)}</span>
              <span class="meal-card__body">
                <span class="meal-card__title">${escapeHtml(meal.label || MEAL_LABELS[meal.type])}</span>
                <span class="meal-card__meta">${
                  count
                    ? `${count} ${plural(count, 'запись', 'записи', 'записей')} · ${formatCalories(meal.totals.calories)} ккал`
                    : 'Ничего не записано'
                }</span>
              </span>
              <button type="button" class="meal-card__add" data-action="add-meal" data-meal="${meal.type}"
                aria-label="Добавить в ${escapeHtml((meal.label || '').toLowerCase())}">${icon('plus', '', 17)}</button>
            </div>
            ${
              count
                ? `<div class="meal-card__entries">${entries.map(entryRow).join('')}</div>`
                : `<p class="meal-card__empty">Можно добавить сейчас или вернуться позже.</p>`
            }
          </article>`;
      })
      .join('')}
  </div>`;
}

function copyCard(previous, date) {
  if (!previous?.count) return '';
  const meals = previous.meals || [];
  return `
    <article class="card card--accent">
      <div class="row row--between" style="align-items:flex-start;gap:12px">
        <div>
          <h3 class="card__title">Повторить предыдущий день</h3>
          <p class="card__hint">${escapeHtml(formatDateLong(previous.date))} · ${previous.count} ${plural(previous.count, 'запись', 'записи', 'записей')}</p>
        </div>
      </div>
      <div class="chip-row" style="margin-top:12px">
        ${meals
          .map(
            (meal) => `
          <button type="button" class="chip" data-action="copy-meal"
            data-source="${escapeHtml(previous.date)}" data-meal="${escapeHtml(meal.type)}">
            ${icon('copy', '', 14)} ${escapeHtml(meal.label)} · ${meal.count}
          </button>`,
          )
          .join('')}
        <button type="button" class="chip" data-action="copy-day" data-source="${escapeHtml(previous.date)}">
          ${icon('calendar-plus', '', 14)} Весь день · ${previous.count}
        </button>
      </div>
      <p class="field__hint" style="margin-top:10px">Можно перенести один приём пищи или весь день целиком.</p>
    </article>`;
}

function dateNavHtml(date, today) {
  const withYear = date.slice(0, 4) !== today.slice(0, 4);
  return `
    <nav class="date-nav" aria-label="Выбор дня">
      <button type="button" class="date-nav__btn" data-action="date-prev" aria-label="Предыдущий день">
        ${icon('chevron-left', '', 19)}
      </button>
      <button type="button" class="date-nav__label" data-action="pick-date" aria-label="Выбрать дату">
        <span class="date-nav__title">${escapeHtml(formatDateLong(date, { withYear }))}</span>
        <span class="date-nav__sub">${escapeHtml(formatWeekday(date, false))} · ${escapeHtml(formatDateShort(date))}</span>
      </button>
      ${
        date === today
          ? `<button type="button" class="date-nav__today" data-action="date-next" disabled style="opacity:.35">Сегодня</button>`
          : `<button type="button" class="date-nav__btn" data-action="date-next" aria-label="Следующий день">${icon('chevron-right', '', 19)}</button>`
      }
    </nav>`;
}

function openDateSheet(date, today, onPick) {
  const content = document.createElement('div');
  content.innerHTML = `
    <label class="field">
      <span class="field__label">Дата</span>
      <input class="input" type="date" max="${today}" value="${date}" data-date-input />
    </label>
    <p class="field__hint" style="margin-top:8px">Можно выбрать сегодня или любой прошедший день.</p>
    <button class="btn btn--primary btn--block" type="button" data-action="apply-date" style="margin-top:18px">
      ${icon('calendar-days', '', 18)} Перейти к дню
    </button>`;
  const sheet = openSheet({ title: 'Выбрать день', subtitle: 'Дневник питания', content });
  refreshIcons(content);
  content.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="apply-date"]')) return;
    const value = content.querySelector('[data-date-input]')?.value;
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      toast('Выберите корректную дату', 'error');
      return;
    }
    if (value > today) {
      toast('Нельзя открыть будущий день', 'warning');
      return;
    }
    sheet.close();
    onPick(value);
  });
}

function openEditEntry(entry, ctx) {
  const content = document.createElement('div');
  const basePerGram = Number(entry.amountGrams) > 0 ? Number(entry.calories) / Number(entry.amountGrams) : 0;
  let currentMeal = entry.mealType;
  content.innerHTML = `
    <div class="portion-summary">
      <div class="portion-summary__emoji" aria-hidden="true">🍽️</div>
      <div class="grow">
        <div class="portion-summary__value"><span data-edit-calories>${formatCalories(entry.calories)}</span><span> ккал</span></div>
        <div class="portion-summary__meta">${escapeHtml(entry.productNameSnapshot)}</div>
      </div>
    </div>
    <div class="form-section">
      <label class="field">
        <span class="field__label">Количество</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="0.1" max="5000" step="1"
            value="${formatMacro(entry.amountGrams)}" data-edit-amount />
          <span class="input-wrap__suffix">грамм</span>
        </div>
      </label>
      <span class="field__label">Приём пищи</span>
      ${mealSegmented(currentMeal)}
    </div>
    <p class="field__error" data-edit-error hidden></p>
    <button class="btn btn--primary btn--block" type="button" data-action="save-entry" style="margin-top:16px">
      ${icon('check', '', 18)} Сохранить изменения
    </button>
    <button class="btn btn--ghost btn--block" type="button" data-action="delete-entry" style="margin-top:8px;color:var(--danger)">
      ${icon('trash-2', '', 17)} Удалить запись
    </button>`;
  const sheet = openSheet({
    title: 'Запись',
    subtitle: entry.productNameSnapshot,
    content,
  });
  refreshIcons(content);

  const updateCalories = () => {
    const input = content.querySelector('[data-edit-amount]');
    const value = Number(input?.value) || 0;
    const node = content.querySelector('[data-edit-calories]');
    if (node) node.textContent = formatCalories(basePerGram * value);
  };

  content.addEventListener('input', (event) => {
    if (event.target.matches('[data-edit-amount]')) updateCalories();
  });

  content.addEventListener('click', async (event) => {
    const mealButton = event.target.closest('[data-edit-meal]');
    if (mealButton) {
      currentMeal = mealButton.dataset.editMeal;
      content.querySelectorAll('[data-edit-meal]').forEach((button) => {
        const active = button === mealButton;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
      });
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'save-entry') {
      const grams = Number(content.querySelector('[data-edit-amount]')?.value);
      const errorNode = content.querySelector('[data-edit-error]');
      if (!Number.isFinite(grams) || grams < 0.1 || grams > 5000) {
        if (errorNode) {
          errorNode.hidden = false;
          errorNode.textContent = 'Количество должно быть от 0,1 до 5000 г.';
        }
        return;
      }
      const button = event.target.closest('[data-action="save-entry"]');
      setBusy(button, true, 'Сохраняем…');
      try {
        await api.updateEntry(entry.id, { amountGrams: grams, mealType: currentMeal });
        telegram.haptic('success');
        toast('Запись обновлена', 'success');
        sheet.close();
        ctx.refresh();
      } catch (error) {
        setBusy(button, false);
        if (errorNode) {
          errorNode.hidden = false;
          errorNode.textContent = error?.message || 'Не удалось обновить запись.';
        }
      }
      return;
    }

    if (action === 'delete-entry') {
      const confirmed = await confirmDialog({
        title: 'Удалить запись?',
        message: `«${entry.productNameSnapshot}» исчезнет из дневника. Это действие нельзя отменить.`,
        confirmText: 'Удалить',
        danger: true,
      });
      if (!confirmed) return;
      try {
        await api.deleteEntry(entry.id);
        telegram.haptic('success');
        toast('Запись удалена', 'success');
        sheet.close();
        ctx.refresh();
      } catch (error) {
        toast(error?.message || 'Не удалось удалить запись', 'error');
      }
    }
  });
}

export async function mount(root, ctx) {
  const timezone = ctx.state.user?.timezone || ctx.state.timezone;
  const today = todayInZone(timezone);
  const pending = ctx.takePendingDiaryDate?.();
  if (pending) selectedDate = pending;
  if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) || selectedDate > today) {
    selectedDate = today;
  }

  const date = selectedDate;

  root.innerHTML = `
    ${screenHeader({ eyebrow: 'Питание', title: 'Дневник', subtitle: 'Спокойная история вашего дня' })}
    ${skeletonList(6)}`;
  refreshIcons(root);

  let diary;
  let previous = null;
  try {
    [diary, previous] = await Promise.all([
      api.diary(date),
      api.previousDay(date).catch(() => null),
    ]);
  } catch (error) {
    if (!ctx.isActive()) return;
    root.innerHTML = `${screenHeader({ eyebrow: 'Питание', title: 'Дневник' })}${errorState(error?.message)}`;
    root.querySelector('[data-action="retry"]')?.addEventListener('click', () => ctx.refresh());
    refreshIcons(root);
    return;
  }

  if (!ctx.isActive()) return;

  const entries = diary.entries || [];
  const entryIndex = new Map(entries.map((entry) => [String(entry.id), entry]));
  const remaining = Math.round(Number(diary.remaining?.calories) || 0);
  const over = Number(diary.totals.calories) > Number(diary.goals.calories);
  const pct = Math.min(100, Math.max(0, (Number(diary.totals.calories) / Math.max(1, diary.goals.calories)) * 100));

  root.innerHTML = `
    ${screenHeader({ eyebrow: 'Питание', title: 'Дневник', subtitle: 'Спокойная история вашего дня' })}
    <div class="stack-16">
      ${dateNavHtml(date, today)}
      <article class="card">
        <div class="calorie-mini">
          <div class="calorie-mini__bar" role="progressbar" aria-valuemin="0" aria-valuemax="${diary.goals.calories}" aria-valuenow="${diary.totals.calories}">
            <span style="width:${pct}%"></span>
          </div>
          <span class="calorie-mini__value">${formatCalories(diary.totals.calories)} / ${formatCalories(diary.goals.calories)} <span>ккал</span></span>
        </div>
        <div class="insight-row">
          ${icon(over ? 'alert-triangle' : 'target', '', 15)}
          <span>${over ? `Выше цели на <b>${formatCalories(Math.abs(remaining))} ккал</b>. Это просто информация, не оценка.` : `До цели осталось <b>${formatCalories(Math.max(0, remaining))} ккал</b>.`}</span>
        </div>
        <div style="margin-top:12px">${macroSummary(diary.goals, diary.totals)}</div>
      </article>
      ${copyCard(previous, date)}
      ${mealsHtml(diary)}
      ${
        entries.length
          ? ''
          : `<article class="card">${emptyState({
              iconName: 'notebook-pen',
              title: 'Этот день пока пуст',
              text: 'Добавьте первый приём пищи — даже одна запись делает картину яснее.',
              action: `<button class="btn btn--primary btn--sm" type="button" data-action="add-food">${icon('plus', '', 16)} Добавить продукт</button>`,
            })}</article>`
      }
      <p class="disclaimer">
        ${icon('info', '', 16)}
        <span>Дневник — инструмент наблюдения, а не отчёт. Пропущенный день не отменяет прогресс.</span>
      </p>
    </div>
    <button type="button" class="fab" data-action="add-food" aria-label="Добавить продукт">
      ${icon('plus', '', 24)}
    </button>`;

  refreshIcons(root);

  function openPicker(meal) {
    ctx.openFoodPicker({
      date,
      mealType: meal,
      onAdded: () => ctx.refresh(),
    });
  }

  root.addEventListener('click', async (event) => {
    const menuButton = event.target.closest('[data-entry-menu]');
    if (menuButton) {
      const entry = entryIndex.get(String(menuButton.dataset.entryMenu));
      if (!entry) return;
      openActionSheet({
        title: entry.productNameSnapshot,
        actions: [
          {
            label: 'Изменить порцию',
            hint: `${formatMacro(entry.amountGrams)} г`,
            icon: 'pencil',
            onSelect: () => openEditEntry(entry, ctx),
          },
          {
            label: 'Удалить запись',
            icon: 'trash-2',
            danger: true,
            onSelect: async () => {
              const confirmed = await confirmDialog({
                title: 'Удалить запись?',
                message: `«${entry.productNameSnapshot}» исчезнет из дневника.`,
                confirmText: 'Удалить',
                danger: true,
              });
              if (!confirmed) return;
              try {
                await api.deleteEntry(entry.id);
                toast('Запись удалена', 'success');
                ctx.refresh();
              } catch (error) {
                toast(error?.message || 'Не удалось удалить запись', 'error');
              }
            },
          },
        ],
      });
      return;
    }

    const actionNode = event.target.closest('[data-action]');
    const action = actionNode?.dataset.action;
    if (!action) return;

    if (action === 'add-food') {
      openPicker(date === today ? mealFromHour() : 'lunch');
      return;
    }
    if (action === 'add-meal') {
      openPicker(actionNode.dataset.meal);
      return;
    }
    if (action === 'date-prev') {
      const previousDate = new Date(`${date}T12:00:00Z`);
      previousDate.setUTCDate(previousDate.getUTCDate() - 1);
      selectedDate = previousDate.toISOString().slice(0, 10);
      ctx.refresh();
      return;
    }
    if (action === 'date-next') {
      if (date >= today) return;
      const nextDate = new Date(`${date}T12:00:00Z`);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      selectedDate = nextDate.toISOString().slice(0, 10);
      if (selectedDate > today) selectedDate = today;
      ctx.refresh();
      return;
    }
    if (action === 'pick-date') {
      openDateSheet(date, today, (next) => {
        selectedDate = next;
        ctx.refresh();
      });
      return;
    }
    if (action === 'copy-day' || action === 'copy-meal') {
      const source = actionNode.dataset.source;
      if (!source) return;
      const mealType = action === 'copy-meal' ? actionNode.dataset.meal : null;
      const mealLabel = mealType ? MEAL_LABELS[mealType] : null;
      const confirmed = await confirmDialog({
        title: mealType ? `Повторить: ${mealLabel.toLowerCase()}?` : 'Повторить день?',
        message: mealType
          ? `${mealLabel} за ${formatDateLong(source).toLowerCase()} будет добавлен на ${formatDateLong(date).toLowerCase()}.`
          : `Записи за ${formatDateLong(source).toLowerCase()} будут добавлены на ${formatDateLong(date).toLowerCase()}.`,
        confirmText: 'Скопировать',
      });
      if (!confirmed) return;
      setBusy(actionNode, true, 'Копируем…');
      try {
        const payload = { fromDate: source, toDate: date };
        if (mealType) payload.mealType = mealType;
        const result = await api.copyDay(payload);
        telegram.haptic('success');
        toast(`Добавлено записей: ${result.count}`, 'success', {
          title: mealType ? `${mealLabel} скопирован` : 'День скопирован',
        });
        ctx.refresh();
      } catch (error) {
        setBusy(actionNode, false);
        toast(error?.message || 'Не удалось скопировать записи', 'error');
      }
      return;
    }
    if (action === 'retry') {
      ctx.refresh();
    }
  }, { signal: ctx.signal });
}

export function destroy() {
  // Keep the selected date between visits; it is validated on the next mount.
}
