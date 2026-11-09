import { z } from 'zod';
import { isValidTimeZone } from '../utils/time.js';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате ГГГГ-ММ-ДД');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время должно быть в формате ЧЧ:ММ');
const timezone = z.string().refine(isValidTimeZone, 'Неизвестный часовой пояс');
const idString = z.string().min(3).max(80);

export const authSchema = z.object({
  initData: z.string().min(20).max(8192),
});

export const devAuthSchema = z
  .object({ telegramId: z.string().regex(/^\d{1,20}$/).optional() })
  .strict();

export const profileSchema = z
  .object({
    age: z.number().int().min(14).max(100),
    height: z.number().min(100).max(250),
    weight: z.number().min(30).max(300),
    targetWeight: z.number().min(30).max(300).nullable().optional(),
    sex: z.enum(['male', 'female', 'other']),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    goal: z.enum(['lose', 'maintain', 'gain']),
    timezone,
  })
  .strict();

export const goalsSchema = z
  .object({
    calories: z.number().int().min(1000).max(6000),
    protein: z.number().min(0).max(500),
    fat: z.number().min(0).max(300),
    carbohydrates: z.number().min(0).max(1000),
    waterMl: z.number().int().min(500).max(8000).optional(),
  })
  .strict();

export const foodSearchSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
  external: z.enum(['0', '1']).optional(),
});

export const customFoodSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    calories: z.number().min(0).max(1000),
    protein: z.number().min(0).max(100),
    fat: z.number().min(0).max(100),
    carbohydrates: z.number().min(0).max(100),
    aliases: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    defaultServingGrams: z.number().min(1).max(5000).optional(),
    pieceGrams: z.number().min(1).max(2000).nullable().optional(),
  })
  .strict();

export const diaryAddSchema = z
  .object({
    productId: idString,
    amountGrams: z.number().min(0.1).max(5000),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    date: date.optional(),
    time: time.optional(),
  })
  .strict();

export const diaryUpdateSchema = z
  .object({
    productId: idString.optional(),
    amountGrams: z.number().min(0.1).max(5000).optional(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    date: date.optional(),
    time: time.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Нет данных для обновления');

export const diaryCopySchema = z
  .object({
    fromDate: date,
    toDate: date,
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().optional(),
  })
  .strict();

export const waterSchema = z
  .object({
    date: date.optional(),
    amountMl: z.number().int().min(-5000).max(5000),
    goalMl: z.number().int().min(500).max(8000).optional(),
    mode: z.enum(['add', 'set']).optional().default('add'),
  })
  .strict();

export const weightSchema = z
  .object({
    weight: z.number().min(30).max(300),
    date: date.optional(),
  })
  .strict();

export const measurementSchema = z
  .object({
    date: date.optional(),
    waist: z.number().min(30).max(250).nullable().optional(),
    hips: z.number().min(30).max(250).nullable().optional(),
    chest: z.number().min(30).max(250).nullable().optional(),
    note: z.string().trim().max(280).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => [value.waist, value.hips, value.chest].some((item) => item != null),
    'Укажите хотя бы один параметр',
  );

export const photoSchema = z
  .object({
    dataUrl: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Некорректное изображение')
      .max(700000, 'Фото слишком большое (максимум ~500 КБ)'),
    date: date.optional(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const remindersSchema = z
  .object({
    remindersEnabled: z.boolean().optional(),
    morningEnabled: z.boolean().optional(),
    breakfastEnabled: z.boolean().optional(),
    lunchEnabled: z.boolean().optional(),
    dinnerEnabled: z.boolean().optional(),
    eveningEnabled: z.boolean().optional(),
    waterEnabled: z.boolean().optional(),
    morningTime: time.optional(),
    breakfastTime: time.optional(),
    lunchTime: time.optional(),
    dinnerTime: time.optional(),
    eveningTime: time.optional(),
    quietStart: time.optional(),
    quietEnd: time.optional(),
    waterIntervalHours: z.number().int().min(1).max(12).optional(),
    timezone: timezone.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Нет настроек для обновления');

export const periodSchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
});

export const dashboardQuerySchema = z.object({
  date: date.optional(),
});

export const dateParamSchema = z.object({ date });

export const idParamSchema = z.object({ id: idString });
export const productParamSchema = z.object({ productId: idString });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
