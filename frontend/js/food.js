import { api } from './api.js';
import { telegram } from './telegram.js';
import {
  MEAL_LABELS,
  debounce,
  escapeHtml,
  formatCalories,
  formatDateLong,
  formatMacro,
  mealFromHour,
  todayInZone,
} from './utils.js';
import {
  emptyState,
  icon,
  openSheet,
  refreshIcons,
  setBusy,
  skeletonList,
  toast,
} from './components.js';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function emojiOf(food) {
  return food?.emoji || '🍽️';
}

function per100(food) {
  return `${formatCalories(food.calories)} ккал · Б ${formatMacro(food.protein)} · Ж ${formatMacro(food.fat)} · У ${formatMacro(food.carbohydrates)}`;
}

function scaled(food, grams) {
  const factor = Math.max(0, Number(grams) || 0) / 100;
  return {
    calories: Math.round(Number(food.calories || 0) * factor * 10) / 10,
    protein: Math.round(Number(food.protein || 0) * factor * 10) / 10,
    fat: Math.round(Number(food.fat || 0) * factor * 10) / 10,
    carbohydrates: Math.round(Number(food.carbohydrates || 0) * factor * 10) / 10,
  };
}

function foodRow(food) {
  return `
    <button type="button" class="food-row" data-food-id="${escapeHtml(food.id)}">
      <span class="food-row__emoji" aria-hidden="true">${escapeHtml(emojiOf(food))}</span>
      <span class="food-row__main">
        <span class="food-row__name">${escapeHtml(food.name)}</span>
        <span class="food-row__meta">${escapeHtml(food.category || 'Продукт')} · ${per100(food)}</span>
      </span>
      <span class="food-row__kcal">
        <strong>${formatCalories(food.calories)}</strong>
        <span>ккал / 100 г</span>
      </span>
      <span class="food-row__add" aria-hidden="true">${icon('plus', '', 16)}</span>
    </button>`;
}

function mealSegmented(active) {
  return `<div class="segmented" role="tablist" aria-label="Приём пищи">
    ${MEALS.map(
      (meal) => `
      <button type="button" role="tab" class="segmented__item ${meal === active ? 'is-active' : ''}"
        data-portion-meal="${meal}" aria-selected="${meal === active}">${MEAL_LABELS[meal]}</button>`,
    ).join('')}
  </div>`;
}

/**
 * Opens a full-height food picker. Pass `initialFood` to jump straight to the
 * portion editor (for recent-food shortcuts).
 */
