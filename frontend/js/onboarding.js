import { api } from './api.js';
import { telegram } from './telegram.js';
import { ACTIVITY_LEVELS, escapeHtml, formatWeight, localTimezone, TIMEZONES } from './utils.js';
import { icon, refreshIcons, setBusy, toast } from './components.js';

const TOTAL_STEPS = 4;

const SEX_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
  { value: 'other', label: 'Другой' },
];

const GOAL_OPTIONS = [
  { value: 'lose', label: 'Снизить вес', hint: 'Мягкий дефицит без крайностей' },
  { value: 'maintain', label: 'Поддерживать', hint: 'Сохранить текущий вес' },
  { value: 'gain', label: 'Набрать массу', hint: 'Небольшой профицит' },
];

function profilePayload(form) {
  const payload = {
    age: Number(form.age),
    height: Number(form.height),
    weight: Number(form.weight),
    sex: form.sex,
    activityLevel: form.activityLevel,
    goal: form.goal,
    timezone: form.timezone,
  };
  if (form.targetWeight !== '' && form.targetWeight != null) {
    payload.targetWeight = Number(form.targetWeight);
  }
  return payload;
}

function validateBasics(form) {
  const age = Number(form.age);
  if (!form.sex) return 'Выберите пол для расчёта.';
  if (!Number.isFinite(age) || !Number.isInteger(age)) return 'Введите возраст целым числом.';
  if (age < 14) {
    return 'CALORIA не рассчитывает цели для пользователей младше 14 лет. Обратитесь к врачу или нутрициологу.';
  }
  if (age > 100) return 'Проверьте возраст — максимум 100 лет.';
  return null;
}

function validateBody(form) {
  const height = Number(form.height);
  const weight = Number(form.weight);
  if (!Number.isFinite(height) || height < 100 || height > 250) {
    return 'Рост должен быть от 100 до 250 см.';
  }
  if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
    return 'Вес должен быть от 30 до 300 кг.';
  }
  if (form.targetWeight !== '') {
    const target = Number(form.targetWeight);
    if (!Number.isFinite(target) || target < 30 || target > 300) {
      return 'Желаемый вес должен быть от 30 до 300 кг.';
    }
  }
  return null;
}

function validateLifestyle(form) {
  if (!form.activityLevel) return 'Выберите уровень активности.';
  if (!form.goal) return 'Выберите цель.';
  if (!form.timezone) return 'Выберите часовой пояс.';
  return null;
}

function optionCards(options, field, active) {
  return `<div class="option-grid">
    ${options
      .map(
        (option) => `
      <button type="button" class="option-card ${option.value === active ? 'is-active' : ''}"
        data-choice="${escapeHtml(field)}" data-value="${escapeHtml(option.value)}">
        <span class="option-card__title">${escapeHtml(option.label)}</span>
        ${option.hint ? `<span class="option-card__hint">${escapeHtml(option.hint)}</span>` : ''}
      </button>`,
      )
      .join('')}
  </div>`;
}

