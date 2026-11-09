import test from 'node:test';
import assert from 'node:assert/strict';
import { seedFoods } from '../src/database/seedFoods.js';
import { parseFoodMessage } from '../src/services/foodParser.js';
import { normalizeFoodName } from '../src/utils/foodText.js';

const foods = seedFoods.map((food, index) => ({
  ...food,
  id: `food_seed_${index}`,
  nameNormalized: normalizeFoodName(food.name),
}));

const find = (items, name) => items.find((item) => item.name === name);

test('parses «Съела 2 яйца и 100 грамм хлеба»', () => {
  const result = parseFoodMessage('Съела 2 яйца и 100 грамм хлеба', foods);
  assert.equal(result.items.length, 2);
  const eggs = find(result.items, 'Яйцо куриное');
  const bread = find(result.items, 'Хлеб пшеничный');
  assert.ok(eggs, 'egg should be matched');
  assert.ok(bread, 'bread should be matched');
  assert.equal(eggs.amountGrams, 110);
  assert.equal(bread.amountGrams, 100);
  assert.equal(result.totals.calories, 436); // 171 + 265
});

test('parses grams placed after the product name', () => {
  const result = parseFoodMessage('Банан 150 г', foods);
  const banana = find(result.items, 'Банан');
  assert.ok(banana);
  assert.equal(banana.amountGrams, 150);
  assert.equal(banana.calories, 133.5);
});

test('supports Russian number words', () => {
  const result = parseFoodMessage('два банана и три яйца', foods);
  assert.equal(find(result.items, 'Банан').amountGrams, 240);
  assert.equal(find(result.items, 'Яйцо куриное').amountGrams, 165);
});

test('supports inflected product names', () => {
  const result = parseFoodMessage('съел курицы 150 г и гречки 100 г', foods);
  assert.ok(result.items.some((item) => /Куриная грудка/.test(item.name)));
  assert.ok(result.items.some((item) => /Гречка/.test(item.name)));
});

test('parses kilograms and spoons', () => {
  const result = parseFoodMessage('0.5 кг творога и столовая ложка мёда', foods);
  assert.equal(find(result.items, 'Творог 2%').amountGrams, 500);
  assert.equal(find(result.items, 'Мёд').amountGrams, 15);
});

test('returns an empty result instead of inventing products', () => {
  const result = parseFoodMessage('съел что-то странное', foods);
  assert.equal(result.items.length, 0);
  assert.equal(result.totals.calories, 0);
});

test('does not match a product inside an unrelated word', () => {
  const result = parseFoodMessage('сырный соус', foods);
  // "сыр" must not match inside "сырный"; "соус" is not in the reference DB.
  assert.equal(result.items.some((item) => item.name === 'Сыр твёрдый'), false);
});

test('merges repeated mentions of the same product', () => {
  const result = parseFoodMessage('100 г банана и ещё 50 г банана', foods);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amountGrams, 150);
});

test('marks estimated portions as approximate', () => {
  const result = parseFoodMessage('банан', foods);
  assert.equal(result.items[0].amountGrams, 120);
  assert.equal(result.items[0].approximate, true);
});