export function openFoodPicker({
  date,
  mealType,
  initialFood = null,
  onAdded = null,
  title = 'Добавить продукт',
} = {}) {
  const day = date || todayInZone();
  let currentMeal = MEALS.includes(mealType) ? mealType : mealFromHour();
  let view = initialFood ? 'portion' : 'list';
  let tab = 'recent';
  let query = '';
  let discovery = { recent: [], favorites: [], popular: [] };
  let discoveryState = 'loading';
  let discoveryError = '';
  let results = [];
  let searchState = 'idle';
  let searchError = '';
  let searchSeq = 0;
  let favorites = new Set();
  let activeFood = initialFood;
  let amount = initialFood
    ? Number(initialFood.lastAmountGrams || initialFood.defaultServingGrams || 100)
    : 100;
  let portionError = '';
  let saving = false;
  let favoriteBusy = false;
  let customError = '';
  let customSaving = false;

  const content = document.createElement('div');
  content.className = 'food-picker';

  const sheet = openSheet({
    title,
    subtitle: `${formatDateLong(day)} · ${MEAL_LABELS[currentMeal]}`,
    content,
    className: 'food-sheet sheet--tall',
  });

  const titleEl = sheet.layer.querySelector('.sheet__title');
  const subtitleEl = sheet.layer.querySelector('.sheet__subtitle');
  const body = sheet.body;

  const foodIndex = new Map();
  const indexFoods = (items) => {
    for (const food of items || []) if (food?.id) foodIndex.set(String(food.id), food);
  };

  function setHeader(nextTitle, nextSubtitle) {
    if (titleEl) titleEl.textContent = nextTitle;
    if (subtitleEl) subtitleEl.textContent = nextSubtitle || '';
  }

  function resetScroll() {
    body.scrollTop = 0;
  }

  function currentList() {
    if (tab === 'search') return results;
    return discovery[tab] || [];
  }

  function listEmptyHtml() {
    if (discoveryState === 'loading') return skeletonList(4);
    if (discoveryState === 'error') {
      return `<div class="error-state">
        <div class="error-state__icon">${icon('wifi-off', '', 24)}</div>
        <h3>Не удалось загрузить продукты</h3>
        <p>${escapeHtml(discoveryError || 'Проверьте соединение и попробуйте снова.')}</p>
        <button class="btn btn--secondary" type="button" data-action="retry-discovery">${icon('refresh-cw', '', 16)} Повторить</button>
      </div>`;
    }
    if (tab === 'search') {
      return emptyState({
        iconName: 'search',
        title: 'Ничего не найдено',
        text: 'Попробуйте другое название или создайте свой продукт.',
      });
    }
    if (tab === 'favorites') {
      return emptyState({
        iconName: 'star',
        title: 'Пока нет избранного',
        text: 'Откройте продукт и нажмите «В избранное» — он появится здесь.',
      });
    }
    if (tab === 'recent') {
      return emptyState({
        iconName: 'clock',
        title: 'Здесь появятся недавние',
        text: 'Добавьте первый продукт, и он будет под рукой.',
      });
    }
    return emptyState({
      iconName: 'sparkles',
      title: 'Каталог загружается',
      text: 'Попробуйте обновить список.',
      action: `<button class="btn btn--secondary btn--sm" type="button" data-action="retry-discovery">Обновить</button>`,
    });
  }

  function resultsHtml() {
    if (tab !== 'search' && discoveryState === 'loading') return skeletonList(4);
    if (tab !== 'search' && discoveryState === 'error') return listEmptyHtml();

    if (tab === 'search') {
      if (searchState === 'loading') return skeletonList(5);
      if (searchState === 'error') {
        return `<div class="error-state">
          <div class="error-state__icon">${icon('wifi-off', '', 24)}</div>
          <h3>Поиск не сработал</h3>
          <p>${escapeHtml(searchError || 'Проверьте соединение и попробуйте снова.')}</p>
          <button class="btn btn--secondary" type="button" data-action="retry-search">${icon('refresh-cw', '', 16)} Повторить</button>
        </div>`;
      }
    }

    const items = currentList();
    if (!items.length) return listEmptyHtml();
    if (tab === 'search') indexFoods(items);
    return `<div class="food-results">${items.map(foodRow).join('')}</div>`;
  }

  function shellHtml() {
    return `
      <div class="search-field">
        ${icon('search', '', 18)}
        <input class="input" type="search" inputmode="search" autocomplete="off"
          data-food-search value="${escapeHtml(query)}" placeholder="Например, банан или творог" aria-label="Поиск продукта" />
      </div>
      <div class="segmented food-tabs" role="tablist">
        <button type="button" role="tab" class="segmented__item ${tab === 'recent' ? 'is-active' : ''}"
          data-food-tab="recent" aria-selected="${tab === 'recent'}">Недавние</button>
        <button type="button" role="tab" class="segmented__item ${tab === 'favorites' ? 'is-active' : ''}"
          data-food-tab="favorites" aria-selected="${tab === 'favorites'}">Избранное</button>
        <button type="button" role="tab" class="segmented__item ${tab === 'popular' ? 'is-active' : ''}"
          data-food-tab="popular" aria-selected="${tab === 'popular'}">Популярное</button>
      </div>
      <div data-food-results>${resultsHtml()}</div>
      <button class="btn btn--secondary btn--block" type="button" data-action="custom-food" style="margin-top:14px">
        ${icon('plus', '', 18)} Создать свой продукт
      </button>
      <p class="field__hint" style="margin-top:12px;text-align:center">
        Значения указаны на 100 г и носят ориентировочный характер.
      </p>`;
  }

  function renderList({ focusSearch = false } = {}) {
    view = 'list';
    activeFood = null;
    setHeader(title, `${formatDateLong(day)} · ${MEAL_LABELS[currentMeal]}`);
    body.innerHTML = shellHtml();
    refreshIcons(body);
    if (focusSearch) {
      const input = body.querySelector('[data-food-search]');
      input?.focus();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    }
    resetScroll();
  }

  function syncTabs() {
    body.querySelectorAll('[data-food-tab]').forEach((button) => {
      const active = button.dataset.foodTab === tab && tab !== 'search';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function renderResults() {
    const container = body.querySelector('[data-food-results]');
    if (!container) return;
    syncTabs();
    container.innerHTML = resultsHtml();
    indexFoods(currentList());
    refreshIcons(container);
  }

  function portionHtml() {
    const food = activeFood;
    const nutrition = scaled(food, amount);
    const favorite = favorites.has(String(food.id));
    const piece = Number(food.pieceGrams) > 0 ? Number(food.pieceGrams) : null;
    const servings = [
      { label: '50 г', value: 50 },
      { label: '100 г', value: 100 },
      { label: '150 г', value: 150 },
      { label: '200 г', value: 200 },
    ];
    if (piece && !servings.some((item) => item.value === piece)) {
      servings.push({ label: `1 шт · ${piece} г`, value: piece });
    }

    return `
      <button class="btn btn--ghost btn--sm" type="button" data-action="back-to-list" style="margin-bottom:8px;padding-left:0">
        ${icon('chevron-left', '', 17)} Все продукты
      </button>
      <div class="portion-summary">
        <div class="portion-summary__emoji" aria-hidden="true">${escapeHtml(emojiOf(food))}</div>
        <div class="grow">
          <div class="portion-summary__value"><span data-live-calories>${formatCalories(nutrition.calories)}</span><span> ккал</span></div>
          <div class="portion-summary__meta">${escapeHtml(food.name)} · ${per100(food)}</div>
        </div>
        ${
          food.id
            ? `<button class="icon-btn" type="button" data-action="favorite" aria-label="${favorite ? 'Убрать из избранного' : 'В избранное'}"
                style="${favorite ? 'color:var(--accent);background:var(--accent-soft)' : ''}">
                ${icon('star', '', 19)}
              </button>`
            : ''
        }
      </div>

      <div class="portion-macros">
        <div><strong data-live-protein>${formatMacro(nutrition.protein)}</strong><span>белки, г</span></div>
        <div><strong data-live-fat>${formatMacro(nutrition.fat)}</strong><span>жиры, г</span></div>
        <div><strong data-live-carbs>${formatMacro(nutrition.carbohydrates)}</strong><span>углеводы, г</span></div>
      </div>

      <div class="form-section">
        <label class="field">
          <span class="field__label">Количество</span>
          <div class="input-wrap">
            <input class="input" type="number" inputmode="decimal" min="0.1" max="5000" step="1"
              data-portion-amount value="${escapeHtml(amount)}" />
            <span class="input-wrap__suffix">грамм</span>
          </div>
        </label>
        <div class="chip-row">
          ${servings
            .map(
              (item) =>
                `<button type="button" class="chip ${Number(amount) === item.value ? 'is-active' : ''}" data-amount="${item.value}">${escapeHtml(item.label)}</button>`,
            )
            .join('')}
        </div>
      </div>

      <div class="form-section">
        <span class="field__label">Приём пищи</span>
        ${mealSegmented(currentMeal)}
      </div>

      ${portionError ? `<p class="field__error" role="alert" style="margin-top:12px">${escapeHtml(portionError)}</p>` : ''}

      <button class="btn btn--primary btn--block btn--lg" type="button" data-action="save-portion"
        style="margin-top:16px" ${saving ? 'disabled' : ''}>
        ${saving ? '<span class="spinner spinner--sm"></span> Добавляем…' : `${icon('check', '', 19)} Добавить · <span data-live-button>${formatCalories(nutrition.calories)}</span> ккал`}
      </button>
      <p class="field__hint" style="margin-top:10px;text-align:center">
        ${escapeHtml(formatDateLong(day))} · ${escapeHtml(MEAL_LABELS[currentMeal])}
      </p>`;
  }

  function renderPortion() {
    if (!activeFood) return renderList();
    view = 'portion';
    setHeader('Порция', activeFood.name);
    body.innerHTML = portionHtml();
    refreshIcons(body);
    resetScroll();
  }

  function updateLiveNutrition() {
    if (!activeFood) return;
    const nutrition = scaled(activeFood, amount);
    const set = (selector, value) => {
      const node = body.querySelector(selector);
      if (node) node.textContent = value;
    };
    set('[data-live-calories]', formatCalories(nutrition.calories));
    set('[data-live-protein]', formatMacro(nutrition.protein));
    set('[data-live-fat]', formatMacro(nutrition.fat));
    set('[data-live-carbs]', formatMacro(nutrition.carbohydrates));
    set('[data-live-button]', formatCalories(nutrition.calories));
    body.querySelectorAll('[data-amount]').forEach((chip) => {
      chip.classList.toggle('is-active', Number(chip.dataset.amount) === Number(amount));
    });
  }

  function renderCustom() {
    view = 'custom';
    setHeader('Свой продукт', 'Значения на 100 г');
    body.innerHTML = `
      <button class="btn btn--ghost btn--sm" type="button" data-action="back-to-list" style="margin-bottom:8px;padding-left:0">
        ${icon('chevron-left', '', 17)} Все продукты
      </button>
      <div class="form-section">
        <label class="field">
          <span class="field__label">Название</span>
          <input class="input" type="text" maxlength="120" data-custom="name" placeholder="Например, домашний суп" />
        </label>
        <div class="form-grid form-grid--2">
          <label class="field">
            <span class="field__label">Калории</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="0" max="1000" step="1" data-custom="calories" placeholder="120" />
              <span class="input-wrap__suffix">ккал</span>
            </div>
          </label>
          <label class="field">
            <span class="field__label">Белки</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="0" max="100" step="0.1" data-custom="protein" placeholder="5" />
              <span class="input-wrap__suffix">г</span>
            </div>
          </label>
          <label class="field">
            <span class="field__label">Жиры</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="0" max="100" step="0.1" data-custom="fat" placeholder="3" />
              <span class="input-wrap__suffix">г</span>
            </div>
          </label>
          <label class="field">
            <span class="field__label">Углеводы</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="0" max="100" step="0.1" data-custom="carbohydrates" placeholder="15" />
              <span class="input-wrap__suffix">г</span>
            </div>
          </label>
        </div>
        <label class="field">
          <span class="field__label">Порция по умолчанию <span class="text-tertiary">(необязательно)</span></span>
          <div class="input-wrap">
            <input class="input" type="number" inputmode="decimal" min="1" max="5000" step="1" data-custom="defaultServingGrams" placeholder="200" />
            <span class="input-wrap__suffix">г</span>
          </div>
        </label>
        <label class="field">
          <span class="field__label">Вес одной штуки <span class="text-tertiary">(необязательно)</span></span>
          <div class="input-wrap">
            <input class="input" type="number" inputmode="decimal" min="1" max="2000" step="1" data-custom="pieceGrams" placeholder="50" />
            <span class="input-wrap__suffix">г</span>
          </div>
        </label>
        <label class="field">
          <span class="field__label">Другие названия <span class="text-tertiary">(через запятую)</span></span>
          <input class="input" type="text" maxlength="300" data-custom="aliases" placeholder="суп, домашний бульон" />
        </label>
      </div>
      ${customError ? `<p class="field__error" role="alert" style="margin-top:12px">${escapeHtml(customError)}</p>` : ''}
      <button class="btn btn--primary btn--block btn--lg" type="button" data-action="save-custom" style="margin-top:16px" ${customSaving ? 'disabled' : ''}>
        ${customSaving ? '<span class="spinner spinner--sm"></span> Создаём…' : `${icon('check', '', 19)} Сохранить продукт`}
      </button>
      <p class="field__hint" style="margin-top:10px;text-align:center">
        Свой продукт виден только вам.
      </p>`;
    refreshIcons(body);
    resetScroll();
  }

  function customPayload() {
    const read = (name) => body.querySelector(`[data-custom="${name}"]`)?.value?.trim() || '';
    const name = read('name');
    const calories = Number(read('calories'));
    const protein = Number(read('protein'));
    const fat = Number(read('fat'));
    const carbohydrates = Number(read('carbohydrates'));
    const serving = read('defaultServingGrams');
    const piece = read('pieceGrams');
    const aliases = read('aliases')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (name.length < 2) return { error: 'Введите название продукта (минимум 2 символа).' };
    if (!Number.isFinite(calories) || calories < 0 || calories > 1000) {
      return { error: 'Калорийность должна быть от 0 до 1000 ккал на 100 г.' };
    }
    for (const [label, value] of [
      ['Белки', protein],
      ['Жиры', fat],
      ['Углеводы', carbohydrates],
    ]) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return { error: `${label}: значение должно быть от 0 до 100 г на 100 г продукта.` };
      }
    }
    if (serving && (!Number.isFinite(Number(serving)) || Number(serving) < 1 || Number(serving) > 5000)) {
      return { error: 'Порция по умолчанию должна быть от 1 до 5000 г.' };
    }
    if (piece && (!Number.isFinite(Number(piece)) || Number(piece) < 1 || Number(piece) > 2000)) {
      return { error: 'Вес одной штуки должен быть от 1 до 2000 г.' };
    }

    const payload = { name, calories, protein, fat, carbohydrates };
    if (serving) payload.defaultServingGrams = Number(serving);
    if (piece) payload.pieceGrams = Number(piece);
    if (aliases.length) payload.aliases = aliases;
    return { payload };
  }

  async function loadDiscovery() {
    discoveryState = 'loading';
    discoveryError = '';
    if (view === 'list') renderResults();
    try {
      const data = await api.foodDiscovery();
      discovery = {
        recent: data.recent || [],
        favorites: data.favorites || [],
        popular: data.popular || [],
      };
      favorites = new Set((data.favorites || []).map((food) => String(food.id)));
      indexFoods([...discovery.recent, ...discovery.favorites, ...discovery.popular]);
      discoveryState = 'ready';
    } catch (error) {
      discoveryState = 'error';
      discoveryError = error?.message || '';
    }
    if (view === 'list') renderResults();
  }

  async function runSearch(term) {
    const seq = ++searchSeq;
    searchState = 'loading';
    searchError = '';
    if (view === 'list') renderResults();
    try {
      const data = await api.searchFoods(term, 30);
      if (seq !== searchSeq) return;
      results = data.items || [];
      indexFoods(results);
      searchState = 'ready';
    } catch (error) {
      if (seq !== searchSeq) return;
      results = [];
      searchState = 'error';
      searchError = error?.message || '';
    }
    if (view === 'list') renderResults();
  }

  const debouncedSearch = debounce((term) => {
    if (!term) return;
    runSearch(term);
  }, 320);

  async function savePortion() {
    if (saving || !activeFood) return;
    const grams = Number(amount);
    if (!Number.isFinite(grams) || grams < 0.1 || grams > 5000) {
      portionError = 'Количество должно быть от 0,1 до 5000 г.';
      renderPortion();
      return;
    }
    saving = true;
    portionError = '';
    renderPortion();
    const button = body.querySelector('[data-action="save-portion"]');
    setBusy(button, true, 'Добавляем…');
    try {
      const data = await api.addEntry({
        productId: activeFood.id,
        amountGrams: grams,
        mealType: currentMeal,
        date: day,
      });
      telegram.haptic('success');
      toast(`Добавлено: ${activeFood.name}, ${grams} г`, 'success', {
        title: 'Записано в дневник',
      });
      sheet.close();
      onAdded?.(data?.entry || null);
    } catch (error) {
      saving = false;
      portionError = error?.message || 'Не удалось добавить продукт.';
      renderPortion();
      toast(portionError, 'error');
    }
  }

  async function saveCustom() {
    if (customSaving) return;
    const { payload, error } = customPayload();
    if (error) {
      customError = error;
      renderCustom();
      return;
    }
    customSaving = true;
    customError = '';
    renderCustom();
    const button = body.querySelector('[data-action="save-custom"]');
    setBusy(button, true, 'Создаём…');
    try {
      const food = await api.customFood(payload);
      customSaving = false;
      telegram.haptic('success');
      toast('Продукт создан', 'success');
      activeFood = food;
      amount = Number(food.defaultServingGrams || 100);
      portionError = '';
      renderPortion();
    } catch (err) {
      customSaving = false;
      customError = err?.message || 'Не удалось создать продукт.';
      renderCustom();
    }
  }

  async function toggleFavorite() {
    if (!activeFood?.id || favoriteBusy) return;
    favoriteBusy = true;
    try {
      const data = await api.toggleFavorite(activeFood.id);
      if (data?.favorite) favorites.add(String(activeFood.id));
      else favorites.delete(String(activeFood.id));
      telegram.haptic('light');
      toast(data?.favorite ? 'Добавлено в избранное' : 'Убрано из избранного', 'success', {
        duration: 2000,
      });
      renderPortion();
    } catch (error) {
      toast(error?.message || 'Не удалось изменить избранное', 'error');
    } finally {
      favoriteBusy = false;
    }
  }

  function pickFood(foodId) {
    const food = foodIndex.get(String(foodId));
    if (!food) return;
    activeFood = food;
    amount = Number(food.lastAmountGrams || food.defaultServingGrams || 100);
    portionError = '';
    renderPortion();
    telegram.haptic('light');
  }

  body.addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-food-tab]');
    if (tabButton) {
      tab = tabButton.dataset.foodTab;
      query = '';
      const input = body.querySelector('[data-food-search]');
      if (input) input.value = '';
      renderList();
      return;
    }

    const foodButton = event.target.closest('[data-food-id]');
    if (foodButton) {
      pickFood(foodButton.dataset.foodId);
      return;
    }

    const mealButton = event.target.closest('[data-portion-meal]');
    if (mealButton) {
      currentMeal = mealButton.dataset.portionMeal;
      renderPortion();
      return;
    }

    const amountChip = event.target.closest('[data-amount]');
    if (amountChip) {
      amount = Number(amountChip.dataset.amount);
      const input = body.querySelector('[data-portion-amount]');
      if (input) input.value = amount;
      updateLiveNutrition();
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'back-to-list') {
      renderList();
      return;
    }
    if (action === 'save-portion') {
      savePortion();
      return;
    }
    if (action === 'favorite') {
      toggleFavorite();
      return;
    }
    if (action === 'custom-food') {
      customError = '';
      renderCustom();
      return;
    }
    if (action === 'save-custom') {
      saveCustom();
      return;
    }
    if (action === 'retry-discovery') {
      loadDiscovery();
      return;
    }
    if (action === 'retry-search') {
      if (query.trim()) runSearch(query.trim());
      return;
    }
  });

  body.addEventListener('input', (event) => {
    if (event.target.matches('[data-food-search]')) {
      query = event.target.value;
      const term = query.trim();
      if (!term) {
        tab = 'recent';
        searchSeq += 1;
        searchState = 'idle';
        results = [];
        renderResults();
        return;
      }
      tab = 'search';
      searchState = 'loading';
      renderResults();
      debouncedSearch(term);
      return;
    }

    if (event.target.matches('[data-portion-amount]')) {
      amount = event.target.value;
      portionError = '';
      updateLiveNutrition();
    }
  });

  if (initialFood) {
    renderPortion();
  } else {
    renderList();
  }
  loadDiscovery();

  return {
    close: sheet.close,
    focusSearch: () => {
      renderList({ focusSearch: true });
    },
  };
}
