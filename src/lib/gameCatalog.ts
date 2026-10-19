export interface GameCatalogItem {
  slug: string;
  title: string;
  platform: 'PS5' | 'POOL_TABLE';
  genre: string;
  description: string;
  coverImage: string;
  maxPlayers: number;
  isFeatured?: boolean;
}

export const ARENA_GAMES: GameCatalogItem[] = [
  {
    slug: 'ea-sports-fc-24',
    title: 'EA Sports FC 24',
    platform: 'PS5',
    genre: 'Sports',
    description: 'The pinnacle club football experience with HyperMotionV, PlayStyles optimized by Opta, and revolutionized Frostbite Engine.',
    coverImage: '/games/ea-sports-fc-24.jpg',
    maxPlayers: 4,
    isFeatured: true,
  },
  {
    slug: 'tekken-8',
    title: 'Tekken 8',
    platform: 'PS5',
    genre: 'Fighting',
    description: 'Next-gen fighting spectacle powered by Unreal Engine 5 with the brand-new Heat System and bone-crushing stage destructions.',
    coverImage: '/games/tekken-8.jpg',
    maxPlayers: 2,
    isFeatured: true,
  },
  {
    slug: 'marvels-spider-man-2',
    title: "Marvel's Spider-Man 2",
    platform: 'PS5',
    genre: 'Action-Adventure',
    description: 'Swing across Marvel’s New York with Peter Parker and Miles Morales using Web Wings and Symbiote abilities.',
    coverImage: '/games/spiderman-2.jpg',
    maxPlayers: 1,
    isFeatured: true,
  },
  {
    slug: 'mortal-kombat-1',
    title: 'Mortal Kombat 1',
    platform: 'PS5',
    genre: 'Fighting',
    description: 'Discover a reborn Mortal Kombat Universe created by Fire God Liu Kang, featuring the brutal new Kameo Fighter system.',
    coverImage: '/games/mortal-kombat-1.jpg',
    maxPlayers: 2,
    isFeatured: false,
  },
  {
    slug: 'gta-v',
    title: 'GTA V',
    platform: 'PS5',
    genre: 'Action / Open World',
    description: 'Experience blockbuster entertainment in Los Santos with enhanced 4K 60FPS visuals on PS5.',
    coverImage: '/games/gta-v.jpg',
    maxPlayers: 1,
    isFeatured: true,
  },
  {
    slug: 'wwe-2k24',
    title: 'WWE 2K24',
    platform: 'PS5',
    genre: 'Sports',
    description: 'Celebrate 40 Years of WrestleMania featuring iconic legends, new match types like Casket and Special Guest Referee.',
    coverImage: '/games/wwe-2k24.jpg',
    maxPlayers: 4,
    isFeatured: false,
  },
  {
    slug: 'it-takes-two',
    title: 'It Takes Two',
    platform: 'PS5',
    genre: 'Co-op Adventure',
    description: 'Pure co-op perfection. Embark on the craziest journey of your life in this genre-bending platform adventure built purely for two.',
    coverImage: '/games/it-takes-two.jpg',
    maxPlayers: 2,
    isFeatured: true,
  },
  {
    slug: 'call-of-duty-mw3',
    title: 'Call of Duty: Modern Warfare III',
    platform: 'PS5',
    genre: 'Shooter',
    description: 'Fast-paced multiplayer action with modern weaponry, iconic maps, and intense competitive firefights.',
    coverImage: '/games/call-of-duty-mw3.jpg',
    maxPlayers: 2,
    isFeatured: false,
  },
  {
    slug: 'gran-turismo-7',
    title: 'Gran Turismo 7',
    platform: 'PS5',
    genre: 'Racing',
    description: 'The Real Driving Simulator. Recreates the look and feel of legendary supercars and tracks with unmatched physical detail.',
    coverImage: '/games/gran-turismo-7.jpg',
    maxPlayers: 2,
    isFeatured: false,
  },
  {
    slug: 'god-of-war-ragnarok',
    title: 'God of War Ragnarök',
    platform: 'PS5',
    genre: 'Action-Adventure',
    description: 'Join Kratos and Atreus on a mythic journey for answers before Ragnarök arrives across the stunning Nine Realms.',
    coverImage: '/games/god-of-war-ragnarok.jpg',
    maxPlayers: 1,
    isFeatured: true,
  },
  {
    slug: 'nba-2k24',
    title: 'NBA 2K24',
    platform: 'PS5',
    genre: 'Sports',
    description: 'Experience hoop culture with ProPLAY technology, lifelike animations, and intense 1v1 to squad basketball action.',
    coverImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80',
    maxPlayers: 4,
    isFeatured: false,
  },
  {
    slug: 'overcooked-all-you-can-eat',
    title: 'Overcooked! All You Can Eat',
    platform: 'PS5',
    genre: 'Co-op Party',
    description: 'Deliciously chaotic cooperative cooking game remastered in 4K with hundreds of levels of culinary madness.',
    coverImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80',
    maxPlayers: 4,
    isFeatured: false,
  },
  {
    slug: 'rocket-league',
    title: 'Rocket League',
    platform: 'PS5',
    genre: 'Sports / Action',
    description: 'High-powered hybrid of arcade-style soccer and vehicular mayhem with fluid physics and aerial acrobatics.',
    coverImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80',
    maxPlayers: 4,
    isFeatured: false,
  },
  {
    slug: 'championship-snooker',
    title: 'Championship English Snooker',
    platform: 'POOL_TABLE',
    genre: 'Billiards',
    description: 'Official 15-red regulation rules on tournament-grade Strachan 6811 cloth with premium Aramith Tournament balls.',
    coverImage: 'https://images.unsplash.com/photo-1615655406736-b37c4fabf923?w=600&auto=format&fit=crop&q=80',
    maxPlayers: 4,
    isFeatured: true,
  },
  {
    slug: 'american-8-ball-pool',
    title: 'American 8-Ball & 9-Ball Pool',
    platform: 'POOL_TABLE',
    genre: 'Billiards',
    description: 'Competitive 8-Ball and fast-paced 9-Ball rotation play with precision cues, shadowless LED canopy lighting.',
    coverImage: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=600&auto=format&fit=crop&q=80',
    maxPlayers: 4,
    isFeatured: false,
  },
];

export const GAME_CATALOG_LOOKUP: Record<string, GameCatalogItem> = {
  ...Object.fromEntries(ARENA_GAMES.map((g) => [g.title.toLowerCase(), g])),
  ...Object.fromEntries(ARENA_GAMES.map((g) => [g.title, g])),
  'ea fc 24': ARENA_GAMES[0],
  'spider-man 2': ARENA_GAMES[2],
  'gta 5': ARENA_GAMES[4],
  'gta v': ARENA_GAMES[4],
  'grand theft auto v': ARENA_GAMES[4],
  'snooker': ARENA_GAMES[12],
  'english pool': ARENA_GAMES[12],
  '8-ball': ARENA_GAMES[13],
  'american 8-ball': ARENA_GAMES[13],
};

export function lookupGame(titleOrName: string): GameCatalogItem | undefined {
  if (!titleOrName) return undefined;
  const clean = titleOrName.trim();
  return GAME_CATALOG_LOOKUP[clean] || GAME_CATALOG_LOOKUP[clean.toLowerCase()];
}
