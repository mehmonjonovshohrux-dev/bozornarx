// The demo accounts: one fixed list, used by the seed, the prune script and the printed hand-over sheet.
export const DEMO_DOMAIN = '@example.com';
export const DEMO_SELLERS = [
  { local: 'demo.seller1', name: 'Akmal Karimov', store: '[DEMO] Chorsu Mevasabzavot', region: 'Toshkent shahri', market: '[DEMO] Chorsu bozori', status: 'VERIFIED' },
  { local: 'demo.seller2', name: 'Dilnoza Rasulova', store: '[DEMO] Yunusobod Market', region: 'Toshkent shahri', market: null, status: 'VERIFIED' },
  { local: 'demo.seller3', name: 'Jasur Tursunov', store: '[DEMO] Siyob Savdo', region: 'Samarqand viloyati', market: '[DEMO] Siyob bozori', status: 'VERIFIED' },
  { local: 'demo.seller4', name: 'Malika Yusupova', store: '[DEMO] Farg‘ona Dehqon', region: 'Farg‘ona viloyati', market: null, status: 'VERIFIED' },
  { local: 'demo.seller5', name: 'Bobur Ergashev', store: '[DEMO] Yangi Do‘kon (tasdiq kutilmoqda)', region: 'Toshkent viloyati', market: null, status: 'PENDING' },
] as const;
export const DEMO_BUYERS = [['demo.buyer1', 'Sardor Aliyev'], ['demo.buyer2', 'Nodira Karimova'], ['demo.buyer3', 'Otabek Qodirov'], ['demo.buyer4', 'Zilola Ahmedova']] as const;
export const DEMO_MODERATORS = [['demo.moderator1', 'Demo Moderator']] as const;
export const demoEmails = (): string[] => [...DEMO_SELLERS.map((s) => s.local), ...DEMO_BUYERS.map((b) => b[0]), ...DEMO_MODERATORS.map((m) => m[0])].map((l) => `${l}${DEMO_DOMAIN}`);
