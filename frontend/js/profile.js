import { api, config, tokenStore } from './api.js';
import { telegram } from './telegram.js';
import { applyProfile, resetSession, setState } from './store.js';
import {
  ACTIVITY_LEVELS,
  GOALS,
  TIMEZONES,
  escapeHtml,
  formatCalories,
  formatMacro,
  formatWeight,
  signed,
} from './utils.js';
import {
  avatar,
  confirmDialog,
  errorState,
  icon,
  openSheet,
  refreshIcons,
  screenHeader,
  setBusy,
  skeletonList,
  toast,
  toggleRow,
} from './components.js';

const SEX_LABELS = { male: 'Мужской', female: 'Женский', other: 'Другой' };

const REMINDER_ITEMS = [
  {
    key: 'morning',
    toggle: 'morningEnabled',
    time: 'morningTime',
    label: 'Утреннее приветствие',
    hint: 'Короткое сообщение в начале дня',
    icon: 'sunrise',
  },
  {
    key: 'breakfast',
    toggle: 'breakfastEnabled',
    time: 'breakfastTime',
    label: 'Завтрак',
    hint: 'Только если завтрак ещё не записан',
    icon: 'sunrise',
  },
  {
    key: 'lunch',
    toggle: 'lunchEnabled',
    time: 'lunchTime',
    label: 'Обед',
    hint: 'Напоминание без давления',
    icon: 'sun',
  },
  {
    key: 'dinner',
    toggle: 'dinnerEnabled',
    time: 'dinnerTime',
    label: 'Ужин',
    hint: 'Мягкое напоминание вечером',
    icon: 'sunset',
  },
  {
    key: 'evening',
    toggle: 'eveningEnabled',
    time: 'eveningTime',
    label: 'Проверка дневника',
    hint: 'Если удобно, дополнить день',
    icon: 'moon-star',
  },
];

function timeInput(label, value, attribute) {
  return `
    <label class="field">
      <span class="field__label">${escapeHtml(label)}</span>
      <input class="input" type="time" value="${escapeHtml(value || '')}" ${attribute} />
    </label>`;
}

function reminderToggleRow(item, settings) {
  return toggleRow({
    id: `rem-${item.key}`,
    title: item.label,
    hint: item.hint,
    checked: Boolean(settings[item.toggle]),
    iconName: item.icon,
    dataKey: item.toggle,
  });
}

function reminderBlock(item, settings) {
  return `
    <div class="form-section" data-reminder-block="${item.key}">
      ${reminderToggleRow(item, settings)}
      <div class="form-grid form-grid--2" style="padding-left:47px">
        ${timeInput('Время', settings[item.time], `data-rem-time="${item.time}"`)}
      </div>
    </div>`;
}

function profileHero(profile) {
  const user = profile.user || {};
  const plan = profile.plan;
  const goalLabel = GOALS[plan?.goal || user.goal] || null;
  return `
    <section class="card profile-hero">
      ${avatar(user, 66)}
      <div class="profile-hero__body grow">
        <p class="profile-hero__name">${escapeHtml(
          [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Пользователь CALORIA',
        )}</p>
        <p class="profile-hero__handle">${user.username ? `@${escapeHtml(user.username)}` : `Telegram ID ${escapeHtml(user.telegramId || '—')}`}</p>
        <div class="profile-hero__badges">
          ${goalLabel ? `<span class="badge badge--accent">${escapeHtml(goalLabel)}</span>` : ''}
          ${profile.bmiCategory ? `<span class="badge">ИМТ ${formatMacro(profile.bmi)} · ${escapeHtml(profile.bmiCategory)}</span>` : ''}
          ${plan?.isMinor ? '<span class="badge badge--warning">До 18 лет</span>' : ''}
          ${config.DEV_MODE ? '<span class="dev-badge">DEV</span>' : ''}
        </div>
      </div>
    </section>`;
}

