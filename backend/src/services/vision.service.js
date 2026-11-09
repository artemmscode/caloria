import { logger } from '../utils/logger.js';
import { normalizeFoodName } from '../utils/foodText.js';
import { scaleNutrition } from './nutrition.js';

const PROMPT = `Ты помогаешь оценить еду на фотографии для дневника питания.
Верни СТРОГО JSON без markdown:
{"items":[{"name":"русское название","grams":150,"calories":250,"protein":10,"fat":8,"carbohydrates":30}],"note":"краткое пояснение"}
Правила:
- Оценивай порции и калорийность приблизительно, по видимой тарелке.
- Если на фото несколько блюд, перечисли каждое отдельно.
- Не добавляй медицинские советы.
- Если еду невозможно распознать, верни {"items":[],"note":"..."}.
- Значения калорий и БЖУ — для указанного количества граммов.`;

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON in model response');
  return JSON.parse(text.slice(start, end + 1));
}

function findMatch(name, foods) {
  const normalized = normalizeFoodName(name);
  if (!normalized) return null;
  const exact = foods.find((food) => normalizeFoodName(food.name) === normalized);
  if (exact) return exact;
  const words = normalized.split(' ').filter((word) => word.length >= 4);
  return (
    foods.find((food) => {
      const foodName = normalizeFoodName(food.name);
      return words.some((word) => foodName.includes(word));
    }) || null
  );
}

/**
 * Optional photo estimate through an OpenAI-compatible vision endpoint.
 * Every result is explicitly marked approximate and requires confirmation.
 */
export async function recognizeFoodPhoto({ bot, photoUrl, foods, userId, repository, config }) {
  if (!config.openaiApiKey) {
    return { available: false, items: [], note: 'Распознавание фото не настроено.' };
  }
  try {
    const fileResponse = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!fileResponse.ok) throw new Error(`Telegram file download failed: ${fileResponse.status}`);
    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) throw new Error('Photo is too large');
    const mime = fileResponse.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openaiVisionModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Оцени блюда на фото и верни JSON.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Vision API responded ${response.status}`);
    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content || '';
    const parsed = extractJson(raw);

    const items = [];
    for (const estimate of parsed.items || []) {
      const grams = Math.max(10, Math.min(2000, Number(estimate.grams) || 100));
      const matched = findMatch(estimate.name, foods);
      if (matched) {
        items.push({
          productId: matched.id,
          name: matched.name,
          amountGrams: Math.round(grams),
          ...scaleNutrition(matched, grams),
          emoji: matched.emoji,
          approximate: true,
          estimated: true,
          source: matched.source,
        });
        continue;
      }
      const calories = Math.max(0, Number(estimate.calories) || 0);
      if (!calories) continue;
      const per100 = {
        calories: Math.round((calories / grams) * 100 * 10) / 10,
        protein: Math.round(((Number(estimate.protein) || 0) / grams) * 100 * 10) / 10,
        fat: Math.round(((Number(estimate.fat) || 0) / grams) * 100 * 10) / 10,
        carbohydrates: Math.round(((Number(estimate.carbohydrates) || 0) / grams) * 100 * 10) / 10,
      };
      const product = await repository.createFood({
        name: String(estimate.name || 'Блюдо с фото').slice(0, 100),
        ...per100,
        source: 'ai_estimate',
        category: 'Оценка по фото',
        emoji: '📷',
        createdBy: userId,
        isPublic: false,
      });
      items.push({
        productId: product.id,
        name: product.name,
        amountGrams: Math.round(grams),
        calories: Math.round(calories * 10) / 10,
        protein: Math.round((Number(estimate.protein) || 0) * 10) / 10,
        fat: Math.round((Number(estimate.fat) || 0) * 10) / 10,
        carbohydrates: Math.round((Number(estimate.carbohydrates) || 0) * 10) / 10,
        emoji: '📷',
        approximate: true,
        estimated: true,
        source: 'ai_estimate',
      });
    }
    return { available: true, items, note: parsed.note || null };
  } catch (error) {
    logger.warn('Photo recognition failed', { reason: error.message });
    return {
      available: false,
      items: [],
      note: 'Не удалось распознать фото. Опишите еду текстом — например, «омлет и 100 г хлеба».',
    };
  }
}
