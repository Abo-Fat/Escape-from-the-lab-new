import { Item, ItemType, Rarity, Enemy } from './types';

// --- ITEMS ---
export const ITEMS_DB: Record<string, Item> = {
  // Junk / Materials
  'burnt_resistor': { id: 'burnt_resistor', name: 'Burnt Resistor', description: 'Useless.', rarity: Rarity.JUNK, type: ItemType.MATERIAL, value: 5 },
  'wire': { id: 'wire', name: 'Copper Wire', description: 'Basic scrap.', rarity: Rarity.COMMON, type: ItemType.MATERIAL, value: 15 },
  'test_tubes': { id: 'test_tubes', name: 'Dirty Test Tubes', description: 'Needs cleaning.', rarity: Rarity.JUNK, type: ItemType.MATERIAL, value: 8 },
  
  // Consumables
  'coffee': { id: 'coffee', name: 'Instant Coffee', description: '+25 Sanity.', rarity: Rarity.COMMON, type: ItemType.CONSUMABLE, value: 50, effect: { sanity: 25 } },
  'energy_bar': { id: 'energy_bar', name: 'Energy Bar', description: '+15 HP.', rarity: Rarity.COMMON, type: ItemType.CONSUMABLE, value: 40, effect: { hp: 15 } },
  'sandwich': { id: 'sandwich', name: 'Stale Sandwich', description: '+30 HP. Tastes like sadness.', rarity: Rarity.COMMON, type: ItemType.CONSUMABLE, value: 80, effect: { hp: 30 } },
  'pizza': { id: 'pizza', name: 'Lab Pizza', description: '+60 HP. A rare treat.', rarity: Rarity.RARE, type: ItemType.CONSUMABLE, value: 150, effect: { hp: 60 } },

  // Weapons
  'pipette': { id: 'pipette', name: 'Pipette', description: 'Stab: +8 Dmg.', rarity: Rarity.COMMON, type: ItemType.WEAPON, value: 100, effect: { hp: 8 } },
  'scalpel': { id: 'scalpel', name: 'Rusty Scalpel', description: 'Slice: +12 Dmg.', rarity: Rarity.COMMON, type: ItemType.WEAPON, value: 250, effect: { hp: 12 } },
  'laser_pointer': { id: 'laser_pointer', name: 'Laser Pointer', description: 'Burn: +20 Dmg.', rarity: Rarity.RARE, type: ItemType.WEAPON, value: 500, effect: { hp: 20 } },
  'soldering_iron': { id: 'soldering_iron', name: 'Soldering Iron', description: 'Sear: +35 Dmg.', rarity: Rarity.LEGENDARY, type: ItemType.WEAPON, value: 1200, effect: { hp: 35 } },
  
  // Treasures
  'hard_drive': { id: 'hard_drive', name: 'Encrypted HDD', description: 'High value data.', rarity: Rarity.RARE, type: ItemType.DATA, value: 800 },
  'a100': { id: 'a100', name: 'NVIDIA A100', description: 'Jackpot.', rarity: Rarity.LEGENDARY, type: ItemType.MATERIAL, value: 5000 },
  'nature_paper': { id: 'nature_paper', name: 'Nature Paper', description: 'Win condition.', rarity: Rarity.LEGENDARY, type: ItemType.DATA, value: 10000 },
};

// Items available for purchase in the shop
export const SHOP_INVENTORY: string[] = [
  'energy_bar',
  'sandwich',
  'pizza',
  'coffee',
  'scalpel',
  'laser_pointer',
  'soldering_iron'
];

// --- ENEMIES ---
export const ENEMIES_DB: Record<string, Enemy> = {
  'undergrad': { 
    id: 'undergrad', 
    name: 'Undergrad', 
    symbol: 'U',
    color: 'text-yellow-400',
    hp: 20, 
    maxHp: 20, 
    damage: 3, 
    sanityDamage: 5, 
    sightRange: 5,
    description: 'Lost and confused.',
    lootTable: ['coffee', 'energy_bar', 'burnt_resistor', 'test_tubes']
  },
  'postdoc': { 
    id: 'postdoc', 
    name: 'Bitter Postdoc', 
    symbol: 'P',
    color: 'text-red-500',
    hp: 50, 
    maxHp: 50, 
    damage: 9, 
    sanityDamage: 12, 
    sightRange: 7,
    description: 'Aggressive researcher.',
    lootTable: ['pipette', 'wire', 'coffee', 'hard_drive']
  },
  'professor': { 
    id: 'professor', 
    name: 'The Professor', 
    symbol: 'BOSS',
    color: 'text-purple-500 font-bold',
    hp: 150, 
    maxHp: 150, 
    damage: 18, 
    sanityDamage: 35, 
    sightRange: 10,
    description: 'Tenure denied.',
    lootTable: ['a100', 'nature_paper']
  }
};