function goalsBlock(profile) {
  const goals = profile.goals;
  if (!goals) {
    return `<article class="card">
      <div class="card__head"><h3 class="card__title">Цели</h3></div>
      <p class="field__hint">Цели появятся после заполнения профиля и расчёта плана.</p>
    </article>`;
  }
  return `
    <div class="settings-group">
      <p class="settings-group__title">Цели</p>
      <div class="settings-list">
        <button type="button" class="settings-row" data-action="edit-goals">
          <span class="settings-row__icon">${icon('flame', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Калории</span>
            <span class="settings-row__hint">Дневной ориентир</span>
          </span>
          <span class="settings-row__value">${formatCalories(goals.calories)} ккал</span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
        <button type="button" class="settings-row" data-action="edit-goals">
          <span class="settings-row__icon">${icon('beef', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Белки · жиры · углеводы</span>
            <span class="settings-row__hint">Можно изменить вручную</span>
          </span>
          <span class="settings-row__value">${formatMacro(goals.protein)} / ${formatMacro(goals.fat)} / ${formatMacro(goals.carbohydrates)}</span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
        <button type="button" class="settings-row" data-action="edit-goals">
          <span class="settings-row__icon">${icon('droplets', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Вода</span>
            <span class="settings-row__hint">Ориентир, а не обязанность</span>
          </span>
          <span class="settings-row__value">${formatCalories(goals.waterMl)} мл</span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
      </div>
    </div>`;
}

