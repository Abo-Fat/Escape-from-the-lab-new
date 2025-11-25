export enum Rarity {
  JUNK = 'Junk',
  COMMON = 'Common',
  RARE = 'Rare',
  LEGENDARY = 'Legendary'
}

export enum ItemType {
  MATERIAL = 'Material',
  WEAPON = 'Weapon',
  CONSUMABLE = 'Consumable',
  KEY = 'Key',
  DATA = 'Data'
}

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  type: ItemType;
  value: number;
  effect?: {
    hp?: number;
    sanity?: number;
    buff?: string;
  };
}

export interface Enemy {
  id: string;
  name: string;
  symbol: string; // ASCII/Pixel representation
  color: string;
  hp: number;
  maxHp: number;
  damage: number;
  sanityDamage: number;
  sightRange: number; // New: How far they can see
  description: string;
  lootTable: string[];
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  sanity: number;
  maxSanity: number;
  inventory: Item[];
  maxInventorySize: number;
  secureContainer: Item[]; // Max 1 for now
  credits: number;
  equippedWeapon: Item | null;
}

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'combat' | 'loot' | 'danger' | 'story' | 'command';
}

export enum GameState {
  HIDEOUT = 'HIDEOUT',
  SHOP = 'SHOP',
  RAID = 'RAID',
  GAME_OVER = 'GAME_OVER'
}

// --- MAP TYPES ---

export enum TileType {
  FLOOR = 'FLOOR',
  WALL = 'WALL',
  DOOR = 'DOOR',
  EXIT = 'EXIT',
  START = 'START'
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface MapTile {
  x: number;
  y: number;
  type: TileType;
  discovered: boolean;
  visible: boolean;
  loot?: Item;
  doorTarget?: { // If type is DOOR
    roomId: string;
    targetX: number;
    targetY: number;
  };
}

export interface Room {
    id: string;
    width: number;
    height: number;
    tiles: MapTile[];
    difficultyTier: number; // 0 = safe, higher = harder
    entities: ActiveEntity[];
}

export interface ActiveEntity {
  id: string;
  enemyId: string; // Ref to ENEMIES_DB
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alerted: boolean;
}