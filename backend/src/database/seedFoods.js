/**
 * Curated reference food data (per 100 g). Values are rounded averages from
 * public food-composition tables (USDA FoodData Central, McCance & Widdowson,
 * Russian tables of food composition). They are intentionally labelled
 * `reference`, not presented as exact brand values. Users can create custom
 * products, and FOOD_API_KEY enables live USDA lookups.
 */
const f = (name, calories, protein, fat, carbohydrates, options = {}) => ({
  name,
  calories,
  protein,
  fat,
  carbohydrates,
  source: 'reference',
  sourceId: options.id || `ref-${name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-')}`,
  category: options.category || 'Прочее',
  emoji: options.emoji || '🍽️',
  aliases: options.aliases || [],
  defaultServingGrams: options.serving || 100,
  pieceGrams: options.piece || null,
});

export const seedFoods = [
  // Fruits and berries
  f('Банан', 89, 1.1, 0.3, 22.8, { category: 'Фрукты', emoji: '🍌', serving: 120, piece: 120, aliases: ['бананы', 'бананчик'] }),
  f('Яблоко', 52, 0.3, 0.2, 13.8, { category: 'Фрукты', emoji: '🍎', serving: 180, piece: 180, aliases: ['яблоки', 'яблочко'] }),
  f('Апельсин', 47, 0.9, 0.1, 11.8, { category: 'Фрукты', emoji: '🍊', serving: 150, piece: 150, aliases: ['апельсины'] }),
  f('Груша', 57, 0.4, 0.1, 15.2, { category: 'Фрукты', emoji: '🍐', serving: 170, piece: 170, aliases: ['груши'] }),
  f('Клубника', 32, 0.7, 0.3, 7.7, { category: 'Фрукты', emoji: '🍓', aliases: ['земляника'] }),
  f('Виноград', 69, 0.7, 0.2, 18.1, { category: 'Фрукты', emoji: '🍇' }),
  f('Киви', 61, 1.1, 0.5, 14.7, { category: 'Фрукты', emoji: '🥝', serving: 90, piece: 90 }),
  f('Черника', 57, 0.7, 0.3, 14.5, { category: 'Фрукты', emoji: '🫐' }),
  f('Арбуз', 30, 0.6, 0.2, 7.6, { category: 'Фрукты', emoji: '🍉' }),
  f('Авокадо', 160, 2, 14.7, 8.5, { category: 'Фрукты', emoji: '🥑', serving: 150, piece: 150, aliases: ['авокады'] }),

  // Vegetables
  f('Огурец', 15, 0.7, 0.1, 3.6, { category: 'Овощи', emoji: '🥒', serving: 100, piece: 120, aliases: ['огурцы'] }),
  f('Помидор', 18, 0.9, 0.2, 3.9, { category: 'Овощи', emoji: '🍅', serving: 100, piece: 110, aliases: ['томат', 'томаты', 'помидоры'] }),
  f('Морковь', 41, 0.9, 0.2, 9.6, { category: 'Овощи', emoji: '🥕', serving: 80, piece: 80, aliases: ['морковка'] }),
  f('Брокколи', 34, 2.8, 0.4, 6.6, { category: 'Овощи', emoji: '🥦', aliases: ['брокколи'] }),
  f('Кабачок', 17, 1.2, 0.3, 3.1, { category: 'Овощи', emoji: '🥒', aliases: ['кабачки', 'цукини'] }),
  f('Перец болгарский', 31, 1, 0.3, 6, { category: 'Овощи', emoji: '🫑', serving: 120, piece: 120, aliases: ['перец', 'сладкий перец', 'перцы'] }),
  f('Капуста белокочанная', 25, 1.3, 0.1, 5.8, { category: 'Овощи', emoji: '🥬', aliases: ['капуста'] }),
  f('Картофель отварной', 87, 2, 0.1, 20.1, { category: 'Овощи', emoji: '🥔', serving: 150, piece: 150, aliases: ['картошка', 'картофель'] }),
  f('Шпинат', 23, 2.9, 0.4, 3.6, { category: 'Овощи', emoji: '🥬', aliases: ['шпинат'] }),
  f('Свёкла отварная', 44, 1.7, 0.2, 9.6, { category: 'Овощи', emoji: '🍠', aliases: ['свекла', 'свёкла'] }),

  // Grains and bread
  f('Рис отварной', 130, 2.7, 0.3, 28.2, { category: 'Крупы', emoji: '🍚', serving: 150, aliases: ['рис'] }),
  f('Гречка отварная', 110, 4.2, 1.1, 21.3, { category: 'Крупы', emoji: '🍚', serving: 150, aliases: ['гречка', 'гречневая каша'] }),
  f('Овсянка на воде', 88, 3, 1.5, 15, { category: 'Крупы', emoji: '🥣', serving: 200, aliases: ['овсянка', 'овсяная каша', 'геркулес'] }),
  f('Паста отварная', 158, 5.8, 0.9, 30.9, { category: 'Крупы', emoji: '🍝', serving: 180, aliases: ['макароны', 'паста', 'спагетти'] }),
  f('Хлеб пшеничный', 265, 9, 3.2, 49, { category: 'Хлеб', emoji: '🍞', serving: 30, piece: 30, aliases: ['хлеб', 'белый хлеб', 'батон'] }),
  f('Хлеб ржаной', 250, 8.5, 3.3, 48, { category: 'Хлеб', emoji: '🍞', serving: 30, piece: 30, aliases: ['чёрный хлеб', 'черный хлеб', 'ржаной'] }),
  f('Мюсли без сахара', 360, 10, 7, 64, { category: 'Крупы', emoji: '🥣', aliases: ['мюсли', 'гранола'] }),
  f('Кукуруза отварная', 96, 3.4, 1.5, 21, { category: 'Овощи', emoji: '🌽', serving: 120, aliases: ['кукуруза'] }),

  // Protein
  f('Яйцо куриное', 155, 12.6, 10.6, 1.1, { category: 'Белок', emoji: '🥚', serving: 55, piece: 55, aliases: ['яйцо', 'яйца', 'яиц', 'яичко'] }),
  f('Куриная грудка отварная', 165, 31, 3.6, 0, { category: 'Белок', emoji: '🍗', serving: 150, aliases: ['курица', 'куриная грудка', 'куриное филе', 'грудка'] }),
  f('Куриное бедро', 209, 26, 10.9, 0, { category: 'Белок', emoji: '🍗', serving: 150, aliases: ['бедро', 'куриное бедро'] }),
  f('Индейка филе', 135, 29, 1.8, 0, { category: 'Белок', emoji: '🦃', serving: 150, aliases: ['индейка', 'филе индейки'] }),
  f('Говядина тушёная', 250, 26, 15, 0, { category: 'Белок', emoji: '🥩', serving: 150, aliases: ['говядина', 'мясо'] }),
  f('Лосось', 208, 20, 13, 0, { category: 'Рыба', emoji: '🐟', serving: 150, aliases: ['семга', 'сёмга', 'лосось', 'красная рыба'] }),
  f('Тунец консервированный', 116, 25.5, 0.8, 0, { category: 'Рыба', emoji: '🐟', serving: 100, aliases: ['тунец'] }),
  f('Треска', 82, 18, 0.7, 0, { category: 'Рыба', emoji: '🐟', serving: 150, aliases: ['треска', 'белая рыба'] }),
  f('Креветки', 99, 24, 0.3, 0.2, { category: 'Рыба', emoji: '🦐', serving: 100, aliases: ['креветка', 'креветки'] }),
  f('Тофу', 76, 8, 4.8, 1.9, { category: 'Белок', emoji: '🧊', serving: 150, aliases: ['тофу', 'соевый творог'] }),
  f('Фасоль отварная', 127, 8.7, 0.5, 22.8, { category: 'Белок', emoji: '🫘', serving: 150, aliases: ['фасоль', 'красная фасоль'] }),
  f('Чечевица отварная', 116, 9, 0.4, 20, { category: 'Белок', emoji: '🫘', serving: 150, aliases: ['чечевица'] }),
  f('Нут отварной', 164, 8.9, 2.6, 27.4, { category: 'Белок', emoji: '🫘', serving: 150, aliases: ['нут', 'турецкий горох'] }),

  // Dairy
  f('Творог 2%', 104, 18, 2, 3.3, { category: 'Молочное', emoji: '🥛', serving: 150, aliases: ['творог'] }),
  f('Творог 5%', 121, 17, 5, 3, { category: 'Молочное', emoji: '🥛', serving: 150, aliases: ['жирный творог'] }),
  f('Молоко 2,5%', 52, 2.9, 2.5, 4.7, { category: 'Молочное', emoji: '🥛', serving: 200, aliases: ['молоко'] }),
  f('Кефир 1%', 40, 3, 1, 4, { category: 'Молочное', emoji: '🥛', serving: 200, aliases: ['кефир'] }),
  f('Йогурт натуральный', 66, 4.3, 3.2, 4.5, { category: 'Молочное', emoji: '🥣', serving: 150, aliases: ['йогурт', 'греческий йогурт'] }),
  f('Сыр твёрдый', 380, 25, 30, 2, { category: 'Молочное', emoji: '🧀', serving: 30, piece: 30, aliases: ['сыр', 'твёрдый сыр', 'твердый сыр'] }),
  f('Сметана 20%', 206, 2.8, 20, 3.2, { category: 'Молочное', emoji: '🥛', serving: 20, aliases: ['сметана'] }),

  // Fats and nuts
  f('Масло сливочное', 717, 0.9, 81, 0.1, { category: 'Жиры', emoji: '🧈', serving: 10, aliases: ['сливочное масло', 'масло'] }),
  f('Масло оливковое', 884, 0, 100, 0, { category: 'Жиры', emoji: '🫒', serving: 10, aliases: ['оливковое масло'] }),
  f('Миндаль', 579, 21, 50, 21.6, { category: 'Орехи', emoji: '🌰', serving: 30, aliases: ['миндаль'] }),
  f('Грецкий орех', 654, 15, 65, 14, { category: 'Орехи', emoji: '🌰', serving: 30, aliases: ['грецкие орехи', 'орехи'] }),
  f('Арахисовая паста', 588, 25, 50, 20, { category: 'Орехи', emoji: '🥜', serving: 20, aliases: ['арахисовая паста', 'паста из арахиса'] }),
  f('Семена чиа', 486, 16.5, 30.7, 42.1, { category: 'Орехи', emoji: '🌱', serving: 15, aliases: ['чиа'] }),

  // Prepared food (approximate)
  f('Омлет', 154, 10.6, 11.2, 1.4, { category: 'Блюда', emoji: '🍳', serving: 150, aliases: ['омлет'] }),
  f('Сырники', 220, 14, 8, 24, { category: 'Блюда', emoji: '🥞', serving: 150, aliases: ['сырники'] }),
  f('Блинчики', 227, 6, 9, 30, { category: 'Блюда', emoji: '🥞', serving: 120, aliases: ['блины', 'блинчики'] }),
  f('Борщ', 50, 1.5, 2.5, 5, { category: 'Блюда', emoji: '🍲', serving: 300, aliases: ['борщ'] }),
  f('Суп куриный', 40, 3, 1.5, 3, { category: 'Блюда', emoji: '🍲', serving: 300, aliases: ['куриный суп', 'суп'] }),
  f('Плов', 180, 6, 6, 26, { category: 'Блюда', emoji: '🍚', serving: 250, aliases: ['плов'] }),
  f('Оливье', 180, 4, 14, 10, { category: 'Блюда', emoji: '🥗', serving: 150, aliases: ['салат оливье', 'оливье'] }),
  f('Пицца Маргарита', 266, 11, 10, 33, { category: 'Блюда', emoji: '🍕', serving: 150, aliases: ['пицца', 'маргарита'] }),
  f('Шаурма', 215, 10, 12, 18, { category: 'Блюда', emoji: '🌯', serving: 250, aliases: ['шаурма', 'шаверма'] }),
  f('Бургер', 295, 17, 14, 24, { category: 'Блюда', emoji: '🍔', serving: 220, aliases: ['бургер', 'гамбургер'] }),
  f('Картофель фри', 312, 3.4, 15, 41, { category: 'Блюда', emoji: '🍟', serving: 100, aliases: ['фри', 'картошка фри'] }),
  f('Ролл Филадельфия', 190, 7, 9, 20, { category: 'Блюда', emoji: '🍣', serving: 200, aliases: ['роллы', 'суши', 'филадельфия'] }),
  f('Хумус', 166, 7.9, 9.6, 14.3, { category: 'Блюда', emoji: '🥣', serving: 50, aliases: ['хумус'] }),

  // Snacks, drinks, condiments
  f('Шоколад тёмный 70%', 598, 7.8, 42.6, 45.9, { category: 'Сладкое', emoji: '🍫', serving: 20, aliases: ['шоколад', 'темный шоколад', 'тёмный шоколад'] }),
  f('Печенье овсяное', 450, 6, 18, 65, { category: 'Сладкое', emoji: '🍪', serving: 20, piece: 20, aliases: ['печенье', 'овсяное печенье'] }),
  f('Мороженое', 207, 3.5, 11, 24, { category: 'Сладкое', emoji: '🍦', serving: 100, aliases: ['мороженое'] }),
  f('Мёд', 304, 0.3, 0, 82.4, { category: 'Сладкое', emoji: '🍯', serving: 15, aliases: ['мед', 'мёд'] }),
  f('Сахар', 387, 0, 0, 100, { category: 'Сладкое', emoji: '🧂', serving: 5, aliases: ['сахар'] }),
  f('Кола', 42, 0, 0, 10.6, { category: 'Напитки', emoji: '🥤', serving: 330, aliases: ['кола', 'coca cola', 'кока кола'] }),
  f('Апельсиновый сок', 45, 0.7, 0.2, 10.4, { category: 'Напитки', emoji: '🧃', serving: 200, aliases: ['сок апельсиновый', 'апельсиновый сок'] }),
  f('Кофе чёрный', 2, 0.1, 0, 0, { category: 'Напитки', emoji: '☕', serving: 200, aliases: ['кофе', 'черный кофе', 'чёрный кофе'] }),
  f('Чай без сахара', 1, 0, 0, 0, { category: 'Напитки', emoji: '🍵', serving: 200, aliases: ['чай'] }),
  f('Соевый соус', 53, 8, 0, 4.9, { category: 'Соусы', emoji: '🧂', serving: 15, aliases: ['соевый соус'] }),
  f('Кетчуп', 101, 1.2, 0.2, 25, { category: 'Соусы', emoji: '🍅', serving: 15, aliases: ['кетчуп'] }),
  f('Майонез', 680, 1, 75, 2.6, { category: 'Соусы', emoji: '🥚', serving: 15, aliases: ['майонез'] }),
];

export const seedFoodNames = new Set(seedFoods.map((food) => food.name));