function planBlock(profile) {
  const plan = profile.plan;
  if (!plan) {
    return `<article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">План</h3>
          <p class="card__hint">Не хватает данных профиля</p>
        </div>
        <button type="button" class="btn btn--secondary btn--sm" data-action="edit-profile">Заполнить</button>
      </div>
      <p class="field__hint">Укажите возраст, рост, вес, активность и цель — CALORIA рассчитает безопасные ориентиры.</p>
    </article>`;
  }
  return `
    <article class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Ваш план</h3>
          <p class="card__hint">${escapeHtml(plan.activityLabel || '')}</p>
        </div>
        <span class="badge badge--accent">${escapeHtml(GOALS[plan.goal] || plan.goal)}</span>
      </div>
      <div class="measurement-grid">
        <div class="measurement-cell">
          <div class="measurement-cell__label">Базовый обмен</div>
          <div class="measurement-cell__value">${formatCalories(plan.bmr)}<span> ккал</span></div>
        </div>
        <div class="measurement-cell">
          <div class="measurement-cell__label">Расход</div>
          <div class="measurement-cell__value">${formatCalories(plan.tdee)}<span> ккал</span></div>
        </div>
        <div class="measurement-cell">
          <div class="measurement-cell__label">Темп</div>
          <div class="measurement-cell__value">${signed(plan.expectedWeeklyChangeKg, 2)}<span> кг/нед</span></div>
        </div>
      </div>
      ${
        plan.warnings?.length
          ? `<div class="warning-box" style="margin-top:12px">
              <p class="warning-box__title">${icon('alert-triangle', '', 16)} Важно</p>
              <ul class="warning-list">${plan.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </div>`
          : ''
      }
      <p class="disclaimer" style="margin-top:12px">
        ${icon('info', '', 16)}
        <span>${escapeHtml(plan.disclaimer || 'Расчёт носит ориентировочный характер и не является медицинской рекомендацией.')}</span>
      </p>
    </article>`;
}

function bodySettings(profile) {
  const user = profile.user || {};
  const activity = ACTIVITY_LEVELS[user.activityLevel];
  const sexLabel = SEX_LABELS[user.sex] || 'Не указан';
  const body = [user.age ? `${user.age} лет` : null, user.height ? `${formatMacro(user.height)} см` : null, user.weight ? `${formatWeight(user.weight)} кг` : null]
    .filter(Boolean)
    .join(' · ');
  return `
    <div class="settings-group">
      <p class="settings-group__title">Профиль</p>
      <div class="settings-list">
        <button type="button" class="settings-row" data-action="edit-profile">
          <span class="settings-row__icon">${icon('user-round', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Тело и активность</span>
            <span class="settings-row__hint">${escapeHtml(body || 'Заполните параметры')} · ${escapeHtml(sexLabel)}</span>
          </span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
        <button type="button" class="settings-row" data-action="edit-profile">
          <span class="settings-row__icon">${icon('target', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Цель</span>
            <span class="settings-row__hint">${escapeHtml(activity?.label || 'Активность не указана')}</span>
          </span>
          <span class="settings-row__value">${escapeHtml(GOALS[user.goal] || 'Не задана')}</span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
        <button type="button" class="settings-row" data-action="edit-profile">
          <span class="settings-row__icon">${icon('clock', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Часовой пояс</span>
            <span class="settings-row__hint">Границы дня и напоминания</span>
          </span>
          <span class="settings-row__value">${escapeHtml(user.timezone || '—')}</span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
      </div>
    </div>`;
}

function remindersBlock(reminders) {
  if (!reminders) {
    return `
      <div class="settings-group">
        <p class="settings-group__title">Напоминания</p>
        <div class="settings-list">
          <button type="button" class="settings-row" data-action="edit-reminders">
            <span class="settings-row__icon">${icon('bell', '', 17)}</span>
            <span class="settings-row__body">
              <span class="settings-row__title">Настроить напоминания</span>
              <span class="settings-row__hint">Не удалось загрузить текущие настройки</span>
            </span>
            ${icon('chevron-right', 'settings-row__chevron', 17)}
          </button>
        </div>
      </div>`;
  }
  const active = reminders.remindersEnabled
    ? REMINDER_ITEMS.filter((item) => reminders[item.toggle]).length + (reminders.waterEnabled ? 1 : 0)
    : 0;
  return `
    <div class="settings-group">
      <p class="settings-group__title">Напоминания</p>
      <div class="settings-list">
        <button type="button" class="settings-row" data-action="edit-reminders">
          <span class="settings-row__icon">${icon('bell', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">${reminders.remindersEnabled ? 'Напоминания включены' : 'Напоминания выключены'}</span>
            <span class="settings-row__hint">${reminders.remindersEnabled ? `${active} ${active === 1 ? 'напоминание' : active < 5 ? 'напоминания' : 'напоминаний'} · тихие часы ${escapeHtml(reminders.quietStart)}–${escapeHtml(reminders.quietEnd)}` : 'Можно включить в любой момент'}</span>
          </span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
        <button type="button" class="settings-row" data-action="edit-reminders">
          <span class="settings-row__icon">${icon('clock', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Часовой пояс уведомлений</span>
            <span class="settings-row__hint">${escapeHtml(reminders.timezone || '—')}</span>
          </span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
      </div>
    </div>`;
}

function appearanceBlock(state) {
  return `
    <div class="settings-group">
      <p class="settings-group__title">Оформление</p>
      <div class="settings-list" style="padding-top:4px;padding-bottom:4px">
        ${toggleRow({
          id: 'theme-switch',
          title: 'Тёмная тема',
          hint: 'Тёмная тема включена по умолчанию',
          checked: state.theme === 'dark',
          iconName: 'moon-star',
          dataKey: 'theme',
        })}
      </div>
    </div>`;
}

function aboutBlock() {
  return `
    <div class="settings-group">
      <p class="settings-group__title">О приложении</p>
      <div class="settings-list">
        <button type="button" class="settings-row" data-action="open-bot">
          <span class="settings-row__icon">${icon('send', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Открыть бота</span>
            <span class="settings-row__hint">Команды, напоминания и фото</span>
          </span>
          <span class="settings-row__value">${config.BOT_USERNAME ? `@${escapeHtml(config.BOT_USERNAME)}` : 'Не настроен'}</span>
          ${icon('arrow-up-right', 'settings-row__chevron', 17)}
        </button>
        <div class="settings-row">
          <span class="settings-row__icon">${icon('shield-check', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Версия</span>
            <span class="settings-row__hint">CALORIA не является медицинским изделием</span>
          </span>
          <span class="settings-row__value">${escapeHtml(config.APP_VERSION || '1.0.0')}</span>
        </div>
        <button type="button" class="settings-row is-danger" data-action="logout">
          <span class="settings-row__icon">${icon('log-out', '', 17)}</span>
          <span class="settings-row__body">
            <span class="settings-row__title">Выйти</span>
            <span class="settings-row__hint">Данные сохранятся в аккаунте</span>
          </span>
          ${icon('chevron-right', 'settings-row__chevron', 17)}
        </button>
      </div>
    </div>`;
}

function openProfileSheet(ctx, profile) {
  const user = profile.user || {};
  const timezones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES].filter(Boolean);
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid form-grid--2">
      <label class="field">
        <span class="field__label">Возраст</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="numeric" min="14" max="100" step="1" value="${escapeHtml(user.age ?? '')}" data-profile="age" />
          <span class="input-wrap__suffix">лет</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Пол</span>
        <select class="select" data-profile="sex">
          ${Object.entries(SEX_LABELS)
            .map(([value, label]) => `<option value="${value}" ${user.sex === value ? 'selected' : ''}>${label}</option>`)
            .join('')}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Рост</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="100" max="250" step="1" value="${escapeHtml(user.height ?? '')}" data-profile="height" />
          <span class="input-wrap__suffix">см</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Вес</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="30" max="300" step="0.1" value="${escapeHtml(user.weight ?? '')}" data-profile="weight" />
          <span class="input-wrap__suffix">кг</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Желаемый вес</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="30" max="300" step="0.1" value="${user.targetWeight == null ? '' : escapeHtml(user.targetWeight)}" data-profile="targetWeight" placeholder="Не задан" />
          <span class="input-wrap__suffix">кг</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Активность</span>
        <select class="select" data-profile="activityLevel">
          ${Object.entries(ACTIVITY_LEVELS)
            .map(([value, meta]) => `<option value="${value}" ${user.activityLevel === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`)
            .join('')}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Цель</span>
        <select class="select" data-profile="goal">
          ${Object.entries(GOALS)
            .map(([value, label]) => `<option value="${value}" ${user.goal === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
            .join('')}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Часовой пояс</span>
        <select class="select" data-profile="timezone">
          ${timezones
            .map((zone) => `<option value="${escapeHtml(zone)}" ${user.timezone === zone ? 'selected' : ''}>${escapeHtml(zone)}</option>`)
            .join('')}
        </select>
      </label>
    </div>
    <p class="field__hint" style="margin-top:12px">При сохранении цели по калориям и БЖУ пересчитаются. Ручные изменения целей можно вернуть позже.</p>
    <p class="field__error" data-profile-error hidden></p>
    <button class="btn btn--primary btn--block" type="button" data-action="save-profile" style="margin-top:18px">
      ${icon('check', '', 18)} Сохранить профиль
    </button>`;
  const sheet = openSheet({ title: 'Профиль', subtitle: 'Параметры для расчёта', content, className: 'sheet--tall' });
  refreshIcons(content);

  content.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="save-profile"]')) return;
    const read = (name) => content.querySelector(`[data-profile="${name}"]`)?.value;
    const payload = {
      age: Number(read('age')),
      height: Number(read('height')),
      weight: Number(read('weight')),
      sex: read('sex'),
      activityLevel: read('activityLevel'),
      goal: read('goal'),
      timezone: read('timezone'),
    };
    const target = read('targetWeight');
    payload.targetWeight = target === '' ? null : Number(target);
    const errorNode = content.querySelector('[data-profile-error]');

    if (!Number.isInteger(payload.age) || payload.age < 14 || payload.age > 100) {
      errorNode.hidden = false;
      errorNode.textContent = 'Возраст должен быть целым числом от 14 до 100 лет.';
      return;
    }
    if (!Number.isFinite(payload.height) || payload.height < 100 || payload.height > 250) {
      errorNode.hidden = false;
      errorNode.textContent = 'Рост должен быть от 100 до 250 см.';
      return;
    }
    if (!Number.isFinite(payload.weight) || payload.weight < 30 || payload.weight > 300) {
      errorNode.hidden = false;
      errorNode.textContent = 'Вес должен быть от 30 до 300 кг.';
      return;
    }
    if (payload.targetWeight != null && (!Number.isFinite(payload.targetWeight) || payload.targetWeight < 30 || payload.targetWeight > 300)) {
      errorNode.hidden = false;
      errorNode.textContent = 'Желаемый вес должен быть от 30 до 300 кг.';
      return;
    }

    const button = content.querySelector('[data-action="save-profile"]');
    setBusy(button, true, 'Сохраняем…');
    try {
      const result = await api.saveProfile(payload);
      applyProfile(result);
      telegram.haptic('success');
      toast('Профиль и цели обновлены', 'success');
      sheet.close();
      ctx.updateChrome?.();
      ctx.refresh();
    } catch (error) {
      setBusy(button, false);
      errorNode.hidden = false;
      errorNode.textContent = error?.message || 'Не удалось сохранить профиль.';
    }
  });
}