export function openOnboarding(root, ctx = {}) {
  if (!root) return Promise.resolve();

  const form = {
    age: '',
    height: '',
    weight: '',
    targetWeight: '',
    sex: '',
    activityLevel: 'moderate',
    goal: 'maintain',
    timezone: localTimezone(),
  };

  let step = 0;
  let error = '';
  let plan = null;
  let loadingPlan = false;
  let saving = false;

  const container = document.createElement('div');
  container.className = 'onboarding';
  root.innerHTML = '';
  root.appendChild(container);

  function setStep(next) {
    step = Math.max(0, Math.min(4, next));
    error = '';
    if (step !== 4) plan = null;
    render();
    container.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'auto' });
    telegram.haptic('light');
  }

  function render() {
    container.innerHTML = `
      <div class="onboarding__inner">
        <header class="onboarding__top">
          <span class="onboarding__brand">
            <img src="assets/logo-mark.svg" alt="" width="24" height="24" />
            CALORIA
          </span>
          ${step > 0 ? `<span class="onboarding__step-label">Шаг ${step} из ${TOTAL_STEPS}</span>` : ''}
        </header>
        <div class="onboarding__bar" aria-hidden="true">
          <span style="width:${step === 0 ? 6 : (step / TOTAL_STEPS) * 100}%"></span>
        </div>
        <div class="onboarding__content">${step === 0 ? welcomeStep() : step === 1 ? basicsStep() : step === 2 ? bodyStep() : step === 3 ? lifestyleStep() : previewStep()}</div>
        ${navStep()}
      </div>
    `;
    refreshIcons(container);
  }

  function welcomeStep() {
    return `
      <section class="welcome">
        <div class="welcome__mark"><img src="assets/logo-mark.svg" alt="" /></div>
        <h1 class="welcome__title">Питание<br />без <em>давления</em><br />и крайностей.</h1>
        <p class="welcome__text">
          CALORIA помогает замечать, что вы едите, и держать спокойный ритм.
          Никаких штрафов, «идеальных» дней и обещаний похудеть за неделю.
        </p>
        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-item__icon">${icon('sparkles', '', 17)}</span>
            <span><strong>Точные ориентиры</strong>Калории и БЖУ рассчитываются по проверенной формуле с безопасными границами.</span>
          </div>
          <div class="feature-item">
            <span class="feature-item__icon">${icon('shield-check', '', 17)}</span>
            <span><strong>Бережный подход</strong>Для подростков не создаётся автоматический дефицит. Слишком низкие цели не назначаются.</span>
          </div>
          <div class="feature-item">
            <span class="feature-item__icon">${icon('bell', '', 17)}</span>
            <span><strong>Мягкие напоминания</strong>Можно настроить время, тихие часы и отключить любые уведомления.</span>
          </div>
        </div>
        <p class="disclaimer" style="margin-top:24px">
          ${icon('info', '', 16)}
          <span>CALORIA — дневник питания, а не медицинский сервис. Расчёты ориентировочные и не заменяют консультацию врача или нутрициолога.</span>
        </p>
      </section>`;
  }

  function basicsStep() {
    return `
      <section>
        <header class="step-head">
          <p class="eyebrow">О вас</p>
          <h2>Немного базовых данных</h2>
          <p>Они нужны только для расчёта ориентиров. Пол не влияет на ценность человека — только на формулу.</p>
        </header>
        ${error ? `<p class="field__error" role="alert" style="margin-bottom:12px">${escapeHtml(error)}</p>` : ''}
        <div class="form-section">
          <span class="field__label">Пол</span>
          ${optionCards(SEX_OPTIONS, 'sex', form.sex)}
        </div>
        <div class="form-section">
          <label class="field">
            <span class="field__label">Возраст</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="numeric" min="14" max="100" step="1"
                data-input="age" value="${escapeHtml(form.age)}" placeholder="Например, 29" />
              <span class="input-wrap__suffix">лет</span>
            </div>
            <span class="field__hint">Для пользователей младше 14 лет расчёт недоступен.</span>
          </label>
        </div>
      </section>`;
  }

  function bodyStep() {
    return `
      <section>
        <header class="step-head">
          <p class="eyebrow">Тело</p>
          <h2>Рост и вес</h2>
          <p>Можно указать примерные значения — их всегда можно изменить в профиле.</p>
        </header>
        ${error ? `<p class="field__error" role="alert" style="margin-bottom:12px">${escapeHtml(error)}</p>` : ''}
        <div class="form-grid form-grid--2">
          <label class="field">
            <span class="field__label">Рост</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="100" max="250" step="1"
                data-input="height" value="${escapeHtml(form.height)}" placeholder="175" />
              <span class="input-wrap__suffix">см</span>
            </div>
          </label>
          <label class="field">
            <span class="field__label">Вес</span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="30" max="300" step="0.1"
                data-input="weight" value="${escapeHtml(form.weight)}" placeholder="72" />
              <span class="input-wrap__suffix">кг</span>
            </div>
          </label>
        </div>
        <div class="form-section">
          <label class="field">
            <span class="field__label">Желаемый вес <span class="text-tertiary">(необязательно)</span></span>
            <div class="input-wrap">
              <input class="input" type="number" inputmode="decimal" min="30" max="300" step="0.1"
                data-input="targetWeight" value="${escapeHtml(form.targetWeight)}" placeholder="68" />
              <span class="input-wrap__suffix">кг</span>
            </div>
            <span class="field__hint">Если цель не про вес, оставьте поле пустым.</span>
          </label>
        </div>
        <div class="safety-note" style="margin-top:18px">
          ${icon('shield-check', '', 17)}
          <span>CALORIA не ставит целью быстрые изменения. Темп и безопасность важнее скорости.</span>
        </div>
      </section>`;
  }

  function lifestyleStep() {
    return `
      <section>
        <header class="step-head">
          <p class="eyebrow">Ритм</p>
          <h2>Активность и цель</h2>
          <p>Выберите то, что ближе к реальности. Уровень можно изменить в любой момент.</p>
        </header>
        ${error ? `<p class="field__error" role="alert" style="margin-bottom:12px">${escapeHtml(error)}</p>` : ''}
        <div class="form-section">
          <span class="field__label">Активность</span>
          ${optionCards(
            Object.entries(ACTIVITY_LEVELS).map(([value, meta]) => ({
              value,
              label: meta.label,
              hint: meta.hint,
            })),
            'activityLevel',
            form.activityLevel,
          )}
        </div>
        <div class="form-section">
          <span class="field__label">Цель</span>
          ${optionCards(GOAL_OPTIONS, 'goal', form.goal)}
        </div>
        <div class="form-section">
          <label class="field">
            <span class="field__label">Часовой пояс</span>
            <select class="select" data-input="timezone">
              ${TIMEZONES.map(
                (zone) =>
                  `<option value="${escapeHtml(zone)}" ${zone === form.timezone ? 'selected' : ''}>${escapeHtml(zone)}</option>`,
              ).join('')}
            </select>
            <span class="field__hint">Нужен для границ дня и напоминаний. Сейчас определён как ${escapeHtml(localTimezone())}.</span>
          </label>
        </div>
        <p class="disclaimer">
          ${icon('info', '', 16)}
          <span>Если вам меньше 18 лет, приложение не создаст автоматический дефицит калорий даже при цели «снизить вес».</span>
        </p>
      </section>`;
  }

  function previewStep() {
    const planBlock = loadingPlan
      ? `<div class="spinner-block"><span class="spinner"></span><span>Считаем безопасные ориентиры…</span></div>`
      : plan
        ? `
        <div class="plan-preview">
          <div class="plan-preview__grid">
            <div class="plan-preview__item">
              <div class="plan-preview__value">${plan.calories}<span> ккал</span></div>
              <div class="plan-preview__label">Дневная цель</div>
            </div>
            <div class="plan-preview__item">
              <div class="plan-preview__value">${plan.waterMl}<span> мл</span></div>
              <div class="plan-preview__label">Вода</div>
            </div>
          </div>
          <div class="plan-preview__macros">
            <span><strong>${plan.protein} г</strong>Белки</span>
            <span><strong>${plan.fat} г</strong>Жиры</span>
            <span><strong>${plan.carbohydrates} г</strong>Углеводы</span>
          </div>
          <div class="plan-preview__grid" style="margin-top:10px">
            <div class="plan-preview__item">
              <div class="plan-preview__value">${plan.bmr}<span> ккал</span></div>
              <div class="plan-preview__label">Базовый обмен</div>
            </div>
            <div class="plan-preview__item">
              <div class="plan-preview__value">${plan.tdee}<span> ккал</span></div>
              <div class="plan-preview__label">Расход с активностью</div>
            </div>
          </div>
          <div class="insight-row">
            ${icon('trending-up', '', 15)}
            <span>Ожидаемый темп: <b>${plan.expectedWeeklyChangeKg > 0 ? '+' : ''}${formatWeight(plan.expectedWeeklyChangeKg)} кг в неделю</b>. Это ориентир, а не обещание.</span>
          </div>
        </div>
        ${
          plan.warnings?.length
            ? `<div class="warning-box" style="margin-top:12px">
                <p class="warning-box__title">${icon('alert-triangle', '', 16)} Важно учесть</p>
                <ul class="warning-list">${plan.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
              </div>`
            : `<div class="safety-note" style="margin-top:12px">
                ${icon('shield-check', '', 17)}
                <span>Расчёт в безопасных пределах: цель не ниже физиологических минимумов.</span>
              </div>`
        }
        <p class="disclaimer" style="margin-top:12px">
          ${icon('info', '', 16)}
          <span>${escapeHtml(plan.disclaimer)}</span>
        </p>`
        : error
          ? `<div class="warning-box"><p class="warning-box__title">${icon('alert-triangle', '', 16)} Не удалось рассчитать план</p><p class="field__hint" style="margin-top:7px">${escapeHtml(error)}</p><button class="btn btn--secondary btn--sm" type="button" data-action="retry-preview" style="margin-top:12px">Попробовать снова</button></div>`
          : '';

    return `
      <section>
        <header class="step-head">
          <p class="eyebrow">План</p>
          <h2>Ваши ориентиры</h2>
          <p>Рассчитано по формуле Миффлина — Сан Жеора с безопасными ограничениями. План можно изменить позже.</p>
        </header>
        ${planBlock}
      </section>`;
  }

  function navStep() {
    if (step === 0) {
      return `<div class="onboarding__nav">
        <button class="btn btn--primary btn--block" type="button" data-action="next">${icon('arrow-right', '', 18)} Начать настройку</button>
      </div>`;
    }
    if (step === 4) {
      return `<div class="onboarding__nav">
        <button class="btn btn--ghost" type="button" data-action="back" ${saving ? 'disabled' : ''}>${icon('arrow-left', '', 18)} Назад</button>
        <button class="btn btn--primary" type="button" data-action="save" ${!plan || loadingPlan || saving ? 'disabled' : ''}>
          ${saving ? '<span class="spinner spinner--sm"></span> Сохраняем…' : `${icon('check', '', 18)} Сохранить план`}
        </button>
      </div>`;
    }
    return `<div class="onboarding__nav">
      <button class="btn btn--ghost" type="button" data-action="back">${icon('arrow-left', '', 18)} Назад</button>
      <button class="btn btn--primary" type="button" data-action="next">Далее ${icon('arrow-right', '', 18)}</button>
    </div>`;
  }

  async function loadPlan() {
    if (loadingPlan) return;
    loadingPlan = true;
    error = '';
    render();
    try {
      plan = await api.previewPlan(profilePayload(form));
    } catch (err) {
      plan = null;
      error = err?.message || 'Не удалось рассчитать план.';
    } finally {
      loadingPlan = false;
      render();
    }
  }

  async function save() {
    if (saving || !plan) return;
    saving = true;
    error = '';
    render();
    const button = container.querySelector('[data-action="save"]');
    setBusy(button, true, 'Сохраняем…');
    try {
      const payload = await api.saveProfile(profilePayload(form));
      telegram.haptic('success');
      ctx.onComplete?.(payload);
    } catch (err) {
      saving = false;
      error = err?.message || 'Не удалось сохранить профиль. Попробуйте ещё раз.';
      render();
      toast(error, 'error');
    }
  }

  function next() {
    if (step === 1) {
      const problem = validateBasics(form);
      if (problem) {
        error = problem;
        render();
        return;
      }
    }
    if (step === 2) {
      const problem = validateBody(form);
      if (problem) {
        error = problem;
        render();
        return;
      }
    }
    if (step === 3) {
      const problem = validateLifestyle(form);
      if (problem) {
        error = problem;
        render();
        return;
      }
      setStep(4);
      loadPlan();
      return;
    }
    setStep(step + 1);
  }

  container.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-choice]');
    if (choice) {
      form[choice.dataset.choice] = choice.dataset.value;
      error = '';
      render();
      telegram.haptic('light');
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'next') next();
    if (action === 'back') setStep(step - 1);
    if (action === 'save') save();
    if (action === 'retry-preview') loadPlan();
  });

  container.addEventListener('input', (event) => {
    const field = event.target.dataset.input;
    if (!field) return;
    form[field] = event.target.value;
  });

  container.addEventListener('change', (event) => {
    const field = event.target.dataset.input;
    if (field) form[field] = event.target.value;
  });

  render();
  return Promise.resolve();
}
