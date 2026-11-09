import { createClient } from '@supabase/supabase-js';
import { notFound } from '../utils/errors.js';
import { buildSearchText, normalizeFoodName } from '../utils/foodText.js';
import { defaultReminderSettings } from './memory.repository.js';

const numberOrNull = (value) => (value == null || value === '' ? null : Number(value));
const timeOf = (value) => (value ? String(value).slice(0, 5) : null);

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    telegramId: String(row.telegram_id),
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    photoUrl: row.photo_url,
    age: row.age,
    height: numberOrNull(row.height),
    weight: numberOrNull(row.weight),
    targetWeight: numberOrNull(row.target_weight),
    sex: row.sex,
    activityLevel: row.activity_level,
    goal: row.goal,
    timezone: row.timezone || 'Asia/Omsk',
    onboardingCompleted: Boolean(row.onboarding_completed),
    createdAt: row.created_at,
  };
}

function mapFood(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.name_normalized || normalizeFoodName(row.name),
    searchText: row.search_text || buildSearchText(row.name, row.aliases),
    calories: Number(row.calories),
    protein: Number(row.protein),
    fat: Number(row.fat),
    carbohydrates: Number(row.carbohydrates),
    source: row.source,
    sourceId: row.source_id,
    category: row.category,
    emoji: row.emoji,
    aliases: row.aliases || [],
    defaultServingGrams: Number(row.default_serving_grams || 100),
    pieceGrams: numberOrNull(row.piece_grams),
    usageCount: Number(row.usage_count || 0),
    createdBy: row.created_by,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
  };
}

function mapEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    productNameSnapshot: row.product_name_snapshot,
    mealType: row.meal_type,
    amountGrams: Number(row.amount_grams),
    calories: Number(row.calories),
    protein: Number(row.protein),
    fat: Number(row.fat),
    carbohydrates: Number(row.carbohydrates),
    consumedAt: row.consumed_at,
    entryDate: row.entry_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeight(row) {
  return {
    id: row.id,
    userId: row.user_id,
    weight: Number(row.weight),
    recordedOn: row.recorded_on,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMeasurement(row) {
  return {
    id: row.id,
    userId: row.user_id,
    recordedOn: row.recorded_on,
    waist: numberOrNull(row.waist),
    hips: numberOrNull(row.hips),
    chest: numberOrNull(row.chest),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPhoto(row) {
  return {
    id: row.id,
    userId: row.user_id,
    recordedOn: row.recorded_on,
    dataUrl: row.data_url,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapReminder(row, fallbackUserId, fallbackTimezone = 'Asia/Omsk') {
  if (!row) return defaultReminderSettings(fallbackUserId, fallbackTimezone);
  return {
    id: row.id,
    userId: row.user_id,
    remindersEnabled: Boolean(row.reminders_enabled),
    morningEnabled: Boolean(row.morning_enabled),
    breakfastEnabled: Boolean(row.breakfast_enabled),
    lunchEnabled: Boolean(row.lunch_enabled),
    dinnerEnabled: Boolean(row.dinner_enabled),
    eveningEnabled: Boolean(row.evening_enabled),
    waterEnabled: Boolean(row.water_enabled),
    morningTime: timeOf(row.morning_time),
    breakfastTime: timeOf(row.breakfast_time),
    lunchTime: timeOf(row.lunch_time),
    dinnerTime: timeOf(row.dinner_time),
    eveningTime: timeOf(row.evening_time),
    quietStart: timeOf(row.quiet_start),
    quietEnd: timeOf(row.quiet_end),
    waterIntervalHours: Number(row.water_interval_hours || 3),
    timezone: row.timezone || fallbackTimezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPending(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    payload: row.payload,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

const USER_PATCH_FIELDS = {
  username: 'username',
  firstName: 'first_name',
  lastName: 'last_name',
  photoUrl: 'photo_url',
  age: 'age',
  height: 'height',
  weight: 'weight',
  targetWeight: 'target_weight',
  sex: 'sex',
  activityLevel: 'activity_level',
  goal: 'goal',
  timezone: 'timezone',
  onboardingCompleted: 'onboarding_completed',
};

function userPatchToRow(patch) {
  const row = {};
  for (const [key, column] of Object.entries(USER_PATCH_FIELDS)) {
    if (patch[key] !== undefined) row[column] = patch[key];
  }
  row.updated_at = new Date().toISOString();
  return row;
}

const REMINDER_PATCH_FIELDS = {
  remindersEnabled: 'reminders_enabled',
  morningEnabled: 'morning_enabled',
  breakfastEnabled: 'breakfast_enabled',
  lunchEnabled: 'lunch_enabled',
  dinnerEnabled: 'dinner_enabled',
  eveningEnabled: 'evening_enabled',
  waterEnabled: 'water_enabled',
  morningTime: 'morning_time',
  breakfastTime: 'breakfast_time',
  lunchTime: 'lunch_time',
  dinnerTime: 'dinner_time',
  eveningTime: 'evening_time',
  quietStart: 'quiet_start',
  quietEnd: 'quiet_end',
  waterIntervalHours: 'water_interval_hours',
  timezone: 'timezone',
};

function assertOk(error) {
  if (error) {
    const wrapped = new Error(error.message || 'Database error');
    wrapped.code = error.code;
    wrapped.details = error.details;
    throw wrapped;
  }
}

export class SupabaseRepository {
  constructor({ url, serviceRoleKey }) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'caloria-backend' } },
    });
  }

  async init() {
    const { error } = await this.client.from('food_products').select('id', { head: true, count: 'exact' });
    assertOk(error);
    return this;
  }

  async ping() {
    const { error } = await this.client.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
    return true;
  }

  async close() {}

  // Users
  async getUserByTelegramId(telegramId) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('telegram_id', String(telegramId))
      .maybeSingle();
    assertOk(error);
    return mapUser(data);
  }

  async getUserById(userId) {
    const { data, error } = await this.client.from('users').select('*').eq('id', userId).maybeSingle();
    assertOk(error);
    return mapUser(data);
  }

  async createUser(data) {
    const { data: row, error } = await this.client
      .from('users')
      .insert({
        telegram_id: String(data.telegramId),
        username: data.username || null,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        photo_url: data.photoUrl || null,
        timezone: data.timezone || 'Asia/Omsk',
      })
      .select('*')
      .single();
    assertOk(error);
    return mapUser(row);
  }

  async updateUser(userId, patch) {
    const { data, error } = await this.client
      .from('users')
      .update(userPatchToRow(patch))
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    assertOk(error);
    if (!data) throw notFound('Пользователь не найден');
    return mapUser(data);
  }

  async listUsersForScheduling() {
    const { data, error } = await this.client
      .from('users')
      .select('*, reminder_settings!inner(*)')
      .eq('reminder_settings.reminders_enabled', true)
      .limit(5000);
    assertOk(error);
    return (data || []).map((row) => {
      const reminders = Array.isArray(row.reminder_settings)
        ? row.reminder_settings[0]
        : row.reminder_settings;
      return {
        user: mapUser(row),
        reminders: mapReminder(reminders, row.id, row.timezone),
      };
    });
  }

  // Food products
  async searchFoods(query, { userId = null, limit = 25 } = {}) {
    let builder = this.client.from('food_products').select('*');
    if (userId) {
      builder = builder.or(`is_public.eq.true,created_by.eq.${userId}`);
    } else {
      builder = builder.eq('is_public', true);
    }
    const normalized = normalizeFoodName(query || '');
    if (normalized) {
      for (const term of normalized.split(' ').filter(Boolean)) {
        builder = builder.ilike('search_text', `%${term}%`);
      }
    }
    builder = builder.order('usage_count', { ascending: false }).limit(Math.max(limit * 2, 30));
    const { data, error } = await builder;
    assertOk(error);
    const items = (data || []).map(mapFood);
    items.sort((a, b) => {
      const aStarts = normalized && a.nameNormalized.startsWith(normalized) ? 1 : 0;
      const bStarts = normalized && b.nameNormalized.startsWith(normalized) ? 1 : 0;
      return bStarts - aStarts || b.usageCount - a.usageCount || a.name.localeCompare(b.name, 'ru');
    });
    return items.slice(0, limit);
  }

  async listAllFoods(userId) {
    let builder = this.client.from('food_products').select('*').limit(2000);
    builder = userId
      ? builder.or(`is_public.eq.true,created_by.eq.${userId}`)
      : builder.eq('is_public', true);
    const { data, error } = await builder;
    assertOk(error);
    return (data || []).map(mapFood);
  }

  async getFoodById(foodId) {
    const { data, error } = await this.client.from('food_products').select('*').eq('id', foodId).maybeSingle();
    assertOk(error);
    return mapFood(data);
  }

  async createFood(data) {
    const { data: row, error } = await this.client
      .from('food_products')
      .insert({
        name: data.name,
        name_normalized: normalizeFoodName(data.name),
        search_text: buildSearchText(data.name, data.aliases),
        calories: Number(data.calories),
        protein: Number(data.protein),
        fat: Number(data.fat),
        carbohydrates: Number(data.carbohydrates),
        source: data.source || 'user',
        source_id: data.sourceId || null,
        category: data.category || 'Мои продукты',
        emoji: data.emoji || '🍽️',
        aliases: data.aliases || [],
        default_serving_grams: Number(data.defaultServingGrams || 100),
        piece_grams: data.pieceGrams ? Number(data.pieceGrams) : null,
        created_by: data.createdBy || null,
        is_public: Boolean(data.isPublic),
      })
      .select('*')
      .single();
    assertOk(error);
    return mapFood(row);
  }

  async findPublicFoodBySource(source, sourceId) {
    const { data, error } = await this.client
      .from('food_products')
      .select('*')
      .eq('source', source)
      .eq('source_id', sourceId)
      .maybeSingle();
    assertOk(error);
    return mapFood(data);
  }

  async incrementFoodUsage(foodIds) {
    if (!foodIds.length) return;
    const { error } = await this.client.rpc('increment_food_usage', { food_ids: foodIds });
    if (error) {
      // Non-critical denormalized counter; do not fail a diary save because of it.
      return;
    }
  }

  async popularFoods(limit = 12) {
    const { data, error } = await this.client
      .from('food_products')
      .select('*')
      .eq('is_public', true)
      .order('usage_count', { ascending: false })
      .limit(limit);
    assertOk(error);
    return (data || []).map(mapFood);
  }

  async recentFoods(userId, limit = 10) {
    const { data, error } = await this.client
      .from('food_entries')
      .select('product_id, amount_grams, meal_type, created_at')
      .eq('user_id', userId)
      .not('product_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(60);
    assertOk(error);
    const seen = new Map();
    for (const row of data || []) {
      if (!seen.has(row.product_id)) {
        seen.set(row.product_id, { lastAmountGrams: Number(row.amount_grams), lastMealType: row.meal_type });
      }
      if (seen.size >= limit) break;
    }
    if (!seen.size) return [];
    const { data: products, error: productsError } = await this.client
      .from('food_products')
      .select('*')
      .in('id', [...seen.keys()]);
    assertOk(productsError);
    const byId = new Map((products || []).map((row) => [row.id, mapFood(row)]));
    return [...seen.entries()]
      .map(([productId, meta]) => {
        const food = byId.get(productId);
        return food ? { ...food, ...meta } : null;
      })
      .filter(Boolean);
  }

  async listFavorites(userId) {
    const { data, error } = await this.client
      .from('favorites')
      .select('product_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    assertOk(error);
    const ids = (data || []).map((row) => row.product_id);
    if (!ids.length) return [];
    const { data: products, error: productsError } = await this.client
      .from('food_products')
      .select('*')
      .in('id', ids);
    assertOk(productsError);
    const byId = new Map((products || []).map((row) => [row.id, mapFood(row)]));
    return ids.map((productId) => byId.get(productId)).filter(Boolean);
  }

  async addFavorite(userId, productId) {
    const { data, error } = await this.client
      .from('favorites')
      .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id' })
      .select('*')
      .single();
    assertOk(error);
    return data;
  }

  async removeFavorite(userId, productId) {
    const { error } = await this.client
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    assertOk(error);
  }

  // Diary
  async listEntries(userId, startIso, endIso) {
    const { data, error } = await this.client
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('consumed_at', startIso)
      .lt('consumed_at', endIso)
      .order('consumed_at', { ascending: true });
    assertOk(error);
    return (data || []).map(mapEntry);
  }

  async getEntry(userId, entryId) {
    const { data, error } = await this.client
      .from('food_entries')
      .select('*')
      .eq('id', entryId)
      .eq('user_id', userId)
      .maybeSingle();
    assertOk(error);
    return mapEntry(data);
  }

  async createEntry(data) {
    const { data: row, error } = await this.client
      .from('food_entries')
      .insert({
        user_id: data.userId,
        product_id: data.productId,
        product_name_snapshot: data.productNameSnapshot,
        meal_type: data.mealType,
        amount_grams: data.amountGrams,
        calories: data.calories,
        protein: data.protein,
        fat: data.fat,
        carbohydrates: data.carbohydrates,
        consumed_at: data.consumedAt,
        entry_date: data.entryDate,
      })
      .select('*')
      .single();
    assertOk(error);
    return mapEntry(row);
  }

  async createEntries(items) {
    if (!items.length) return [];
    const { data, error } = await this.client
      .from('food_entries')
      .insert(
        items.map((entry) => ({
          user_id: entry.userId,
          product_id: entry.productId,
          product_name_snapshot: entry.productNameSnapshot,
          meal_type: entry.mealType,
          amount_grams: entry.amountGrams,
          calories: entry.calories,
          protein: entry.protein,
          fat: entry.fat,
          carbohydrates: entry.carbohydrates,
          consumed_at: entry.consumedAt,
          entry_date: entry.entryDate,
        })),
      )
      .select('*');
    assertOk(error);
    return (data || []).map(mapEntry);
  }

  async updateEntry(userId, entryId, patch) {
    const row = {};
    const mapping = {
      mealType: 'meal_type',
      amountGrams: 'amount_grams',
      calories: 'calories',
      protein: 'protein',
      fat: 'fat',
      carbohydrates: 'carbohydrates',
      consumedAt: 'consumed_at',
      entryDate: 'entry_date',
      productNameSnapshot: 'product_name_snapshot',
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (patch[key] !== undefined) row[column] = patch[key];
    }
    row.updated_at = new Date().toISOString();
    const { data, error } = await this.client
      .from('food_entries')
      .update(row)
      .eq('id', entryId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    assertOk(error);
    return mapEntry(data);
  }

  async deleteEntry(userId, entryId) {
    const { data, error } = await this.client
      .from('food_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId)
      .select('id');
    assertOk(error);
    return (data || []).length > 0;
  }

  // Goals
  async getGoals(userId) {
    const { data, error } = await this.client
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    assertOk(error);
    if (!data) return null;
    return {
      userId: data.user_id,
      calories: Number(data.calories),
      protein: Number(data.protein),
      fat: Number(data.fat),
      carbohydrates: Number(data.carbohydrates),
      waterMl: Number(data.water_ml || 2000),
      updatedAt: data.updated_at,
    };
  }

  async upsertGoals(userId, goals) {
    const { data, error } = await this.client
      .from('user_goals')
      .upsert(
        {
          user_id: userId,
          calories: goals.calories,
          protein: goals.protein,
          fat: goals.fat,
          carbohydrates: goals.carbohydrates,
          water_ml: goals.waterMl || 2000,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    assertOk(error);
    return {
      userId: data.user_id,
      calories: Number(data.calories),
      protein: Number(data.protein),
      fat: Number(data.fat),
      carbohydrates: Number(data.carbohydrates),
      waterMl: Number(data.water_ml || 2000),
      updatedAt: data.updated_at,
    };
  }

  // Weight
  async listWeights(userId, { startDate = null, endDate = null } = {}) {
    let builder = this.client.from('weight_history').select('*').eq('user_id', userId);
    if (startDate) builder = builder.gte('recorded_on', startDate);
    if (endDate) builder = builder.lte('recorded_on', endDate);
    const { data, error } = await builder.order('recorded_on', { ascending: true });
    assertOk(error);
    return (data || []).map(mapWeight);
  }

  async upsertWeight(userId, data) {
    const { data: row, error } = await this.client
      .from('weight_history')
      .upsert(
        {
          user_id: userId,
          weight: data.weight,
          recorded_on: data.recordedOn,
          recorded_at: data.recordedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,recorded_on' },
      )
      .select('*')
      .single();
    assertOk(error);
    return mapWeight(row);
  }

  async deleteWeight(userId, weightId) {
    const { data, error } = await this.client
      .from('weight_history')
      .delete()
      .eq('id', weightId)
      .eq('user_id', userId)
      .select('id');
    assertOk(error);
    return (data || []).length > 0;
  }

  // Measurements and photos
  async listMeasurements(userId, { startDate = null } = {}) {
    let builder = this.client.from('body_measurements').select('*').eq('user_id', userId);
    if (startDate) builder = builder.gte('recorded_on', startDate);
    const { data, error } = await builder.order('recorded_on', { ascending: true });
    assertOk(error);
    return (data || []).map(mapMeasurement);
  }

  async upsertMeasurement(userId, data) {
    const { data: row, error } = await this.client
      .from('body_measurements')
      .upsert(
        {
          user_id: userId,
          recorded_on: data.recordedOn,
          waist: data.waist,
          hips: data.hips,
          chest: data.chest,
          note: data.note || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,recorded_on' },
      )
      .select('*')
      .single();
    assertOk(error);
    return mapMeasurement(row);
  }

  async deleteMeasurement(userId, measurementId) {
    const { data, error } = await this.client
      .from('body_measurements')
      .delete()
      .eq('id', measurementId)
      .eq('user_id', userId)
      .select('id');
    assertOk(error);
    return (data || []).length > 0;
  }

  async listPhotos(userId, { startDate = null } = {}) {
    let builder = this.client.from('progress_photos').select('*').eq('user_id', userId);
    if (startDate) builder = builder.gte('recorded_on', startDate);
    const { data, error } = await builder.order('recorded_on', { ascending: true });
    assertOk(error);
    return (data || []).map(mapPhoto);
  }

  async createPhoto(userId, data) {
    const { data: row, error } = await this.client
      .from('progress_photos')
      .insert({
        user_id: userId,
        recorded_on: data.recordedOn,
        data_url: data.dataUrl,
        note: data.note || null,
      })
      .select('*')
      .single();
    assertOk(error);
    return mapPhoto(row);
  }

  async deletePhoto(userId, photoId) {
    const { data, error } = await this.client
      .from('progress_photos')
      .delete()
      .eq('id', photoId)
      .eq('user_id', userId)
      .select('id');
    assertOk(error);
    return (data || []).length > 0;
  }

  // Water
  async getWater(userId, date) {
    const { data, error } = await this.client
      .from('water_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', date)
      .maybeSingle();
    assertOk(error);
    return {
      userId,
      date,
      amountMl: data ? Number(data.amount_ml) : 0,
      goalMl: data ? Number(data.goal_ml) : 2000,
    };
  }

  async addWater(userId, date, amountMl, goalMl) {
    const existing = await this.getWater(userId, date);
    return this.setWater(userId, date, existing.amountMl + amountMl, goalMl ?? existing.goalMl);
  }

  async setWater(userId, date, amountMl, goalMl) {
    const { data, error } = await this.client
      .from('water_logs')
      .upsert(
        {
          user_id: userId,
          log_date: date,
          amount_ml: Math.max(0, Math.min(10000, Math.round(amountMl))),
          goal_ml: goalMl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,log_date' },
      )
      .select('*')
      .single();
    assertOk(error);
    return {
      userId,
      date,
      amountMl: Number(data.amount_ml),
      goalMl: Number(data.goal_ml),
    };
  }

  // Reminders and notifications
  async getReminderSettings(userId) {
    const { data, error } = await this.client
      .from('reminder_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    assertOk(error);
    return data ? mapReminder(data, userId) : null;
  }

  async upsertReminderSettings(userId, patch) {
    const existing = (await this.getReminderSettings(userId)) || defaultReminderSettings(userId);
    const merged = { ...existing, ...patch };
    const row = { user_id: userId, updated_at: new Date().toISOString() };
    for (const [key, column] of Object.entries(REMINDER_PATCH_FIELDS)) {
      if (merged[key] !== undefined) row[column] = merged[key];
    }
    const { data, error } = await this.client
      .from('reminder_settings')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();
    assertOk(error);
    return mapReminder(data, userId);
  }

  async createNotificationLog(data) {
    const { error } = await this.client.from('notification_logs').insert({
      user_id: data.userId,
      notification_type: data.notificationType,
      dedupe_key: data.dedupeKey,
      scheduled_at: data.scheduledAt,
      sent_at: data.sentAt || new Date().toISOString(),
      status: data.status || 'sent',
    });
    if (error?.code === '23505') return false;
    assertOk(error);
    return true;
  }

  async createPendingEntry(data) {
    const { data: row, error } = await this.client
      .from('bot_pending_entries')
      .insert({
        user_id: data.userId,
        payload: data.payload,
        expires_at: data.expiresAt,
      })
      .select('*')
      .single();
    assertOk(error);
    return mapPending(row);
  }

  async getPendingEntry(pendingId) {
    const { data, error } = await this.client
      .from('bot_pending_entries')
      .select('*')
      .eq('id', pendingId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    assertOk(error);
    return mapPending(data);
  }

  async deletePendingEntry(pendingId) {
    const { error } = await this.client.from('bot_pending_entries').delete().eq('id', pendingId);
    assertOk(error);
  }
}