function openGoalsSheet(ctx, profile) {
  const goals = profile.goals || { calories: 2000, protein: 100, fat: 65, carbohydrates: 230, waterMl: 2000 };
  const plan = profile.plan;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid form-grid--2">
      <label class="field">
        <span class="field__label">Калории</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="numeric" min="1000" max="6000" step="10" value="${escapeHtml(goals.calories)}" data-goal="calories" />
          <span class="input-wrap__suffix">ккал</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Вода</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="numeric" min="500" max="8000" step="50" value="${escapeHtml(goals.waterMl || 2000)}" data-goal="waterMl" />
          <span class="input-wrap__suffix">мл</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Белки</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="0" max="500" step="1" value="${escapeHtml(goals.protein)}" data-goal="protein" />
          <span class="input-wrap__suffix">г</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Жиры</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="0" max="300" step="1" value="${escapeHtml(goals.fat)}" data-goal="fat" />
          <span class="input-wrap__suffix">г</span>
        </div>
      </label>
      <label class="field">
        <span class="field__label">Углеводы</span>
        <div class="input-wrap">
          <input class="input" type="number" inputmode="decimal" min="0" max="1000" step="1" value="${escapeHtml(goals.carbohydrates)}" data-goal="carbohydrates" />
          <span class="input-wrap__suffix">г</span>
        </div>
      </label>
    </div>
    ${
      plan
        ? `<button class="btn btn--secondary btn--block btn--sm" type="button" data-action="fill-plan" style="margin-top:12px">
            ${icon('sparkles', '', 16)} Вернуть расчётные значения
          </button>`
        : ''
    }
    <p class="field__hint" style="margin-top:12px">Приложение не опустит калории ниже безопасного минимума для вашего пола и возраста. Ручные цели — ответственность пользователя.</p>
    <p class="field__error" data-goal-error hidden></p>
    <button class="btn btn--primary btn--block" type="button" data-action="save-goals" style="margin-top:18px">
      ${icon('check', '', 18)} Сохранить цели
    </button>`;
  const sheet = openSheet({ title: 'Цели', subtitle: 'Можно настроить вручную', content, className: 'sheet--tall' });
  refreshIcons(content);

  content.addEventListener('click', async (event) => {
    if (event.target.closest('[data-action="fill-plan"]') && plan) {
      const values = {
        calories: plan.calories,
        protein: plan.protein,
        fat: plan.fat,
        carbohydrates: plan.carbohydrates,
        waterMl: plan.waterMl,
      };
      for (const [key, value] of Object.entries(values)) {
        const input = content.querySelector(`[data-goal="${key}"]`);
        if (input) input.value = value;
      }
      return;
    }

    if (!event.target.closest('[data-action="save-goals"]')) return;
    const read = (name) => Number(content.querySelector(`[data-goal="${name}"]`)?.value);
    const payload = {
      calories: Math.round(read('calories')),
      protein: read('protein'),
      fat: read('fat'),
      carbohydrates: read('carbohydrates'),
      waterMl: Math.round(read('waterMl')),
    };
    const errorNode = content.querySelector('[data-goal-error]');
    if (!Number.isFinite(payload.calories) || payload.calories < 1000 || payload.calories > 6000) {
      errorNode.hidden = false;
      errorNode.textContent = 'Калории должны быть от 1000 до 6000.';
      return;
    }
    if (!Number.isFinite(payload.protein) || payload.protein < 0 || payload.protein > 500) {
      errorNode.hidden = false;
      errorNode.textContent = 'Белки должны быть от 0 до 500 г.';
      return;
    }
    if (!Number.isFinite(payload.fat) || payload.fat < 0 || payload.fat > 300) {
      errorNode.hidden = false;
      errorNode.textContent = 'Жиры должны быть от 0 до 300 г.';
      return;
    }
    if (!Number.isFinite(payload.carbohydrates) || payload.carbohydrates < 0 || payload.carbohydrates > 1000) {
      errorNode.hidden = false;
      errorNode.textContent = 'Углеводы должны быть от 0 до 1000 г.';
      return;
    }
    if (!Number.isFinite(payload.waterMl) || payload.waterMl < 500 || payload.waterMl > 8000) {
      errorNode.hidden = false;
      errorNode.textContent = 'Вода должна быть от 500 до 8000 мл.';
      return;
    }

    const button = content.querySelector('[data-action="save-goals"]');
    setBusy(button, true, 'Сохраняем…');
    try {
      const result = await api.updateGoals(payload);
      setState({ goals: result.goals });
      telegram.haptic('success');
      toast('Цели обновлены', 'success');
      sheet.close();
      ctx.refresh();
    } catch (error) {
      setBusy(button, false);
      errorNode.hidden = false;
      errorNode.textContent = error?.message || 'Не удалось сохранить цели.';
    }
  });
}

function openRemindersSheet(ctx, reminders, userTimezone) {
  const settings = reminders || {
    remindersEnabled: true,
    morningEnabled: true,
    breakfastEnabled: true,
    lunchEnabled: true,
    dinnerEnabled: true,
    eveningEnabled: true,
    waterEnabled: false,
    morningTime: '09:00',
    breakfastTime: '10:00',
    lunchTime: '13:30',
    dinnerTime: '19:00',
    eveningTime: '21:00',
    quietStart: '22:00',
    quietEnd: '08:00',
    waterIntervalHours: 3,
    timezone: userTimezone,
  };
  const timezones = TIMEZONES.includes(settings.timezone)
    ? TIMEZONES
    : [settings.timezone, ...TIMEZONES].filter(Boolean);
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-section">
      ${toggleRow({
        id: 'rem-master',
        title: 'Напоминания',
        hint: 'Главный переключатель всех уведомлений',
        checked: Boolean(settings.remindersEnabled),
        iconName: 'bell',
        dataKey: 'remindersEnabled',
      })}
    </div>
    ${REMINDER_ITEMS.map((item) => reminderBlock(item, settings)).join('')}
    <div class="form-section">
      ${toggleRow({
        id: 'rem-water',
        title: 'Вода',
        hint: 'Небольшие напоминания в течение дня',
        checked: Boolean(settings.waterEnabled),
        iconName: 'droplets',
        dataKey: 'waterEnabled',
      })}
      <div class="form-grid form-grid--2" style="padding-left:47px">
        <label class="field">
          <span class="field__label">Интервал, часов</span>
          <div class="input-wrap">
            <input class="input" type="number" inputmode="numeric" min="1" max="12" step="1" value="${escapeHtml(settings.waterIntervalHours || 3)}" data-rem-interval />
            <span class="input-wrap__suffix">ч</span>
          </div>
        </label>
      </div>
    </div>
    <div class="form-section">
      <p class="form-section__title">Тихие часы</p>
      <div class="form-grid form-grid--2">
        ${timeInput('С', settings.quietStart, 'data-rem-time="quietStart"')}
        ${timeInput('До', settings.quietEnd, 'data-rem-time="quietEnd"')}
      </div>
      <p class="field__hint">В это время CALORIA не отправляет уведомления.</p>
    </div>
    <div class="form-section">
      <label class="field">
        <span class="field__label">Часовой пояс</span>
        <select class="select" data-rem-timezone>
          ${timezones
            .map((zone) => `<option value="${escapeHtml(zone)}" ${settings.timezone === zone ? 'selected' : ''}>${escapeHtml(zone)}</option>`)
            .join('')}
        </select>
      </label>
    </div>
    <p class="field__error" data-rem-error hidden></p>
    <button class="btn btn--primary btn--block" type="button" data-action="save-reminders" style="margin-top:18px">
      ${icon('check', '', 18)} Сохранить настройки
    </button>
    <p class="field__hint" style="margin-top:10px;text-align:center">Напоминания приходят в Telegram и не содержат оценок или давления.</p>`;
  const sheet = openSheet({ title: 'Напоминания', subtitle: 'Мягкий ритм дня', content, className: 'sheet--tall' });
  refreshIcons(content);

  content.addEventListener('click', async (event) => {
    if (!event.target.closest('[data-action="save-reminders"]')) return;
    const payload = {
      remindersEnabled: Boolean(content.querySelector('[data-key="remindersEnabled"]')?.checked),
      timezone: content.querySelector('[data-rem-timezone]')?.value,
      waterIntervalHours: Math.round(Number(content.querySelector('[data-rem-interval]')?.value)),
    };
    for (const item of REMINDER_ITEMS) {
      payload[item.toggle] = Boolean(content.querySelector(`[data-key="${item.toggle}"]`)?.checked);
      payload[item.time] = content.querySelector(`[data-rem-time="${item.time}"]`)?.value;
    }
    payload.waterEnabled = Boolean(content.querySelector('[data-key="waterEnabled"]')?.checked);
    payload.quietStart = content.querySelector('[data-rem-time="quietStart"]')?.value;
    payload.quietEnd = content.querySelector('[data-rem-time="quietEnd"]')?.value;

    const errorNode = content.querySelector('[data-rem-error]');
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const [key, value] of Object.entries(payload)) {
      if (key.endsWith('Time') || key === 'quietStart' || key === 'quietEnd') {
        if (!timePattern.test(String(value || ''))) {
          errorNode.hidden = false;
          errorNode.textContent = 'Укажите корректное время в формате ЧЧ:ММ.';
          return;
        }
      }
    }
    if (!Number.isFinite(payload.waterIntervalHours) || payload.waterIntervalHours < 1 || payload.waterIntervalHours > 12) {
      errorNode.hidden = false;
      errorNode.textContent = 'Интервал воды должен быть от 1 до 12 часов.';
      return;
    }

    const button = content.querySelector('[data-action="save-reminders"]');
    setBusy(button, true, 'Сохраняем…');
    try {
      await api.updateReminders(payload);
      if (payload.timezone && payload.timezone !== ctx.state.user?.timezone) {
        if (ctx.state.user) ctx.state.user.timezone = payload.timezone;
      }
      telegram.haptic('success');
      toast('Настройки напоминаний сохранены', 'success');
      sheet.close();
      ctx.refresh();
    } catch (error) {
      setBusy(button, false);
      errorNode.hidden = false;
      errorNode.textContent = error?.message || 'Не удалось сохранить настройки.';
    }
  });
}

