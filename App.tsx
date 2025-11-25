import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { GameState, Item, ItemType, PlayerStats, GameLog, TileType, MapTile, Coordinate, ActiveEntity, Room, Enemy } from './types';
import { ITEMS_DB, ENEMIES_DB, SHOP_INVENTORY } from './constants';

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_PLAYER: PlayerStats = {
  hp: 100, maxHp: 100, sanity: 100, maxSanity: 100,
  inventory: [], maxInventorySize: 10, secureContainer: [], credits: 100, equippedWeapon: null,
};

export default function App() {
  // --- STATE ---
  const [gameState, setGameState] = useState<GameState>(GameState.HIDEOUT);
  const [player, setPlayer] = useState<PlayerStats>(INITIAL_PLAYER);
  const [logs, setLogs] = useState<GameLog[]>([]);
  
  // Dungeon State
  const [dungeonRooms, setDungeonRooms] = useState<Record<string, Room>>({});
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  
  // Local Room State (Derived from dungeonRooms for easier access, but needs sync)
  const [playerPos, setPlayerPos] = useState<Coordinate>({ x: 1, y: 1 });
  const [commandInput, setCommandInput] = useState('');
  
  // Combat State
  const [autoFighting, setAutoFighting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  // Focus input on game start
  useEffect(() => {
    if (gameState === GameState.RAID && inputRef.current) inputRef.current.focus();
  }, [gameState]);

  // Initial Story Log
  useEffect(() => {
      // Only run once on mount
      if (logs.length === 0 && gameState === GameState.HIDEOUT) {
          setTimeout(() => addLog('SYSTEM BOOT SEQUENCE COMPLETE...', 'info'), 500);
          setTimeout(() => addLog('DATE: OCT 31. DEADLINE: T-MINUS 72 HOURS.', 'danger'), 1000);
          setTimeout(() => addLog('STATUS: LOCAL STORAGE CORRUPTED.', 'danger'), 1500);
          setTimeout(() => addLog('MESSAGE: "You wake up at your desk. The coffee is cold. You need that backup data from the Server Room. Prepare yourself."', 'story'), 2500);
      }
  }, []);

  // Check Death
  useEffect(() => {
    if (gameState === GameState.RAID) {
      if (player.hp <= 0) {
         handleGameOver('PHYSICAL TRAUMA (HP DEPLETED)');
      } else if (player.sanity <= 0) {
         handleGameOver('MENTAL BREAKDOWN (SANITY DEPLETED)');
      }
    }
  }, [player.hp, player.sanity, gameState]);

  // Auto Fight Loop
  useEffect(() => {
      if (autoFighting && gameState === GameState.RAID) {
          const timer = setTimeout(() => {
              performAutoCombatStep();
          }, 500); 
          return () => clearTimeout(timer);
      }
  }, [autoFighting, dungeonRooms, currentRoomId, player.hp, gameState]);

  // --- ENGINE ---

  const addLog = (message: string, type: GameLog['type'] = 'info') => {
    setLogs(prev => [...prev, { id: generateId(), timestamp: new Date().toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'}), message, type }]);
  };

  const handleGameOver = (reason: string) => {
      setAutoFighting(false);
      setGameState(GameState.GAME_OVER);
      addLog(`CRITICAL FAILURE: ${reason}`, 'danger');
      addLog('ACADEMIC CAREER TERMINATED.', 'danger');
  };

  const respawn = () => {
      setPlayer(prev => ({
          ...prev,
          hp: 50, // Penalized stats
          sanity: 50,
          inventory: [], // Lose main inventory
          equippedWeapon: null
      }));
      setGameState(GameState.HIDEOUT);
      setLogs([]);
      addLog('REVIVED IN MEDICAL WING. EQUIPMENT LOST.', 'info');
      addLog('THE NIGHTMARE CONTINUES.', 'story');
      if (player.secureContainer.length > 0) {
          addLog(`SECURE CONTAINER CONTENTS SAVED: ${player.secureContainer[0].name}`, 'loot');
      }
  }

  // --- MAP GENERATION (ROOMS) ---

  const generateRoom = (id: string, difficulty: number, isStart: boolean, isExit: boolean): Room => {
      const width = Math.floor(Math.random() * 6) + 8; // 8-13 width
      const height = Math.floor(Math.random() * 6) + 8; // 8-13 height
      
      const tiles: MapTile[] = [];
      const entities: ActiveEntity[] = [];

      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              let type = TileType.FLOOR;
              // Walls
              if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                  type = TileType.WALL;
              }

              // Random interior walls (obstacles)
              if (type === TileType.FLOOR && Math.random() < 0.1 && !isStart) {
                  type = TileType.WALL;
              }

              let loot: Item | undefined;
              if (type === TileType.FLOOR && Math.random() < 0.05) {
                   const items = Object.values(ITEMS_DB);
                   const commonItems = items.filter(i => i.value < 1000);
                   loot = commonItems[Math.floor(Math.random() * commonItems.length)];
              }

              tiles.push({ x, y, type, discovered: false, visible: false, loot });
          }
      }

      // Enemies (Difficulty Scaling)
      // Safe zone radius: Start room (diff=0) has NO enemies.
      if (!isStart) {
          const enemyChance = 0.02 + (difficulty * 0.015); // Increases with distance
          const possibleEnemies = difficulty > 3 ? ['postdoc', 'professor'] : (difficulty > 1 ? ['undergrad', 'postdoc'] : ['undergrad']);

          tiles.forEach(t => {
             if (t.type === TileType.FLOOR && Math.random() < enemyChance) {
                 const enemyId = possibleEnemies[Math.floor(Math.random() * possibleEnemies.length)];
                 const template = ENEMIES_DB[enemyId];
                 // Boss only spawns at Exit room
                 if (enemyId === 'professor' && !isExit) return;

                 entities.push({
                     id: generateId(),
                     enemyId,
                     x: t.x,
                     y: t.y,
                     hp: template.hp,
                     maxHp: template.maxHp,
                     alerted: false
                 });
             }
          });
      }

      if (isStart) {
           const centerIndex = tiles.findIndex(t => t.x === Math.floor(width/2) && t.y === Math.floor(height/2));
           if (centerIndex !== -1) tiles[centerIndex].type = TileType.START;
      }
      
      if (isExit) {
           const centerIndex = tiles.findIndex(t => t.x === Math.floor(width/2) && t.y === Math.floor(height/2));
           if (centerIndex !== -1) tiles[centerIndex].type = TileType.EXIT;
      }

      return { id, width, height, tiles, difficultyTier: difficulty, entities };
  };

  const connectRooms = (r1: Room, r2: Room, direction: 'N'|'S'|'E'|'W') => {
      // Find midpoints for walls
      let t1: MapTile | undefined, t2: MapTile | undefined;
      let t1Target: Coordinate = {x:0,y:0}, t2Target: Coordinate = {x:0,y:0};

      if (direction === 'E') {
          // R1 Right Wall -> R2 Left Wall
          const y1 = Math.floor(r1.height / 2);
          const y2 = Math.floor(r2.height / 2);
          t1 = r1.tiles.find(t => t.x === r1.width - 1 && t.y === y1);
          t2 = r2.tiles.find(t => t.x === 0 && t.y === y2);
          t1Target = { x: 1, y: y2 };
          t2Target = { x: r1.width - 2, y: y1 };
      } else if (direction === 'S') {
          // R1 Bottom Wall -> R2 Top Wall
          const x1 = Math.floor(r1.width / 2);
          const x2 = Math.floor(r2.width / 2);
          t1 = r1.tiles.find(t => t.y === r1.height - 1 && t.x === x1);
          t2 = r2.tiles.find(t => t.y === 0 && t.x === x2);
          t1Target = { x: x2, y: 1 };
          t2Target = { x: x1, y: r1.height - 2 };
      }

      if (t1 && t2) {
          t1.type = TileType.DOOR;
          t1.doorTarget = { roomId: r2.id, targetX: t1Target.x, targetY: t1Target.y };
          
          t2.type = TileType.DOOR;
          t2.doorTarget = { roomId: r1.id, targetX: t2Target.x, targetY: t2Target.y };
      }
  };

  const initRaid = () => {
    const GRID_SIZE = 3;
    const rooms: Record<string, Room> = {};
    const roomGrid: string[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));

    // Create 3x3 Grid of Rooms
    for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
            const id = `room_${gx}_${gy}`;
            const isStart = gx === 0 && gy === 0;
            const isExit = gx === GRID_SIZE - 1 && gy === GRID_SIZE - 1;
            const difficulty = gx + gy; // Manhattan distance
            
            rooms[id] = generateRoom(id, difficulty, isStart, isExit);
            roomGrid[gy][gx] = id;
        }
    }

    // Connect Rooms (Horizontal & Vertical)
    for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
            const currentId = roomGrid[gy][gx];
            // Connect East
            if (gx < GRID_SIZE - 1) {
                const eastId = roomGrid[gy][gx + 1];
                connectRooms(rooms[currentId], rooms[eastId], 'E');
            }
            // Connect South
            if (gy < GRID_SIZE - 1) {
                const southId = roomGrid[gy + 1][gx];
                connectRooms(rooms[currentId], rooms[southId], 'S');
            }
        }
    }

    setDungeonRooms(rooms);
    const startRoomId = 'room_0_0';
    setCurrentRoomId(startRoomId);
    
    // Find player start pos
    const startRoom = rooms[startRoomId];
    const startTile = startRoom.tiles.find(t => t.type === TileType.START) || {x: 1, y: 1};
    setPlayerPos({ x: startTile.x, y: startTile.y });
    
    // Initial Vis check
    const updatedRoom = updateVisibility(startRoom, {x: startTile.x, y: startTile.y});
    setDungeonRooms(prev => ({ ...prev, [startRoomId]: updatedRoom }));

    setGameState(GameState.RAID);
    setAutoFighting(false);
    setLogs([]);
    
    // NARRATIVE INTRO FOR RAID
    setTimeout(() => addLog('ENTERING LAB COMPLEX SECTOR 7...', 'info'), 200);
    setTimeout(() => addLog('ENVIRONMENTAL WARNING: HIGH STRESS LEVELS DETECTED.', 'danger'), 800);
    setTimeout(() => addLog('MISSION BRIEF: The Faculty have succumbed to "The Burnout". They are hostile. Locate the SERVER ROOM (E) and extract the data.', 'story'), 1600);
    setTimeout(() => addLog('REMEMBER: Publish... or Perish.', 'story'), 2400);
  };

  const updateVisibility = (room: Room, pos: Coordinate): Room => {
    // Reveal room tiles based on distance AND line of sight
    const newTiles = room.tiles.map(tile => {
      const dist = Math.abs(tile.x - pos.x) + Math.abs(tile.y - pos.y);
      const visible = dist <= 6 && hasLineOfSight(pos, {x: tile.x, y: tile.y}, room);
      
      let discovered = tile.discovered;
      if (visible) discovered = true;

      return { ...tile, visible, discovered };
    });
    return { ...room, tiles: newTiles };
  };

  const getPlayerDamage = () => {
    const baseDmg = 5;
    const weaponDmg = player.equippedWeapon?.effect?.hp || 0;
    return baseDmg + weaponDmg;
  }

  // --- SHOP LOGIC ---
  const handleBuy = (itemId: string) => {
    const item = ITEMS_DB[itemId];
    if (!item) return;
    
    if (player.inventory.length >= player.maxInventorySize) {
        alert("Inventory Full!");
        return;
    }

    if (player.credits >= item.value) {
        setPlayer(prev => ({
            ...prev,
            credits: prev.credits - item.value,
            inventory: [...prev.inventory, item]
        }));
    }
  };

  const handleSell = (index: number, fromSecure: boolean = false) => {
      const sourceList = fromSecure ? player.secureContainer : player.inventory;
      const item = sourceList[index];
      const sellValue = Math.floor(item.value / 2);
      
      const newList = [...sourceList];
      newList.splice(index, 1);

      let newEquipped = player.equippedWeapon;
      if (!fromSecure && player.equippedWeapon && player.equippedWeapon.id === item.id) {
          newEquipped = null;
      }

      setPlayer(prev => ({
          ...prev,
          credits: prev.credits + sellValue,
          inventory: fromSecure ? prev.inventory : newList,
          secureContainer: fromSecure ? newList : prev.secureContainer,
          equippedWeapon: newEquipped
      }));
  };

  // --- LINE OF SIGHT (Bresenham) ---
  const hasLineOfSight = (p0: Coordinate, p1: Coordinate, room: Room): boolean => {
      let x0 = p0.x, y0 = p0.y;
      const x1 = p1.x, y1 = p1.y;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = (x0 < x1) ? 1 : -1;
      const sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;

      while (true) {
          // If we reached target
          if (x0 === x1 && y0 === y1) return true;

          // Check if wall (skip checking start point)
          if (x0 !== p0.x || y0 !== p0.y) {
               const tile = room.tiles.find(t => t.x === x0 && t.y === y0);
               if (tile?.type === TileType.WALL || tile?.type === TileType.DOOR) return false;
          }

          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x0 += sx; }
          if (e2 < dx) { err += dx; y0 += sy; }
      }
  };

  // --- COMMAND PROCESSOR ---

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoFighting) setAutoFighting(false);
    processAction(commandInput);
    setCommandInput('');
  };

  const processAction = (cmd: string) => {
    const lowerCmd = cmd.toLowerCase().trim();
    const parts = lowerCmd.split(' ');
    const mainCmd = parts[0];
    const arg = parts.slice(1).join(' ');

    addLog(`> ${cmd}`, 'command');

    if (['north', 'n', 'up', 'w'].includes(mainCmd)) movePlayer(0, -1);
    else if (['south', 's', 'down'].includes(mainCmd)) movePlayer(0, 1);
    else if (['east', 'e', 'right', 'd'].includes(mainCmd)) movePlayer(1, 0);
    else if (['west', 'w', 'left', 'a'].includes(mainCmd)) movePlayer(-1, 0);
    else if (['search', 'f', 'scavenge'].includes(mainCmd)) performSearch();
    else if (['attack', 'space', 'k'].includes(mainCmd)) performAttack();
    else if (['fight', 'kill', 'auto'].includes(mainCmd)) { setAutoFighting(true); addLog('ENGAGING AUTO-COMBAT...', 'combat'); }
    else if (['eat', 'consume', 'drink'].includes(mainCmd)) performConsume(arg);
    else if (['drop', 'discard'].includes(mainCmd)) performDrop(arg);
    else if (['secure', 'save'].includes(mainCmd)) performSecure(arg);
    else if (['unsecure', 'retrieve'].includes(mainCmd)) performUnsecure(arg);
    else if (['help', 'h', '?'].includes(mainCmd)) addLog('CMDS: MOVE [WASD], FIGHT, SEARCH, EAT, DROP, SECURE, UNSECURE, EQUIP, SCAN, STATUS', 'info');
    else if (['extract', 'exit'].includes(mainCmd)) attemptExtract();
    else if (['status', 'me', 'stats'].includes(mainCmd)) displayStatus();
    else if (['scan', 'look'].includes(mainCmd)) performScan();
    else if (['equip', 'use'].includes(mainCmd)) performEquip(arg);
    else addLog('UNKNOWN COMMAND. TRY "HELP".', 'danger');
  };

  const displayStatus = () => {
      const weaponName = player.equippedWeapon ? player.equippedWeapon.name : 'Fists';
      addLog(`HP: ${player.hp}/${player.maxHp} | SANITY: ${player.sanity}/${player.maxSanity}`, 'info');
      addLog(`ATK: ${getPlayerDamage()} (WPN: ${weaponName})`, 'combat');
  };

  const performScan = () => {
      const room = dungeonRooms[currentRoomId];
      let found = false;
      room.entities.forEach(e => {
          if (!hasLineOfSight(playerPos, {x:e.x, y:e.y}, room)) return; // Only scan what you can see
          const dist = Math.abs(e.x - playerPos.x) + Math.abs(e.y - playerPos.y);
          if (dist <= 6) {
              const tmpl = ENEMIES_DB[e.enemyId];
              addLog(`TARGET: ${tmpl.name} [HP: ${e.hp}/${e.maxHp}] DIST: ${dist}`, 'danger');
              found = true;
          }
      });
      if (!found) addLog('NO VISIBLE HOSTILES.', 'info');
  };

  const performEquip = (itemName: string) => {
      if (!itemName) return;
      const item = player.inventory.find(i => i.name.toLowerCase().includes(itemName));
      if (!item) { addLog(`ITEM "${itemName}" NOT FOUND.`, 'danger'); return; }
      if (item.type !== ItemType.WEAPON) { addLog(`${item.name} IS NOT A WEAPON.`, 'danger'); return; }
      setPlayer(prev => ({ ...prev, equippedWeapon: item }));
      addLog(`EQUIPPED: ${item.name}`, 'loot');
  };

  const performDrop = (itemName: string) => {
      if (!itemName) return;
      const index = player.inventory.findIndex(i => i.name.toLowerCase().includes(itemName));
      if (index === -1) { addLog(`ITEM "${itemName}" NOT FOUND.`, 'danger'); return; }
      const item = player.inventory[index];
      
      const newInv = [...player.inventory];
      newInv.splice(index, 1);
      
      let newEquipped = player.equippedWeapon;
      if (player.equippedWeapon && player.equippedWeapon.id === item.id) newEquipped = null;

      setPlayer(prev => ({ ...prev, inventory: newInv, equippedWeapon: newEquipped }));
      
      // Update Room
      setDungeonRooms(prev => {
          const room = prev[currentRoomId];
          const newTiles = room.tiles.map(t => t.x === playerPos.x && t.y === playerPos.y ? { ...t, loot: item } : t);
          return { ...prev, [currentRoomId]: { ...room, tiles: newTiles } };
      });
      addLog(`DROPPED ${item.name}.`, 'info');
  };

  const performSecure = (itemName: string) => {
      if (!itemName) return;
      if (player.secureContainer.length >= 1) { addLog('SECURE CONTAINER IS FULL.', 'danger'); return; }

      const index = player.inventory.findIndex(i => i.name.toLowerCase().includes(itemName));
      if (index === -1) { addLog(`ITEM "${itemName}" NOT FOUND.`, 'danger'); return; }
      const item = player.inventory[index];
      
      const newInv = [...player.inventory];
      newInv.splice(index, 1);
      
      let newEquipped = player.equippedWeapon;
      if (player.equippedWeapon && player.equippedWeapon.id === item.id) newEquipped = null;

      setPlayer(prev => ({ ...prev, inventory: newInv, equippedWeapon: newEquipped, secureContainer: [...prev.secureContainer, item] }));
      addLog(`SECURED ${item.name}.`, 'loot');
  };

  const performUnsecure = (itemName: string) => {
      if (player.inventory.length >= player.maxInventorySize) { addLog('BACKPACK FULL.', 'danger'); return; }
      if (player.secureContainer.length === 0) return;
      
      let index = 0;
      if (itemName) {
         index = player.secureContainer.findIndex(i => i.name.toLowerCase().includes(itemName));
         if (index === -1) { addLog('ITEM NOT FOUND IN SECURE CONTAINER.', 'danger'); return; }
      }

      const item = player.secureContainer[index];
      const newSecure = [...player.secureContainer];
      newSecure.splice(index, 1);

      setPlayer(prev => ({ ...prev, secureContainer: newSecure, inventory: [...prev.inventory, item] }));
      addLog(`RETRIEVED ${item.name}.`, 'info');
  };

  const performConsume = (itemName: string) => {
     if (!itemName) {
          const food = player.inventory.find(i => i.type === ItemType.CONSUMABLE);
          if (food) itemName = food.name.toLowerCase();
          else { addLog('USAGE: EAT [ITEM NAME]', 'info'); return; }
      }
      
      const itemIndex = player.inventory.findIndex(i => i.name.toLowerCase().includes(itemName));
      if (itemIndex === -1) { addLog(`YOU DON'T HAVE "${itemName}".`, 'danger'); return; }

      const item = player.inventory[itemIndex];
      if (item.type !== ItemType.CONSUMABLE) { addLog(`YOU CAN'T EAT ${item.name}!`, 'danger'); return; }

      let msg = `CONSUMED ${item.name}. `;
      const updates: Partial<PlayerStats> = {};
      if (item.effect?.hp) { updates.hp = Math.min(player.maxHp, player.hp + item.effect.hp); msg += `+${item.effect.hp} HP. `; }
      if (item.effect?.sanity) { updates.sanity = Math.min(player.maxSanity, player.sanity + item.effect.sanity); msg += `+${item.effect.sanity} SANITY. `; }

      const newInv = [...player.inventory];
      newInv.splice(itemIndex, 1);
      
      setPlayer(prev => ({ ...prev, ...updates, inventory: newInv }));
      addLog(msg, 'loot');
      enemyTurn(playerPos);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.RAID) return;
      if (autoFighting) return;

      if (document.activeElement !== inputRef.current || commandInput === '') {
        if (e.key === 'w' || e.key === 'ArrowUp') { e.preventDefault(); processAction('north'); }
        if (e.key === 's' || e.key === 'ArrowDown') { e.preventDefault(); processAction('south'); }
        if (e.key === 'a' || e.key === 'ArrowLeft') { e.preventDefault(); processAction('west'); }
        if (e.key === 'd' || e.key === 'ArrowRight') { e.preventDefault(); processAction('east'); }
        if (e.key === ' ' || e.key === 'Enter') { 
            if (document.activeElement !== inputRef.current) { e.preventDefault(); processAction('attack'); }
        }
        if (e.key === 'f') { e.preventDefault(); processAction('search'); }
      }
  };

  // --- GAMEPLAY ACTIONS ---

  const movePlayer = (dx: number, dy: number) => {
    const currentRoom = dungeonRooms[currentRoomId];
    const newX = playerPos.x + dx;
    const newY = playerPos.y + dy;

    // Check bounds
    if (newX < 0 || newX >= currentRoom.width || newY < 0 || newY >= currentRoom.height) {
        addLog('BLOCKED.', 'danger');
        return;
    }

    const tile = currentRoom.tiles.find(t => t.x === newX && t.y === newY);
    if (!tile || tile.type === TileType.WALL) {
        addLog('WALL.', 'danger');
        return;
    }

    const enemy = currentRoom.entities.find(e => e.x === newX && e.y === newY);
    if (enemy) {
        addLog(`BLOCKED BY ${ENEMIES_DB[enemy.enemyId].name}.`, 'danger');
        return;
    }

    // Handle Door Transition
    if (tile.type === TileType.DOOR && tile.doorTarget) {
        const { roomId, targetX, targetY } = tile.doorTarget;
        addLog('MOVING TO NEXT ROOM...', 'info');
        
        // Update old room visibility one last time? Not really needed
        setCurrentRoomId(roomId);
        setPlayerPos({ x: targetX, y: targetY });
        
        // Update new room visibility immediately
        const nextRoom = dungeonRooms[roomId];
        const updatedNextRoom = updateVisibility(nextRoom, { x: targetX, y: targetY });
        setDungeonRooms(prev => ({ ...prev, [roomId]: updatedNextRoom }));
        return;
    }

    // Normal Move
    setPlayerPos({ x: newX, y: newY });
    const updatedRoom = updateVisibility(currentRoom, { x: newX, y: newY });
    setDungeonRooms(prev => ({ ...prev, [currentRoomId]: updatedRoom }));
    
    if (tile.type === TileType.EXIT) addLog('EXIT REACHED. TYPE "EXTRACT".', 'loot');
    if (tile.loot) addLog('ITEM SPOTTED.', 'loot');
    
    enemyTurn({ x: newX, y: newY });
  };

  const performAutoCombatStep = () => {
      const room = dungeonRooms[currentRoomId];
      const targets = room.entities.filter(e => Math.abs(e.x - playerPos.x) + Math.abs(e.y - playerPos.y) === 1);
      
      if (targets.length === 0) {
          addLog('NO TARGETS IN RANGE. STOPPING AUTO-COMBAT.', 'info');
          setAutoFighting(false);
          return;
      }
      if (player.hp < 20) {
          addLog('HP CRITICAL! STOPPING AUTO-COMBAT.', 'danger');
          setAutoFighting(false);
          return;
      }
      performAttack();
  };

  const performAttack = () => {
      const room = dungeonRooms[currentRoomId];
      const targets = room.entities.filter(e => Math.abs(e.x - playerPos.x) + Math.abs(e.y - playerPos.y) === 1);
      
      if (targets.length === 0) {
          if (!autoFighting) addLog('NOTHING TO ATTACK.', 'info');
          return;
      }

      const target = targets[0];
      const template = ENEMIES_DB[target.enemyId];
      const dmg = getPlayerDamage();
      const newHp = target.hp - dmg;

      addLog(`HIT ${template.name} FOR ${dmg} DMG.`, 'combat');

      let updatedEntities = room.entities;

      if (newHp <= 0) {
          addLog(`${template.name} ELIMINATED.`, 'loot');
          updatedEntities = room.entities.filter(e => e.id !== target.id);
          
          if (Math.random() < 0.6 && template.lootTable.length > 0) {
             const lootId = template.lootTable[Math.floor(Math.random() * template.lootTable.length)];
             const item = ITEMS_DB[lootId];
             
             // Update loot on tile
             const newTiles = room.tiles.map(t => t.x === target.x && t.y === target.y ? { ...t, loot: item } : t);
             setDungeonRooms(prev => ({ ...prev, [currentRoomId]: { ...room, tiles: newTiles, entities: updatedEntities } }));
             addLog(`${template.name} DROPPED ${item.name}.`, 'loot');
          } else {
             setDungeonRooms(prev => ({ ...prev, [currentRoomId]: { ...room, entities: updatedEntities } }));
          }

          if (autoFighting) {
              setAutoFighting(false);
              addLog('TARGET DESTROYED.', 'info');
          }
      } else {
          updatedEntities = room.entities.map(e => e.id === target.id ? { ...e, hp: newHp, alerted: true } : e);
          setDungeonRooms(prev => ({ ...prev, [currentRoomId]: { ...room, entities: updatedEntities } }));
          enemyTurn(playerPos);
      }
  };

  const performSearch = () => {
      const room = dungeonRooms[currentRoomId];
      const tile = room.tiles.find(t => t.x === playerPos.x && t.y === playerPos.y);
      if (tile && tile.loot) {
          if (player.inventory.length >= player.maxInventorySize) {
              addLog('INVENTORY FULL.', 'danger');
              return;
          }
          addLog(`PICKED UP: ${tile.loot.name}`, 'loot');
          setPlayer(prev => ({ ...prev, inventory: [...prev.inventory, tile.loot!] }));
          
          // Update room to remove loot
          const newTiles = room.tiles.map(t => t.x === playerPos.x && t.y === playerPos.y ? { ...t, loot: undefined } : t);
          setDungeonRooms(prev => ({ ...prev, [currentRoomId]: { ...room, tiles: newTiles } }));
      } else {
          addLog('NOTHING FOUND.', 'info');
      }
  };

  const attemptExtract = () => {
      const room = dungeonRooms[currentRoomId];
      const tile = room.tiles.find(t => t.x === playerPos.x && t.y === playerPos.y);
      if (tile?.type === TileType.EXIT) {
          addLog('EXTRACTION SUCCESSFUL.', 'loot');
          setTimeout(() => setGameState(GameState.HIDEOUT), 1000);
      } else {
          addLog('MUST BE AT EXIT TO EXTRACT.', 'danger');
      }
  };

  // --- AI ---

  const enemyTurn = (targetPos: Coordinate) => {
      setDungeonRooms(prev => {
          const room = prev[currentRoomId];
          if (!room) return prev;

          const updatedEntities = room.entities.map(e => {
              const tmpl = ENEMIES_DB[e.enemyId];
              
              // Check Distance
              const dist = Math.abs(e.x - targetPos.x) + Math.abs(e.y - targetPos.y);
              
              // Vision Check (Distance + Line of Sight)
              let canSee = dist <= tmpl.sightRange && hasLineOfSight({x: e.x, y: e.y}, targetPos, room);
              
              let alerted = e.alerted;
              if (canSee) alerted = true;

              if (!alerted) return e;

              // Attack if close
              if (dist === 1) {
                  addLog(`${tmpl.name} ATTACKS YOU! -${tmpl.damage} HP.`, 'danger');
                  setPlayer(p => ({ ...p, hp: p.hp - tmpl.damage, sanity: p.sanity - tmpl.sanityDamage }));
                  return e;
              }

              // Move towards player
              // 30% Chance to stand still (simulated speed/pause)
              if (Math.random() > 0.7) return e;

              let dx = 0, dy = 0;
              if (e.x < targetPos.x) dx = 1;
              else if (e.x > targetPos.x) dx = -1;
              else if (e.y < targetPos.y) dy = 1;
              else if (e.y > targetPos.y) dy = -1;

              // Collision Check
              const destTile = room.tiles.find(t => t.x === e.x + dx && t.y === e.y + dy);
              if (destTile && (destTile.type === TileType.WALL || destTile.type === TileType.DOOR)) return e;

              const isBlockedByEnemy = room.entities.some(other => other.id !== e.id && other.x === e.x + dx && other.y === e.y + dy);
              if (isBlockedByEnemy) return e;

              return { ...e, x: e.x + dx, y: e.y + dy };
          });

          return { ...prev, [currentRoomId]: { ...room, entities: updatedEntities } };
      });
  };

  // --- RENDER ---

  const renderMap = () => {
    const room = dungeonRooms[currentRoomId];
    if (!room) return null;

    return (
      <div 
        className="grid bg-gray-900 border-2 border-gray-700 p-1 mx-auto shadow-2xl relative"
        style={{ 
            gridTemplateColumns: `repeat(${room.width}, 24px)`,
            gridTemplateRows: `repeat(${room.height}, 24px)`,
            width: 'fit-content'
        }}
      >
          {room.tiles.map((tile, i) => {
              const entity = room.entities.find(e => e.x === tile.x && e.y === tile.y);
              const isPlayer = playerPos.x === tile.x && playerPos.y === tile.y;
              
              let bgClass = 'bg-gray-950';
              let content = '';
              let fgClass = '';
              let borderClass = 'border-gray-800/50';

              if (!tile.discovered) {
                  return <div key={i} className="w-6 h-6 bg-black border border-gray-900/50"></div>;
              }

              if (tile.type === TileType.WALL) {
                  bgClass = 'bg-gray-700';
                  content = '#';
                  fgClass = 'text-gray-600';
              } else if (tile.type === TileType.EXIT) {
                  bgClass = 'bg-blue-900/30';
                  content = 'E';
                  fgClass = 'text-blue-400 font-bold';
              } else if (tile.type === TileType.DOOR) {
                  bgClass = 'bg-amber-900/40';
                  content = '+';
                  fgClass = 'text-amber-500 font-bold';
                  borderClass = 'border-amber-700/50';
              } else {
                  content = '.';
                  fgClass = 'text-gray-800';
                  if (tile.loot) {
                      content = '$';
                      fgClass = 'text-yellow-400 animate-pulse font-bold';
                  }
              }

              if (entity && tile.visible) {
                  const tmpl = ENEMIES_DB[entity.enemyId];
                  content = tmpl.symbol;
                  fgClass = `${tmpl.color} font-black text-base`;
              }

              if (isPlayer) {
                  bgClass = 'bg-green-900/40 ring-1 ring-green-500 z-10';
                  content = '@';
                  fgClass = 'text-green-400 font-bold text-base';
              }

              if (!tile.visible && tile.discovered) {
                  fgClass += ' opacity-30 grayscale';
                  bgClass += ' opacity-50';
              }

              return (
                  <div key={i} className={`w-6 h-6 border ${borderClass} flex items-center justify-center select-none text-xs ${bgClass}`}>
                      <span className={fgClass}>{content}</span>
                  </div>
              );
          })}
      </div>
    );
  };

  const renderHUD = () => {
    return (
      <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg w-full md:w-72 flex flex-col gap-4 font-mono text-sm shadow-lg h-[500px]">
        {/* STATS */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400 uppercase tracking-wider">Status</div>
          <div>
            <div className="flex justify-between mb-1">
               <span className="text-red-400 font-bold">HP</span>
               <span>{Math.max(0, player.hp)}/{player.maxHp}</span>
            </div>
            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
               <div className="bg-red-600 h-full transition-all" style={{width: `${(Math.max(0,player.hp)/player.maxHp)*100}%`}}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
               <span className="text-blue-400 font-bold">SANITY</span>
               <span>{Math.max(0, player.sanity)}/{player.maxSanity}</span>
            </div>
            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
               <div className="bg-blue-600 h-full transition-all" style={{width: `${(Math.max(0,player.sanity)/player.maxSanity)*100}%`}}></div>
            </div>
          </div>
          <div className="text-xs text-center text-gray-500 mt-2">
              ROOM: {currentRoomId}
          </div>
        </div>

        {/* EQUIPMENT */}
        <div className="border-t border-gray-700 pt-2">
            <div className="text-xs text-gray-400 uppercase mb-2">Equipment</div>
            <div className="p-2 bg-black border border-gray-600 text-center rounded text-green-400 font-bold">
               {player.equippedWeapon ? `[ ${player.equippedWeapon.name} ]` : '[ FISTS ]'}
            </div>
            <div className="text-center text-xs text-gray-500 mt-1">DMG: {getPlayerDamage()}</div>
        </div>
        
        {/* SECURE CONTAINER */}
        <div className="border-t border-gray-700 pt-2">
            <div className="flex justify-between text-xs text-gray-400 uppercase mb-2">
                <span>Secure (Hard Drive)</span>
                <span>{player.secureContainer.length}/1</span>
            </div>
            <div className="p-2 bg-yellow-900/20 border border-yellow-700/50 rounded min-h-[30px]">
                {player.secureContainer.length > 0 ? (
                    <span className="text-yellow-400 text-xs">{player.secureContainer[0].name}</span>
                ) : <span className="text-gray-600 text-xs italic">Empty</span>}
            </div>
        </div>

        {/* BACKPACK */}
        <div className="border-t border-gray-700 pt-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex justify-between text-xs text-gray-400 uppercase mb-2">
                <span>Backpack</span>
                <span className={player.inventory.length >= player.maxInventorySize ? 'text-red-500' : ''}>
                    {player.inventory.length}/{player.maxInventorySize}
                </span>
            </div>
            <div className="overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-gray-600 flex-1">
               {player.inventory.length === 0 && <div className="text-gray-600 italic text-xs">Empty</div>}
               {player.inventory.map((item, idx) => (
                 <div key={idx} className="bg-gray-800/50 p-1.5 border border-gray-700 text-xs flex justify-between items-center group">
                    <span className={item.type === ItemType.WEAPON ? 'text-orange-300' : item.type === ItemType.CONSUMABLE ? 'text-blue-300' : 'text-gray-300'}>
                      {item.name}
                    </span>
                    <span className="text-yellow-600 text-[10px]">${item.value}</span>
                 </div>
               ))}
            </div>
        </div>
      </div>
    );
  };

  const renderGameOver = () => (
      <div className="flex-1 flex items-center justify-center flex-col space-y-6 animate-pulse">
          <h1 className="text-6xl text-red-600 font-black tracking-widest">GAME OVER</h1>
          <p className="text-red-400 font-mono">STATUS: ACADEMIC FAILURE</p>
          <button 
            onClick={respawn}
            className="bg-red-900 hover:bg-red-800 text-white px-8 py-4 rounded border border-red-500 font-mono text-xl"
          >
              [ RESPAWN ]
          </button>
          <p className="text-gray-500 text-xs">Note: Backpack items lost. Secure container preserved.</p>
      </div>
  );

  return (
    <div className="min-h-screen bg-black text-gray-200 font-mono p-4 flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-gray-800 pb-2 mb-4">
        <div className="text-green-600 font-bold text-xl">
           &gt; <span className="text-white">LAB_TERMINAL</span>
        </div>
        <div className="text-xs text-gray-500">
            {gameState} MODE
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-6 max-w-6xl mx-auto w-full">
         
         {gameState === GameState.GAME_OVER ? renderGameOver() : (
            <>
                {/* GAME VIEW AREA */}
                {gameState === GameState.HIDEOUT ? (
                    <div className="flex-1 flex items-center justify-center min-h-[400px]">
                       <div className="max-w-2xl mx-auto p-8 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl text-center space-y-6 w-full">
                          <h1 className="text-4xl font-mono font-bold text-green-500 tracking-tighter">LAB_ESCAPE_V1.3</h1>
                          <p className="text-gray-400 font-mono">STATUS: DORMANT // LOCATION: OFFICE</p>
                          
                          <div className="grid grid-cols-2 gap-4 text-left p-4 bg-black/50 rounded border border-gray-800 font-mono text-sm">
                             <div>HP: <span className="text-red-500">{player.hp}</span></div>
                             <div>SANITY: <span className="text-blue-500">{player.sanity}</span></div>
                             <div>CREDITS: <span className="text-yellow-500">${player.credits}</span></div>
                             <div>SECURE: {player.secureContainer.length > 0 ? player.secureContainer[0].name : 'Empty'}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <button onClick={initRaid} className="col-span-2 bg-green-700 hover:bg-green-600 text-black font-bold py-3 px-8 rounded font-mono border-2 border-green-500">[ START_RUN ]</button>
                             <button onClick={() => setGameState(GameState.SHOP)} className="bg-yellow-700 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded font-mono border border-yellow-500">[ OPEN_SHOP ]</button>
                             <button 
                               onClick={() => {
                                   setPlayer(prev => ({ ...prev, sanity: prev.maxSanity, credits: prev.credits - 20 }));
                                   addLog('RESTED AT DESK. +SANITY ONLY. -20 CREDITS', 'info');
                               }}
                               disabled={player.credits < 20}
                               className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-bold py-3 px-8 rounded font-mono border border-gray-500 flex flex-col items-center justify-center"
                             >
                                 <span>[ REST -$20 ]</span>
                             </button>
                          </div>
                      </div>
                    </div>
                ) : gameState === GameState.SHOP ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="max-w-4xl mx-auto w-full p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl space-y-6">
                          <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                              <h1 className="text-2xl font-mono font-bold text-yellow-500">SUPPLY_DEPOT</h1>
                              <div className="text-yellow-400 font-bold">CREDITS: ${player.credits}</div>
                              <button onClick={() => setGameState(GameState.HIDEOUT)} className="bg-red-900 hover:bg-red-800 px-4 py-2 rounded text-xs border border-red-700">[LEAVE]</button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[400px]">
                              {/* BUY */}
                              <div className="flex flex-col border-r border-gray-800 pr-4">
                                  <h2 className="text-green-500 font-bold mb-4">BUY</h2>
                                  <div className="space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700">
                                      {SHOP_INVENTORY.map(itemId => {
                                          const item = ITEMS_DB[itemId];
                                          const canAfford = player.credits >= item.value;
                                          return (
                                              <button key={itemId} onClick={() => handleBuy(itemId)} disabled={!canAfford} className={`w-full text-left p-2 border border-gray-700 rounded flex justify-between hover:bg-gray-800 disabled:opacity-50 ${canAfford ? 'border-green-900/50' : 'border-red-900/30'}`}>
                                                  <div><div className="text-sm font-bold">{item.name}</div><div className="text-xs text-gray-500">{item.description}</div></div>
                                                  <div className="text-yellow-500 font-mono">${item.value}</div>
                                              </button>
                                          )
                                      })}
                                  </div>
                              </div>
                              {/* SELL */}
                              <div className="flex flex-col">
                                  <h2 className="text-red-500 font-bold mb-4">SELL</h2>
                                  <div className="space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700">
                                      {/* Inventory Sell */}
                                      <h3 className="text-xs text-gray-500 uppercase">Backpack</h3>
                                      {player.inventory.length === 0 && <div className="text-gray-600 italic text-xs mb-2">Empty</div>}
                                      {player.inventory.map((item, idx) => (
                                          <button key={`inv-${idx}`} onClick={() => handleSell(idx, false)} className="w-full text-left p-2 border border-gray-700 rounded flex justify-between hover:bg-gray-800 mb-1">
                                              <div className="text-sm text-gray-300">{item.name}</div>
                                              <div className="text-yellow-500 font-mono">+${Math.floor(item.value / 2)}</div>
                                          </button>
                                      ))}

                                      {/* Secure Container Sell */}
                                      <h3 className="text-xs text-gray-500 uppercase mt-4">Secure Container</h3>
                                      {player.secureContainer.length === 0 && <div className="text-gray-600 italic text-xs">Empty</div>}
                                      {player.secureContainer.map((item, idx) => (
                                          <button key={`sec-${idx}`} onClick={() => handleSell(idx, true)} className="w-full text-left p-2 border border-yellow-900/50 bg-yellow-900/10 rounded flex justify-between hover:bg-gray-800 mb-1">
                                              <div className="text-sm text-yellow-500">{item.name}</div>
                                              <div className="text-yellow-500 font-mono">+${Math.floor(item.value / 2)}</div>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>
                    </div>
                ) : (
                    // RAID LAYOUT
                    <div className="flex flex-col md:flex-row gap-6 flex-1 justify-center items-start">
                        <div className="flex-1 flex justify-center">
                          {renderMap()}
                        </div>
                        {renderHUD()}
                    </div>
                )}

                {/* TERMINAL LOGS & INPUT */}
                <div className="w-full md:w-1/3 flex flex-col h-[500px] border border-gray-700 bg-black/80 rounded-lg overflow-hidden shadow-lg">
                    <div className="flex-1 p-4 overflow-y-auto space-y-1 font-mono text-sm scrollbar-thin scrollbar-thumb-gray-700" ref={scrollRef}>
                        {logs.length === 0 && <div className="text-gray-600 italic">System ready...</div>}
                        {logs.map(log => (
                            <div key={log.id} className="break-words">
                                <span className="text-gray-600 text-xs mr-2">[{log.timestamp}]</span>
                                <span className={`
                                    ${log.type === 'command' ? 'text-white font-bold' : 
                                      log.type === 'danger' ? 'text-red-500' : 
                                      log.type === 'loot' ? 'text-yellow-400' : 
                                      log.type === 'combat' ? 'text-orange-400' : 
                                      log.type === 'story' ? 'text-cyan-400 italic' : 'text-green-400'}
                                `}>
                                    {log.type === 'command' ? '> ' : ''}{log.message}
                                </span>
                            </div>
                        ))}
                    </div>

                    {gameState === GameState.RAID && (
                        <form onSubmit={handleCommand} className="border-t border-gray-700 p-2 bg-gray-900 flex gap-2">
                            <span className={`font-bold py-2 pl-2 ${autoFighting ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
                                {autoFighting ? 'AUTO>' : '>'}
                            </span>
                            <input 
                                ref={inputRef}
                                type="text" 
                                value={commandInput}
                                onChange={(e) => setCommandInput(e.target.value)}
                                placeholder={autoFighting ? "Processing combat..." : "move, fight, drop..."}
                                disabled={autoFighting}
                                className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder-gray-600 disabled:opacity-50"
                                autoFocus
                            />
                        </form>
                    )}
                </div>
            </>
         )}
      </main>
      
      <footer className="mt-8 text-center text-xs text-gray-600 border-t border-gray-800 pt-4">
          <div className="flex justify-center gap-6">
              <span><span className="text-green-400">@</span> PLAYER</span>
              <span><span className="text-amber-500">+</span> DOOR</span>
              <span><span className="text-red-500">P</span> ENEMY</span>
              <span><span className="text-yellow-400">$</span> LOOT</span>
          </div>
          <div className="mt-2">Use 'scan' to spot enemies in range. Enemies have vision cones blocked by walls.</div>
      </footer>
    </div>
  );
}