import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { seedFoods } from './seedFoods.js';
import { buildSearchText, normalizeFoodName } from '../utils/foodText.js';
import { notFound } from '../utils/errors.js';

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

export function defaultReminderSettings(userId, timezone = 'Asia/Omsk') {
  return {
    id: id('rem'),
    userId,
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
    timezone,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

export class MemoryRepository {
  constructor({ seed = true, data = null, persistPath = null } = {}) {
    this.users = new Map();
    this.foods = new Map();
    this.entries = new Map();
    this.goals = new Map();
    this.weights = new Map();
    this.measurements = new Map();
    this.photos = new Map();
    this.water = new Map();
    this.reminders = new Map();
    this.notifications = new Map();
    this.favorites = new Map();
    this.pending = new Map();
    this.persistPath = persistPath;
    this._saveChain = Promise.resolve();
    if (data) this._hydrate(data);
    else if (seed) this._seed();
  }

  async init() {
    if (this.persistPath) {
      try {
        const raw = await fs.readFile(this.persistPath, 'utf8');
        this._hydrate(JSON.parse(raw));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return this;
  }

  _seed() {
    seedFoods.forEach((food, index) => {
      const product = {
        ...food,
        id: `food_seed_${String(index + 1).padStart(3, '0')}`,
        nameNormalized: normalizeFoodName(food.name),
        searchText: buildSearchText(food.name, food.aliases),
        usageCount: 0,
        createdBy: null,
        isPublic: true,
        createdAt: nowIso(),
      };
      this.foods.set(product.id, product);
    });
  }

  _serialize() {
    const toObject = (map) => Object.fromEntries([...map.entries()].map(([key, value]) => [key, value]));
    return {
      users: [...this.users.values()],
      foods: [...this.foods.values()],
      entries: [...this.entries.values()],
      goals: toObject(this.goals),
      weights: [...this.weights.values()],
      measurements: [...this.measurements.values()],
      photos: [...this.photos.values()],
      water: toObject(this.water),
      reminders: toObject(this.reminders),
      notifications: [...this.notifications.values()],
      favorites: [...this.favorites.values()],
      pending: [...this.pending.values()],
    };
  }

  _hydrate(data) {
    (data.users || []).forEach((u) => this.users.set(u.id, u));
    (data.foods || []).forEach((p) => this.foods.set(p.id, p));
    (data.entries || []).forEach((e) => this.entries.set(e.id, e));
    Object.entries(data.goals || {}).forEach(([k, v]) => this.goals.set(k, v));
    (data.weights || []).forEach((w) => this.weights.set(w.id, w));
    (data.measurements || []).forEach((m) => this.measurements.set(m.id, m));
    (data.photos || []).forEach((p) => this.photos.set(p.id, p));
    Object.entries(data.water || {}).forEach(([k, v]) => this.water.set(k, v));
    Object.entries(data.reminders || {}).forEach(([k, v]) => this.reminders.set(k, v));
    (data.notifications || []).forEach((n) => this.notifications.set(n.id, n));
    (data.favorites || []).forEach((f) => this.favorites.set(f.id, f));
    (data.pending || []).forEach((p) => this.pending.set(p.id, p));
  }

  _persist() {
    if (!this.persistPath) return;
    const payload = JSON.stringify(this._serialize());
    this._saveChain = this._saveChain
      .then(async () => {
        await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
        const tmp = `${this.persistPath}.tmp`;
        await fs.writeFile(tmp, payload, 'utf8');
        await fs.rename(tmp, this.persistPath);
      })
      .catch(() => {});
  }

  // Users -------------------------------------------------------------------
  async getUserByTelegramId(telegramId) {
    return clone([...this.users.values()].find((u) => String(u.telegramId) === String(telegramId)) || null);
  }

  async getUserById(userId) {
    return clone(this.users.get(userId) || null);
  }

  async createUser(data) {
    const user = {
      id: id('usr'),
      telegramId: String(data.telegramId),
      username: data.username || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      photoUrl: data.photoUrl || null,
      age: null,
      height: null,
      weight: null,
      targetWeight: null,
      sex: null,
      activityLevel: null,
      goal: null,
      timezone: data.timezone || 'Asia/Omsk',
      onboardingCompleted: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.users.set(user.id, user);
    this.reminders.set(user.id, defaultReminderSettings(user.id, user.timezone));
    this._persist();
    return clone(user);
  }

  async updateUser(userId, patch) {
    const user = this.users.get(userId);
    if (!user) throw notFound('Пользователь не найден');
    Object.assign(user, patch, { updatedAt: nowIso() });
    if (patch.timezone && this.reminders.has(userId)) {
      this.reminders.get(userId).timezone = patch.timezone;
    }
    this._persist();
    return clone(user);
  }

  async listUsersForScheduling() {
    return [...this.users.values()]
      .filter((user) => this.reminders.get(user.id)?.remindersEnabled)
      .map((user) => ({ user: clone(user), reminders: clone(this.reminders.get(user.id)) }));
  }

  // Products ----------------------------------------------------------------
  async searchFoods(query, { userId = null, limit = 25 } = {}) {
    const normalized = normalizeFoodName(query || '');
    let list = [...this.foods.values()].filter(
      (food) => food.isPublic || (userId && food.createdBy === userId),
    );
    if (normalized) {
      const terms = normalized.split(' ').filter(Boolean);
      list = list.filter((food) => terms.every((term) => food.searchText.includes(term)));
    }
    list.sort((a, b) => {
      const aStarts = normalized && a.nameNormalized.startsWith(normalized) ? 1 : 0;
      const bStarts = normalized && b.nameNormalized.startsWith(normalized) ? 1 : 0;
      return bStarts - aStarts || b.usageCount - a.usageCount || a.name.localeCompare(b.name, 'ru');
    });
    return list.slice(0, limit).map(clone);
  }

  async listAllFoods(userId) {
    return [...this.foods.values()]
      .filter((food) => food.isPublic || food.createdBy === userId)
      .map(clone);
  }

  async getFoodById(foodId) {
    return clone(this.foods.get(foodId) || null);
  }

  async createFood(data) {
    const product = {
      id: id('food'),
      name: data.name,
      nameNormalized: normalizeFoodName(data.name),
      searchText: buildSearchText(data.name, data.aliases),
      calories: Number(data.calories),
      protein: Number(data.protein),
      fat: Number(data.fat),
      carbohydrates: Number(data.carbohydrates),
      source: data.source || 'user',
      sourceId: data.sourceId || null,
      category: data.category || 'Мои продукты',
      emoji: data.emoji || '🍽️',
      aliases: data.aliases || [],
      defaultServingGrams: Number(data.defaultServingGrams || 100),
      pieceGrams: data.pieceGrams ? Number(data.pieceGrams) : null,
      usageCount: 0,
      createdBy: data.createdBy || null,
      isPublic: Boolean(data.isPublic),
      createdAt: nowIso(),
    };
    this.foods.set(product.id, product);
    this._persist();
    return clone(product);
  }

  async findPublicFoodBySource(source, sourceId) {
    return clone(
      [...this.foods.values()].find((food) => food.source === source && food.sourceId === sourceId) ||
        null,
    );
  }

  async incrementFoodUsage(foodIds) {
    for (const foodId of foodIds) {
      const food = this.foods.get(foodId);
      if (food) food.usageCount = (food.usageCount || 0) + 1;
    }
    this._persist();
  }

  async popularFoods(limit = 12) {
    return [...this.foods.values()]
      .filter((food) => food.isPublic)
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, 'ru'))
      .slice(0, limit)
      .map(clone);
  }

  async recentFoods(userId, limit = 10) {
    const seen = new Set();
    const result = [];
    const entries = [...this.entries.values()]
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    for (const entry of entries) {
      if (entry.productId && !seen.has(entry.productId)) {
        const food = this.foods.get(entry.productId);
        if (food) {
          result.push({ ...clone(food), lastAmountGrams: entry.amountGrams, lastMealType: entry.mealType });
          seen.add(entry.productId);
        }
      }
      if (result.length >= limit) break;
    }
    return result;
  }

  async listFavorites(userId) {
    return [...this.favorites.values()]
      .filter((favorite) => favorite.userId === userId)
      .map((favorite) => this.foods.get(favorite.productId))
      .filter(Boolean)
      .map(clone);
  }

  async addFavorite(userId, productId) {
    const existing = [...this.favorites.values()].find(
      (favorite) => favorite.userId === userId && favorite.productId === productId,
    );
    if (existing) return clone(existing);
    const favorite = { id: id('fav'), userId, productId, createdAt: nowIso() };
    this.favorites.set(favorite.id, favorite);
    this._persist();
    return clone(favorite);
  }

  async removeFavorite(userId, productId) {
    for (const [key, favorite] of this.favorites.entries()) {
      if (favorite.userId === userId && favorite.productId === productId) {
        this.favorites.delete(key);
      }
    }
    this._persist();
  }

  // Diary -------------------------------------------------------------------
  async listEntries(userId, startIso, endIso) {
    return [...this.entries.values()]
      .filter(
        (entry) =>
          entry.userId === userId &&
          new Date(entry.consumedAt) >= new Date(startIso) &&
          new Date(entry.consumedAt) < new Date(endIso),
      )
      .sort((a, b) => new Date(a.consumedAt) - new Date(b.consumedAt) || a.createdAt.localeCompare(b.createdAt))
      .map(clone);
  }

  async getEntry(userId, entryId) {
    const entry = this.entries.get(entryId);
    return entry && entry.userId === userId ? clone(entry) : null;
  }

  async createEntry(data) {
    const entry = { ...data, id: id('ent'), createdAt: nowIso(), updatedAt: nowIso() };
    this.entries.set(entry.id, entry);
    const food = this.foods.get(entry.productId);
    if (food) food.usageCount = (food.usageCount || 0) + 1;
    this._persist();
    return clone(entry);
  }

  async createEntries(items) {
    const result = [];
    for (const data of items) result.push(await this.createEntry(data));
    return result;
  }

  async updateEntry(userId, entryId, patch) {
    const entry = this.entries.get(entryId);
    if (!entry || entry.userId !== userId) return null;
    Object.assign(entry, patch, { updatedAt: nowIso() });
    this._persist();
    return clone(entry);
  }

  async deleteEntry(userId, entryId) {
    const entry = this.entries.get(entryId);
    if (!entry || entry.userId !== userId) return false;
    this.entries.delete(entryId);
    this._persist();
    return true;
  }

  // Goals -------------------------------------------------------------------
  async getGoals(userId) {
    return clone(this.goals.get(userId) || null);
  }

  async upsertGoals(userId, goals) {
    const value = { ...goals, userId, updatedAt: nowIso() };
    this.goals.set(userId, value);
    this._persist();
    return clone(value);
  }

  // Weight ------------------------------------------------------------------
  async listWeights(userId, { startDate = null, endDate = null } = {}) {
    return [...this.weights.values()]
      .filter(
        (item) =>
          item.userId === userId &&
          (!startDate || item.recordedOn >= startDate) &&
          (!endDate || item.recordedOn <= endDate),
      )
      .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn))
      .map(clone);
  }

  async upsertWeight(userId, data) {
    const existing = [...this.weights.values()].find(
      (item) => item.userId === userId && item.recordedOn === data.recordedOn,
    );
    if (existing) {
      Object.assign(existing, data, { updatedAt: nowIso() });
      this._persist();
      return clone(existing);
    }
    const item = {
      id: id('wgt'),
      userId,
      recordedOn: data.recordedOn,
      recordedAt: data.recordedAt || nowIso(),
      weight: data.weight,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.weights.set(item.id, item);
    this._persist();
    return clone(item);
  }

  async deleteWeight(userId, weightId) {
    const item = this.weights.get(weightId);
    if (!item || item.userId !== userId) return false;
    this.weights.delete(weightId);
    this._persist();
    return true;
  }

  // Measurements & photos ---------------------------------------------------
  async listMeasurements(userId, { startDate = null } = {}) {
    return [...this.measurements.values()]
      .filter((item) => item.userId === userId && (!startDate || item.recordedOn >= startDate))
      .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn))
      .map(clone);
  }

  async upsertMeasurement(userId, data) {
    const existing = [...this.measurements.values()].find(
      (item) => item.userId === userId && item.recordedOn === data.recordedOn,
    );
    if (existing) {
      Object.assign(existing, data, { updatedAt: nowIso() });
      this._persist();
      return clone(existing);
    }
    const item = { id: id('bdy'), userId, createdAt: nowIso(), updatedAt: nowIso(), ...data };
    this.measurements.set(item.id, item);
    this._persist();
    return clone(item);
  }

  async deleteMeasurement(userId, measurementId) {
    const item = this.measurements.get(measurementId);
    if (!item || item.userId !== userId) return false;
    this.measurements.delete(measurementId);
    this._persist();
    return true;
  }

  async listPhotos(userId, { startDate = null } = {}) {
    return [...this.photos.values()]
      .filter((item) => item.userId === userId && (!startDate || item.recordedOn >= startDate))
      .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn))
      .map(clone);
  }

  async createPhoto(userId, data) {
    const item = {
      id: id('pho'),
      userId,
      recordedOn: data.recordedOn,
      dataUrl: data.dataUrl,
      note: data.note || null,
      createdAt: nowIso(),
    };
    this.photos.set(item.id, item);
    this._persist();
    return clone(item);
  }

  async deletePhoto(userId, photoId) {
    const item = this.photos.get(photoId);
    if (!item || item.userId !== userId) return false;
    this.photos.delete(photoId);
    this._persist();
    return true;
  }

  // Water -------------------------------------------------------------------
  async getWater(userId, date) {
    return clone(this.water.get(`${userId}:${date}`) || { userId, date, amountMl: 0, goalMl: 2000 });
  }

  async addWater(userId, date, amountMl, goalMl) {
    const key = `${userId}:${date}`;
    const existing = this.water.get(key) || { userId, date, amountMl: 0, goalMl };
    existing.amountMl = Math.max(0, Math.min(10000, Number(existing.amountMl) + Number(amountMl)));
    existing.goalMl = goalMl ?? existing.goalMl;
    existing.updatedAt = nowIso();
    this.water.set(key, existing);
    this._persist();
    return clone(existing);
  }

  async setWater(userId, date, amountMl, goalMl) {
    const value = {
      userId,
      date,
      amountMl: Math.max(0, Math.min(10000, Number(amountMl))),
      goalMl,
      updatedAt: nowIso(),
    };
    this.water.set(`${userId}:${date}`, value);
    this._persist();
    return clone(value);
  }

  // Reminders & notifications ----------------------------------------------
  async getReminderSettings(userId) {
    return clone(this.reminders.get(userId) || null);
  }

  async upsertReminderSettings(userId, patch) {
    const existing = this.reminders.get(userId) || defaultReminderSettings(userId);
    Object.assign(existing, patch, { userId, updatedAt: nowIso() });
    this.reminders.set(userId, existing);
    this._persist();
    return clone(existing);
  }

  async getNotificationLog(userId, dedupeKey) {
    return clone(
      [...this.notifications.values()].find(
        (log) => log.userId === userId && log.dedupeKey === dedupeKey,
      ) || null,
    );
  }

  async createNotificationLog(data) {
    const existing = await this.getNotificationLog(data.userId, data.dedupeKey);
    if (existing) return false;
    const log = {
      id: id('ntf'),
      userId: data.userId,
      notificationType: data.notificationType,
      dedupeKey: data.dedupeKey,
      scheduledAt: data.scheduledAt,
      sentAt: data.sentAt || nowIso(),
      status: data.status || 'sent',
    };
    this.notifications.set(log.id, log);
    this._persist();
    return true;
  }

  async createPendingEntry(data) {
    const pending = {
      id: id('pnd'),
      userId: data.userId,
      payload: data.payload,
      expiresAt: data.expiresAt,
      createdAt: nowIso(),
    };
    this.pending.set(pending.id, pending);
    this._persist();
    return clone(pending);
  }

  async getPendingEntry(pendingId) {
    const item = this.pending.get(pendingId);
    if (!item || new Date(item.expiresAt) < new Date()) return null;
    return clone(item);
  }

  async deletePendingEntry(pendingId) {
    this.pending.delete(pendingId);
    this._persist();
  }

  async close() {
    await this._saveChain;
  }
}

export class JsonRepository extends MemoryRepository {
  constructor({ filePath, seed = true }) {
    super({ seed, persistPath: filePath });
  }
}