export async function mount(root, ctx) {
  root.innerHTML = `${screenHeader({
    eyebrow: 'Аккаунт',
    title: 'Профиль',
    subtitle: 'План, цели и напоминания',
  })}${skeletonList(6)}`;
  refreshIcons(root);

  let profile;
  let reminders = null;
  try {
    profile = await api.getProfile();
    applyProfile(profile);
  } catch (error) {
    if (!ctx.isActive()) return;
    root.innerHTML = `${screenHeader({ eyebrow: 'Аккаунт', title: 'Профиль' })}${errorState(error?.message)}`;
    root.querySelector('[data-action="retry"]')?.addEventListener('click', () => ctx.refresh());
    refreshIcons(root);
    return;
  }

  try {
    reminders = await api.getReminders();
  } catch {
    reminders = null;
  }

  if (!ctx.isActive()) return;

  root.innerHTML = `
    ${screenHeader({ eyebrow: 'Аккаунт', title: 'Профиль', subtitle: 'План, цели и напоминания' })}
    <div class="stack-16">
      ${profileHero(profile)}
      ${goalsBlock(profile)}
      ${planBlock(profile)}
      ${bodySettings(profile)}
      ${remindersBlock(reminders)}
      ${appearanceBlock(ctx.state)}
      ${aboutBlock()}
      <p class="safety-note">
        ${icon('heart-pulse', '', 17)}
        <span>CALORIA создана для спокойного наблюдения, а не для диагностики или лечения. При расстройстве пищевого поведения или хронических заболеваниях обратитесь к врачу.</span>
      </p>
    </div>`;

  refreshIcons(root);

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-key="theme"]')) {
      ctx.toggleTheme?.();
    }
  }, { signal: ctx.signal });

  root.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'edit-profile') {
      openProfileSheet(ctx, profile);
      return;
    }
    if (action === 'edit-goals') {
      openGoalsSheet(ctx, profile);
      return;
    }
    if (action === 'edit-reminders') {
      openRemindersSheet(ctx, reminders, ctx.state.user?.timezone);
      return;
    }
    if (action === 'open-bot') {
      const opened = telegram.openBot(config.BOT_USERNAME);
      if (!opened) {
        toast('Имя бота не настроено в этой сборке. Откройте бота в Telegram вручную.', 'info');
      }
      return;
    }
    if (action === 'logout') {
      const confirmed = await confirmDialog({
        title: 'Выйти из CALORIA?',
        message: 'Вы сможете снова войти через Telegram. Все данные останутся в аккаунте.',
        confirmText: 'Выйти',
        danger: true,
      });
      if (!confirmed) return;
      tokenStore.clear();
      resetSession();
      location.hash = '#home';
      location.reload();
      return;
    }
    if (action === 'retry') {
      ctx.refresh();
    }
  }, { signal: ctx.signal });
}

export function destroy() {
  // No persistent resources.
}
