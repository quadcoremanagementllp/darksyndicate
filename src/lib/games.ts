import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export interface DefaultGameDef {
  slug: string;
  title: string;
  platform: 'PS5' | 'POOL_TABLE' | 'PC' | 'VR' | 'OTHER';
  genre: string;
  description: string;
  coverImage: string;
  maxPlayers: number;
  isFeatured?: boolean;
  stationIds?: string[];
  displayOrder: number;
}

export const DEFAULT_ARENA_GAMES: DefaultGameDef[] = [
  {
    slug: 'ea-sports-fc-24',
    title: 'EA Sports FC 24',
    platform: 'PS5',
    genre: 'Sports',
    description: 'The pinnacle club football experience with HyperMotionV, PlayStyles optimized by Opta, and revolutionized Frostbite Engine.',
    coverImage: '/games/ea-sports-fc-24.jpg',
    maxPlayers: 4,
    isFeatured: true,
    displayOrder: 1,
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
    displayOrder: 2,
  },
  {
    slug: 'marvels-spider-man-2',
    title: "Marvel's Spider-Man 2",
    platform: 'PS5',
    genre: 'Action-Adventure',
    description: 'Swing, jump, and utilize the new Web Wings to travel across Marvel’s New York with Peter Parker and Miles Morales.',
    coverImage: '/games/spiderman-2.jpg',
    maxPlayers: 1,
    isFeatured: true,
    displayOrder: 3,
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
    displayOrder: 4,
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
    displayOrder: 5,
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
    displayOrder: 6,
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
    displayOrder: 7,
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
    displayOrder: 8,
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
    displayOrder: 9,
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
    displayOrder: 10,
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
    displayOrder: 11,
  },
];

/**
 * Ensures default arena games exist in the database.
 */
export async function ensureDefaultGames() {
  const count = await prisma.game.count();
  if (count > 0) return;

  for (const game of DEFAULT_ARENA_GAMES) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: {
        id: randomUUID(),
        slug: game.slug,
        title: game.title,
        platform: game.platform,
        genre: game.genre,
        description: game.description,
        coverImage: game.coverImage,
        maxPlayers: game.maxPlayers,
        isFeatured: game.isFeatured || false,
        isActive: true,
        displayOrder: game.displayOrder,
      },
    });
  }
}

/**
 * Filters games that are installed on a specific station.
 * If a game has no stationIds or empty stationIds, it is available across all stations of that platform.
 * If stationIds contains the stationId, it is installed on that station.
 */
export function isGameInstalledOnStation(
  game: { platform: string; stationIds?: any },
  stationId: string,
  stationType: string
): boolean {
  if (game.platform !== stationType) return false;
  if (!game.stationIds) return true; // Available on all stations of this platform

  let ids: string[] = [];
  if (Array.isArray(game.stationIds)) {
    ids = game.stationIds;
  } else if (typeof game.stationIds === 'string') {
    try {
      ids = JSON.parse(game.stationIds);
    } catch {
      ids = [game.stationIds];
    }
  }

  if (ids.length === 0) return true;
  return ids.includes(stationId);
}
