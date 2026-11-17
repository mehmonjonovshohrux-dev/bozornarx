// REAL PHOTOS (Unsplash, free to use under the Unsplash License: https://unsplash.com/license — no attribution required, credit kept below).
// Single source of truth: product / category / hero name → photo link. Photo IDs were copied from each photo's own Unsplash page
// (never guessed). Not AI-generated, not drawn. To change a photo, edit only the link here.
// Scope: these are the DEMO / default photos. A photo uploaded by a seller (product.images) always wins in <ProductImage> and is never replaced.
// Link format: https://images.unsplash.com/photo-<ID>?auto=format&fit=crop&w=900&q=75
export const PHOTOS: Record<string, string> = {
  'Pomidor': 'https://images.unsplash.com/photo-1683354918366-ad5c9aacbf40?auto=format&fit=crop&w=900&q=75',
  'Kartoshka': 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=900&q=75',
  'Piyoz': 'https://images.unsplash.com/photo-1649061261110-bc15568a3822?auto=format&fit=crop&w=900&q=75',
  'Sabzi': 'https://images.unsplash.com/photo-1633380110125-f6e685676160?auto=format&fit=crop&w=900&q=75',
  'Bodring': 'https://images.unsplash.com/photo-1568584711271-6c929fb49b60?auto=format&fit=crop&w=900&q=75',
  'Olma': 'https://images.unsplash.com/photo-1501925654609-7b41cf395eb8?auto=format&fit=crop&w=900&q=75',
  'Mol go‘shti': 'https://images.unsplash.com/photo-1596895404493-2b74961c0cc4?auto=format&fit=crop&w=900&q=75',
  'Tovuq go‘shti': 'https://images.unsplash.com/photo-1672787153720-e85fe802fd9f?auto=format&fit=crop&w=900&q=75',
  'Tuxum': 'https://images.unsplash.com/photo-1660224286794-fc173fa9295c?auto=format&fit=crop&w=900&q=75',
  'Sut': 'https://images.unsplash.com/photo-1635436338433-89747d0ca0ef?auto=format&fit=crop&w=900&q=75',
  'Un': 'https://images.unsplash.com/photo-1714842981153-ffeaf74e7a1a?auto=format&fit=crop&w=900&q=75',
  'Guruch': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=75',
  'O‘simlik yog‘i': 'https://images.unsplash.com/photo-1552592074-ea7a91b851b3?auto=format&fit=crop&w=900&q=75',
  'Shakar': 'https://images.unsplash.com/photo-1562245376-3f9dae9f0e73?auto=format&fit=crop&w=900&q=75',
  'Non': 'https://images.unsplash.com/photo-1535225192997-f901a0de048d?auto=format&fit=crop&w=900&q=75',
  'Ichimliklar': 'https://images.unsplash.com/photo-1603569283847-aa295f0d016a?auto=format&fit=crop&w=900&q=75',
  'Uy-ro‘zg‘or': 'https://images.unsplash.com/photo-1756158448893-ffac8a29f986?auto=format&fit=crop&w=900&q=75',
  'Bozor (bosh sahifa)': 'https://images.unsplash.com/photo-1762494743525-bf2f92b142b7?auto=format&fit=crop&w=900&q=75',
};

// Credits (photographer → original page) for transparency and easy replacement.
export const PHOTO_CREDITS: Record<string, { by: string; page: string }> = {
  'Pomidor': { by: 'engin akyurt', page: 'https://unsplash.com/photos/a-large-pile-of-red-and-green-tomatoes-HrCatSbULFY' },
  'Kartoshka': { by: 'Rodrigo dos Reis', page: 'https://unsplash.com/photos/pile-of-raw-yellow-potatoes-h3AkzboxK4Q' },
  'Piyoz': { by: 'Annie Spratt', page: 'https://unsplash.com/photos/a-bunch-of-onions-that-are-laying-on-the-ground-eD7GT0qkJpg' },
  'Sabzi': { by: 'Nick Fewings', page: 'https://unsplash.com/photos/IZq1FV87qpM' },
  'Bodring': { by: 'Eric Prouzet', page: 'https://unsplash.com/photos/green-cucumber-lot-Ky6x9T8j128' },
  'Olma': { by: 'Caroline Attwood', page: 'https://unsplash.com/photos/adJrYKoONL4' },
  'Mol go‘shti': { by: 'Kyle Mackie', page: 'https://unsplash.com/photos/_ETocJt6ZBc' },
  'Tovuq go‘shti': { by: 'Hayley Ryczek', page: 'https://unsplash.com/photos/a-raw-chicken-on-a-cutting-board-with-herbs-and-seasonings-oqZ7gu3ytDg' },
  'Tuxum': { by: 'Erin Larson', page: 'https://unsplash.com/photos/a-carton-of-eggs-jIfVrNrhbI8' },
  'Sut': { by: 'Jack Cole', page: 'https://unsplash.com/photos/a-bottle-of-organic-milk-sitting-on-a-table-4PhVsBICtJQ' },
  'Un': { by: 'Roman Matveev', page: 'https://unsplash.com/photos/a-bowl-of-flour-sitting-on-top-of-a-table-quVArOn8-30' },
  'Guruch': { by: 'Pierre Bamin', page: 'https://unsplash.com/photos/raw-white-rice-grains-background--LdilhDx3sk' },
  'O‘simlik yog‘i': { by: 'jonathan ocampo', page: 'https://unsplash.com/photos/oil-dispenser-bottle-iCgfwfqgdzo' },
  'Shakar': { by: 'Alexander Grey', page: 'https://unsplash.com/photos/spoon-of-powder-oKay0q7Pa30' },
  'Non': { by: 'Jørgen Håland', page: 'https://unsplash.com/photos/PvAl4A6hHh8' },
  'Ichimliklar': { by: 'Zlatko Đurić', page: 'https://unsplash.com/photos/fruits-and-vegetable-in-clear-glass-jar-U4QkDQW84sg' },
  'Uy-ro‘zg‘or': { by: 'Babak Eshaghian', page: 'https://unsplash.com/photos/shelves-stocked-with-various-bottles-of-shampoo-and-conditioner-QsBEQHziaDw' },
  'Bozor (bosh sahifa)': { by: 'Sloane Yerger', page: 'https://unsplash.com/photos/fresh-produce-displayed-at-an-outdoor-market-stall-g4aTGlvoAxs' },
};

// Category name/slug → photo key above (first match wins).
export const CATEGORY_PHOTO_RULES: Array<[RegExp, string]> = [
  [/sabzavot|kartoshka|pomidor|kokat/, 'Sabzi'], [/meva|sitrus|quruq/, 'Olma'], [/gosht|parranda|tovuq|tuxum/, 'Mol go‘shti'],
  [/sut|qatiq|pishloq/, 'Sut'], [/non|^un|makaron/, 'Non'], [/don|yorma|guruch|grechka|dukkak/, 'Guruch'],
  [/yog|ziravor|tuz|shakar/, 'Shakar'], [/ichimlik|suv|choy|qahva|sharbat/, 'Ichimliklar'], [/uy-rozgor|uy rozgor|tozalash|gigiyena/, 'Uy-ro‘zg‘or'],
];
