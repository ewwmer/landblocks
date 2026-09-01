/* =========================================================================
   LandBlock - Block Sandbox Game Engine
   2D side-scrolling block world with player physics, farming, machines,
   monsters, pets, upgrades and localStorage saving.
   ========================================================================= */

"use strict";

/* =========================================================================
   CONFIGURATION (easy to edit)
   ========================================================================= */
const CONFIG = {
    TILE: 40,                 // pixel size of one block
    GRAVITY: 1800,            // px/s^2
    MOVE_SPEED: 300,          // px/s horizontal
    JUMP_VELOCITY: 820,       // jump impulse
    PLAYER_W: 34,
    PLAYER_H: 56,

    // Farming: potato growth time in ms
    GROW_TIME: 30000,

    // Exchange: potatoes per gear
    EXCHANGE_RATE: 100,

    START_POTATOES: 0,
    START_GEARS: 0,
    START_SEEDS: 10,

    // Monster
    FEEDS_PER_LEVEL: 5,
    MONSTER_MAX_HUNGER: 100,
    ITEM_FOOD_DROP: 28,
    GEAR_FOOD_DROP: 22,
    MONSTER_FOOD_COST: 1,     // monster food items per feed (added as reward)

    // Reward chances (shares)
    REWARD_WEIGHTS: { common: 60, uncommon: 30, rare: 9, legendary: 1 },

    // Upgrades - see rollUpgradePrice()
    UPGRADES: {
        fasterGrowth: { name: "Faster Growth", icon: "⏩", desc: "Potatoes grow 10% faster per level.", max: 5, base: 4, step: 3 },
        betterHarvest: { name: "Better Harvest", icon: "🌾", desc: "+1 potato per harvest per level.", max: 5, base: 3, step: 2 },
        monsterLuck:   { name: "Monster Luck", icon: "🍀", desc: "+2% rare/legendary reward chance per level.", max: 5, base: 5, step: 3 },
        running:       { name: "Swift Boots", icon: "👟", desc: "+12% move speed per level.", max: 4, base: 4, step: 3 }
    }
};

/* =========================================================================
   BLOCK DEFINITIONS
   ========================================================================= */
const BLOCK = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,       // log
    LEAVES: 5,
    SOIL: 6,       // farmable soil
    POTATO: 7,     // growing potato plant
    MACHINE: 8,    // gear exchange machine
};

// What the player can carry (hotbar items) and how they map to placed blocks
const HOTBAR_DEF = [
    { item: "seeds",    icon: "🌱", label: "Seeds",      key: "1", give: () => "seeds",    block: BLOCK.POTATO, use: "plant" },
    { item: "dirt",     icon: "🟫", label: "Dirt",       key: "2", give: () => "dirtBlocks", block: BLOCK.DIRT,   use: "place" },
    { item: "stone",    icon: "🪨", label: "Stone",      key: "3", give: () => "stoneBlocks", block: BLOCK.STONE,  use: "place" },
    { item: "wood",     icon: "🪵", label: "Log",        key: "4", give: () => "woodBlocks", block: BLOCK.WOOD,   use: "place" },
    { item: "soil",     icon: "🟤", label: "Soil",       key: "5", give: () => "soilBlocks", block: BLOCK.SOIL,   use: "place" }
];

/* =========================================================================
   ITEM / PET / REWARD DEFINITIONS (all original)
   ========================================================================= */
const ITEM_META = {
    seeds:        { name: "Potato Seeds",   icon: "🌱", rarity: "common" },
    potato:       { name: "Potatoes",       icon: "🥔", rarity: "common" },
    gears:        { name: "Gears",          icon: "⚙️", rarity: "uncommon" },
    monsterFood:  { name: "Monster Food",   icon: "🍖", rarity: "uncommon" },
    dirtBlocks:   { name: "Dirt Blocks",    icon: "🟫", rarity: "common" },
    stoneBlocks:  { name: "Stone Blocks",   icon: "🪨", rarity: "common" },
    woodBlocks:   { name: "Log Blocks",     icon: "🪵", rarity: "common" },
    soilBlocks:   { name: "Soil Blocks",    icon: "🟤", rarity: "common" }
};

const PETS = {
    potatoBug:   { name: "Potato Bug",   rarity: "common",     icon: "🐛", bonus: "extraHarvest", value: 1, desc: "+1 potato/harvest" },
    tinySlime:   { name: "Tiny Slime",   rarity: "common",     icon: "🫧", bonus: "fasterGrowth", value: 5, desc: "-5% growth time" },
    mole:        { name: "Mole",         rarity: "common",     icon: "🐹", bonus: "gemLuck",      value: 2, desc: "+2% rare luck" },
    greenDragon: { name: "Green Drake",  rarity: "uncommon",   icon: "🐉", bonus: "fasterGrowth", value: 12, desc: "-12% growth time" },
    rockTurtle:  { name: "Rock Turtle",  rarity: "uncommon",   icon: "🐢", bonus: "extraHarvest", value: 2, desc: "+2 potato/harvest" },
    goldenChick: { name: "Golden Roost", rarity: "uncommon",   icon: "🐔", bonus: "gearBonus",    value: 12, desc: "+12% gears" },
    shadowWolf:  { name: "Shadow Wolf",  rarity: "rare",       icon: "🐺", bonus: "gemLuck",      value: 5, desc: "+5% rare luck" },
    crystalFox:  { name: "Crystal Fox",  rarity: "rare",       icon: "🦊", bonus: "fasterGrowth", value: 22, desc: "-22% growth time" },
    babyBlorp:   { name: "Baby Blorp",   rarity: "rare",       icon: "👾", bonus: "extraHarvest", value: 3, desc: "+3 potato/harvest" },
    starImp:     { name: "Star Imp",     rarity: "legendary",  icon: "👽", bonus: "all",          value: 1, desc: "All bonuses +1 tier" }
};

const LEGENDARY_PETS = ["starImp"];
const RARE_PETS = ["shadowWolf", "crystalFox", "babyBlorp"];
const UNCOMMON_PETS = ["greenDragon", "rockTurtle", "goldenChick"];
const COMMON_PETS = ["potatoBug", "tinySlime", "mole"];

/* =========================================================================
   WORLD GENERATION
   ========================================================================= */

// World map: grid of block ids. Index: x + y * width. y=0 is top.
function createWorld() {
    const w = 120;
    const h = 60;
    const grid = new Array(w * h).fill(BLOCK.AIR);

    // Terrain: surface around y=30
    const surfaceY = 30;
    for (let x = 0; x < w; x++) {
        // natural variation
        let y = surfaceY;
        for (let yy = y; yy < h; yy++) {
            grid[x + yy * w] = BLOCK.DIRT;
        }
        grid[x + y * w] = BLOCK.GRASS;
        // stone deep underground
        for (let yy = surfaceY + 14; yy < h; yy++) {
            grid[x + yy * w] = BLOCK.STONE;
        }
    }
    // Ensure a flat base floor so the player can't fall out
    for (let x = 0; x < w; x++) {
        grid[x + (h - 1) * w] = BLOCK.STONE;
    }

    // A few decorative trees
    const trees = [8, 20, 78, 100];
    trees.forEach((tx) => {
        const ground = surfaceY;
        // trunk
        for (let yy = ground - 3; yy < ground; yy++) {
            grid[tx + yy * w] = BLOCK.WOOD;
        }
        // leaves (simple blob)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -3; dy <= -1; dy++) {
                if (dx === 0 && dy === -1) continue; // trunk top
                const nx = tx + dx, ny = ground + dy;
                if (nx >= 0 && nx < w && ny >= 0) grid[nx + ny * w] = BLOCK.LEAVES;
            }
        }
        grid[tx + (ground - 3) * w] = BLOCK.WOOD; // trunk under crown
    });

    return { w, h, grid, surfaceY };
}

// Place a farm plot: a patch of soil with a few rows, plus exchange machine & monster
function decorateWorld(grid, w, h, surfaceY) {
    // Farm plot: dig out a flat area around x=40..60 and line with soil
    const farmX0 = 42, farmX1 = 58;
    const farmY = surfaceY;
    for (let x = farmX0; x <= farmX1; x++) {
        for (let yy = farmY; yy < farmY + 2; yy++) {
            grid[x + yy * w] = BLOCK.DIRT;
        }
        grid[x + farmY * w] = BLOCK.SOIL;
    }
    // Farm soil top row is the plantable area
    return { set: (x, y, id) => { grid[x + y * w] = id; }, get: (x, y) => grid[x + y * w] };
}

/* =========================================================================
   STATE
   ========================================================================= */
const SAVE_KEY = "landblock_save_v3";

let state = null;
let world = null;

function defaultState() {
    return {
        name: "Farmer",
        potatoes: CONFIG.START_POTATOES,
        gears: CONFIG.START_GEARS,
        inventory: { seeds: CONFIG.START_SEEDS },
        player: { x: 0, y: 0, vx: 0, vy: 0, onGround: false, dir: 1, face: "farmer" },
        crops: [],      // { x, y (tile coords), start, stage }
        monster: { level: 1, hunger: CONFIG.MONSTER_MAX_HUNGER, feeds: 0, fed: false },
        pets: [],       // [{ uid, id, level, exp }]
        activePetUid: null,
        upgrades: { fasterGrowth: 0, betterHarvest: 0, monsterLuck: 0, running: 0 },
        surfaceY: 30,
        worldSeed: 1
    };
}

function newGame(name) {
    state = defaultState();
    if (name) state.name = name;
    world = createWorld();
    decorateWorld(world.grid, world.w, world.h, world.surfaceY);
    // Spawn player near farm / surface
    state.player.x = 30 * CONFIG.TILE;
    state.player.y = (state.surfaceY - 2) * CONFIG.TILE;
    saveToStorage();
}

function buildSave() {
    const g = world.grid;
    const gridToSave = {};
    // Only store non-air tiles to keep save small; restore air implicitly
    for (let i = 0; i < g.length; i++) {
        if (g[i] !== BLOCK.AIR) gridToSave[i] = g[i];
    }
    return { state, worldGrid: gridToSave, w: world.w, h: world.h };
}

function saveToStorage() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave()));
        const t = document.getElementById("toast");
        if (t) showToast("💾 Saved");
    } catch (e) { /* storage full */ }
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { newGame("Farmer"); return; }
    try {
        const data = JSON.parse(raw);
        state = data.state;
        world = { w: data.w, h: data.h, grid: new Array(data.w * data.h).fill(BLOCK.AIR), surfaceY: state.surfaceY };
        for (const key in data.worldGrid) world.grid[parseInt(key)] = data.worldGrid[key];
        // Compute offline growth for crops
        const now = Date.now();
        state.crops.forEach((c) => {
            const total = getGrowthTime();
            const elapsed = now - c.start;
            if (elapsed >= total) { c.done = true; }
        });
        // Cap hunger/level up from feeds while away
        // (simple: hunger gradually restored to full while away)
        state.monster.hunger = CONFIG.MONSTER_MAX_HUNGER;
    } catch (e) {
        newGame("Farmer");
    }
}

function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    newGame("Farmer");
}

/* =========================================================================
   DOM HELPERS
   ========================================================================= */
const $ = (id) => document.getElementById(id);

function showToast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* =========================================================================
   GROWTH / BONUS CALCULATIONS
   ========================================================================= */
function getActivePet() {
    if (!state.activePetUid) return null;
    return state.pets.find((p) => p.uid === state.activePetUid) || null;
}

function petBonus(type) {
    const pet = getActivePet();
    if (!pet) return 0;
    const def = PETS[pet.id];
    if (!def) return 0;
    if (def.bonus === "all") return 1; // legendary: boosts everything
    if (def.bonus === type) return def.value;
    return 0;
}

function getGrowthTime() {
    let t = CONFIG.GROW_TIME;
    t *= (1 - state.upgrades.fasterGrowth * 0.10);
    const g = petBonus("fasterGrowth");
    if (g) t *= (1 - g / 100);
    return Math.max(1000, t);
}

function getHarvestBonus() {
    let b = state.upgrades.betterHarvest;
    b += petBonus("extraHarvest");
    if (petBonus("all")) b += 1;
    return b;
}

function getGearMultiplier() {
    let m = 1;
    const g = petBonus("gearBonus");
    if (g) m += g / 100;
    return m;
}

function getRareLuckBonus() {
    let l = state.upgrades.monsterLuck * 2;
    l += state.upgrades.monsterLuck * 0 + petBonus("gemLuck");
    if (petBonus("all")) l += 2;
    return l;
}

function getMoveSpeed() {
    return CONFIG.MOVE_SPEED * (1 + state.upgrades.running * 0.12);
}

/* =========================================================================
   HOTBAR
   ========================================================================= */
function renderHotbar() {
    const hb = $("hotbar");
    hb.innerHTML = "";
    HOTBAR_DEF.forEach((def, i) => {
        const slot = document.createElement("div");
        slot.className = "hotbar-slot" + (i === selectedSlot ? " selected" : "");
        slot.dataset.slot = i;
        slot.innerHTML =
            '<span>' +
                '<div class="slot-icon">' + def.icon + '</div>' +
                '<div class="slot-count">' + (getInventoryCount(def.give()) || "") + '</div>' +
            '</span>' +
            '<div class="slot-key">' + def.key + '</div>';
        slot.addEventListener("click", () => { selectedSlot = i; renderHotbar(); });
        hb.appendChild(slot);
    });
}

function getInventoryCount(itemKey) {
    return state.inventory[itemKey] || 0;
}

let selectedSlot = 0;

/* =========================================================================
   PLAYER PHYSICS
   ========================================================================= */
const input = { left: false, right: false, jump: false, jumpBuf: 0 };

function isSolid(id) {
    return id !== BLOCK.AIR;
}
// blocks that block movement but are interactable
function isBreakable(id) {
    return id === BLOCK.GRASS || id === BLOCK.DIRT || id === BLOCK.STONE ||
           id === BLOCK.WOOD || id === BLOCK.LEAVES || id === BLOCK.SOIL ||
           id === BLOCK.POTATO;
}
function isPlaceableBlock(id) {
    return id === BLOCK.DIRT || id === BLOCK.STONE || id === BLOCK.WOOD || id === BLOCK.SOIL;
}

function tileAt(px, py) {
    const tx = Math.floor(px / CONFIG.TILE);
    const ty = Math.floor(py / CONFIG.TILE);
    if (tx < 0 || tx >= world.w || ty < 0 || ty >= world.h) return BLOCK.STONE;
    return world.grid[tx + ty * world.w];
}

function solidAt(px, py) {
    return isSolid(tileAt(px, py));
}

function setTile(tx, ty, id) {
    if (tx < 0 || tx >= world.w || ty < 0 || ty >= world.h) return;
    world.grid[tx + ty * world.w] = id;
}

function getTile(tx, ty) {
    if (tx < 0 || tx >= world.w || ty < 0 || ty >= world.h) return BLOCK.STONE;
    return world.grid[tx + ty * world.w];
}

let jumpHeld = false;

// Axis-separated collision movement
function movePlayer(dt) {
    const p = state.player;
    const spd = getMoveSpeed();

    // Horizontal velocity
    p.vx = (input.right ? spd : 0) - (input.left ? spd : 0);
    if (p.vx !== 0) p.dir = p.vx > 0 ? 1 : -1;

    // Jump buffering
    if (input.jump) { input.jumpBuf = 0.12; input.jump = false; }
    if (input.jumpBuf > 0) {
        if (p.onGround) { p.vy = -CONFIG.JUMP_VELOCITY; input.jumpBuf = 0; }
        input.jumpBuf -= dt;
    }

    // Variable jump: cut upward speed if jump released
    const jumpReleased = !keys[" "] && !keys["w"] && !keys["W"] && !keys["ArrowUp"];
    if (jumpReleased && p.vy < 0) p.vy *= 0.85;

    // Gravity
    p.vy = Math.min(1400, p.vy + CONFIG.GRAVITY * dt);

    // Move + resolve horizontally, then vertically
    resolveCollisions(p, dt);
}

function checkCollide(p, nx, ny) {
    const halfX = CONFIG.PLAYER_W / 2;
    const x1 = nx - halfX, x2 = nx + halfX - 0.01;
    const y1 = ny, y2 = ny + CONFIG.PLAYER_H - 0.01;
    return solidAt(x1, y1) || solidAt(x2, y1) || solidAt(x1, y2) || solidAt(x2, y2);
}

function resolveCollisions(p, dt) {
    // Horizontal
    p.x += p.vx * dt;
    if (checkCollide(p, p.x, p.y)) {
        while (checkCollide(p, p.x, p.y) && p.vx !== 0) p.x -= Math.sign(p.vx) * 0.5;
    }

    // Vertical
    p.y += p.vy * dt;
    p.onGround = false;
    if (checkCollide(p, p.x, p.y)) {
        const dir = Math.sign(p.vy) || 1;
        let guard = 0;
        while (checkCollide(p, p.x, p.y) && guard < 200) { p.y -= dir * 0.5; guard++; }
        if (dir > 0) p.onGround = true;
        p.vy = 0;
    }
}

/* =========================================================================
   INTERACTION (mouse)
   ========================================================================= */
let mouse = { x: 0, y: 0 };

// Monster world tile position (rendered at x=72..73 near surface)
const MONSTER_TILE_X = 72;
const MACHINE_TILE_X = 34;

function isMonsterTile(tx, ty) {
    return (tx === MONSTER_TILE_X) && (ty === state.surfaceY - 1);
}
function isMachineTile(tx, ty) {
    return (tx === MACHINE_TILE_X) && (ty === state.surfaceY - 1);
}

function interactAt(cam, isBreak) {
    const wx = cam.x + mouse.x;
    const wy = cam.y + mouse.y;
    const tx = Math.floor(wx / CONFIG.TILE);
    const ty = Math.floor(wy / CONFIG.TILE);
    if (tx < 0 || tx >= world.w || ty < 0 || ty >= world.h) return;

    const id = getTile(tx, ty);

    if (isMonsterTile(tx, ty)) { openMonster(); return; }
    if (isMachineTile(tx, ty) || id === BLOCK.MACHINE) { openExchange(); return; }

    if (!isBreak) {
        // Right click = place/interact
        if (id === BLOCK.POTATO && isCropReady(tx, ty)) { harvestCrop(tx, ty); return; }
        placeSelected(tx, ty);
        return;
    }

    // Left click = break
    if (id === BLOCK.POTATO) {
        // if ready, harvest; else give seed back
        if (isCropReady(tx, ty)) { harvestCrop(tx, ty); }
        else { removeCropAt(tx, ty); setTile(tx, ty, BLOCK.SOIL); addItem("seeds", 1); showToast("🌱 Seed recovered"); }
        return;
    }
    if (isBreakable(id)) {
        breakBlock(tx, ty);
    }
}

function breakBlock(tx, ty) {
    const id = getTile(tx, ty);
    const drop = blockDrop(id);
    if (drop) addItem(drop, 1);
    setTile(tx, ty, BLOCK.AIR);
    showToast("⛏️ +1 " + ITEM_META[drop].name);
    saveToStorage();
}

function blockDrop(id) {
    switch (id) {
        case BLOCK.GRASS: return "dirtBlocks";
        case BLOCK.DIRT: return "dirtBlocks";
        case BLOCK.STONE: return "stoneBlocks";
        case BLOCK.WOOD: return "woodBlocks";
        case BLOCK.LEAVES: return "woodBlocks";
        case BLOCK.SOIL: return "soilBlocks";
        default: return null;
    }
}

function placeSelected(tx, ty) {
    const def = HOTBAR_DEF[selectedSlot];
    if (!def) return;
    const id = getTile(tx, ty);
    if (id !== BLOCK.AIR) return; // can't place inside existing

    // Can't place over non-air adjacent to player (avoid trapping) - simple check
    if (def.use === "plant") {
        // Must plant on SOIL
        const below = getTile(tx, ty + 1);
        if (below !== BLOCK.SOIL) { showToast("🌱 Needs soil below!"); return; }
        if (getInventoryCount("seeds") <= 0) { showToast("🌱 No seeds!"); return; }
        // reuse existing crop at that spot
        removeCropAt(tx, ty);
        setTile(tx, ty, BLOCK.POTATO);
        addCrop(tx, ty);
        addItem("seeds", -1);
        showToast("🌱 Planted");
        saveToStorage();
        return;
    }
    // Place a builder block
    if (getInventoryCount(def.give()) <= 0) { showToast("🪨 No blocks!"); return; }
    setTile(tx, ty, def.block);
    addItem(def.give(), -1);
    saveToStorage();
}

/* =========================================================================
   FARMING / CROPS
   ========================================================================= */
function addCrop(tx, ty) {
    state.crops.push({ x: tx, y: ty, start: Date.now(), done: false });
}
function removeCropAt(tx, ty) {
    state.crops = state.crops.filter((c) => !(c.x === tx && c.y === ty));
}
function cropAt(tx, ty) {
    return state.crops.find((c) => c.x === tx && c.y === ty);
}
function isCropReady(tx, ty) {
    const c = cropAt(tx, ty);
    if (!c) return false;
    const total = getGrowthTime();
    return (Date.now() - c.start) >= total || c.done;
}
function cropProgress(c) {
    return Math.min(1, (Date.now() - c.start) / getGrowthTime());
}

function harvestCrop(tx, ty) {
    const total = getGrowthTime(); // compute small bonuses
    let amount = 1 + getHarvestBonus();
    const c = cropAt(tx, ty);
    state.potatoes += amount;
    addItem("potato", amount);
    setTile(tx, ty, BLOCK.SOIL);
    if (c) {
        // occasionally give a seed back
        if (Math.random() < 0.35) addItem("seeds", 1);
        removeCropAt(tx, ty);
    }
    showToast("🥔 +" + amount + " potatoes");
    saveToStorage();
}

/* =========================================================================
   EXCHANGE MACHINE
   ========================================================================= */
function openExchange() {
    $("exRateP").textContent = CONFIG.EXCHANGE_RATE;
    $("exAmount").value = 1;
    $("exFeedback").textContent = "";
    $("exFeedback").className = "feedback";
    openModal("overlay-exchange");
}

function doExchange() {
    let amount = parseInt($("exAmount").value) || 1;
    if (amount < 1) amount = 1;
    const cost = amount * CONFIG.EXCHANGE_RATE;
    if (state.potatoes < cost) {
        $("exFeedback").textContent = "Not enough potatoes!";
        $("exFeedback").className = "feedback error";
        return;
    }
    let gears = Math.floor(amount * getGearMultiplier());
    state.potatoes -= cost;
    state.gears += gears;
    addItem("potato", -cost);
    addItem("gears", gears);
    const bonus = gears - amount;
    $("exFeedback").textContent = bonus > 0 ? ("⚙️ +" + gears + " (+" + bonus + " bonus)") : ("⚙️ +" + gears + " gears");
    $("exFeedback").className = "feedback success";
    updateHUD();
    saveToStorage();
}

/* =========================================================================
   MONSTER
   ========================================================================= */
function openMonster() {
    renderMonsterButtons();
    $("monFeedback").textContent = "";
    $("monFeedback").className = "feedback";
    openModal("overlay-monster");
}

function feedMonster(kind) {
    if (state.monster.hunger <= 0) { showToast("😴 Monster is full!"); $("monFeedback").textContent = "My tummy is full, thanks!"; return; }
    if (kind === "gear") {
        if (state.gears < 1) { $("monFeedback").textContent = "Need a gear!"; $("monFeedback").className="feedback error"; return; }
        state.gears -= 1; addItem("gears", -1);
        state.monster.hunger = Math.max(0, state.monster.hunger - CONFIG.GEAR_FOOD_DROP);
    } else {
        if (getInventoryCount("monsterFood") < 1) { $("monFeedback").textContent = "Need monster food!"; $("monFeedback").className="feedback error"; return; }
        addItem("monsterFood", -1);
        state.monster.hunger = Math.max(0, state.monster.hunger - CONFIG.ITEM_FOOD_DROP);
    }

    state.monster.feeds += 1;
    if (state.monster.feeds % CONFIG.FEEDS_PER_LEVEL === 0 && state.monster.feeds > 0) {
        state.monster.level += 1;
        showToast("🎉 Monster reached level " + state.monster.level + "!");
        state.monster.hunger = CONFIG.MONSTER_MAX_HUNGER;
    }

    // Random reward
    const reward = rollReward();
    applyReward(reward);
    renderMonsterButtons();
    updateHUD();
    saveToStorage();
}

function renderMonsterButtons() {
    const m = state.monster;
    $("monLevel").textContent = m.level;
    $("monHunger").textContent = Math.round((m.hunger / CONFIG.MONSTER_MAX_HUNGER) * 100);
    $("monHungerFill").style.width = Math.max(0, (m.hunger / CONFIG.MONSTER_MAX_HUNGER) * 100) + "%";
    $("feedGearBtn").disabled = state.gears < 1;
    $("feedFoodBtn").disabled = getInventoryCount("monsterFood") < 1;
}

function rollReward() {
    const luck = Math.min(30, getRareLuckBonus());
    let we = { ...CONFIG.REWARD_WEIGHTS };
    // Move weight from common to rare+legendary proportional to luck
    const shift = luck; // shares
    we.common = Math.max(0, we.common - shift);
    // distribute shift to rare/legendary
    const extra = shift;
    we.rare += extra * 0.8;
    we.legendary += extra * 0.2;
    const total = Object.values(we).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [tier, w] of Object.entries(we)) {
        if (roll < w) return tier;
        roll -= w;
    }
    return "common";
}

function applyReward(tier) {
    const petId = pickRandomPet(tier);
    const petDef = PETS[petId];
    let reward;
    switch (tier) {
        case "legendary": {
            reward = { icon: petDef.icon, title: petDef.name, text: "Legendary pet! (+bonuses)", tier: "legendary" };
            addPet(petId); break;
        }
        case "rare": {
            if (Math.random() < 0.6) {
                reward = { icon: petDef.icon, title: petDef.name, text: "Rare pet!", tier: "rare" };
                addPet(petId);
            } else {
                const amt = rand(3, 6); addItem("gears", amt);
                reward = { icon: "⚙️", title: "Gears", text: "+" + amt + " gears", tier: "rare" };
            }
            break;
        }
        case "uncommon": {
            const choices = [
                () => { const a = rand(5, 10); addItem("seeds", a); return { icon: "🌱", title: "Seeds", text: "+" + a + " seeds" }; },
                () => { const a = rand(1, 2); addItem("monsterFood", a); return { icon: "🍖", title: "Monster Food", text: "+" + a + " food" }; },
                () => { const a = rand(4, 10); addItem("soilBlocks", a); return { icon: "🟤", title: "Soil", text: "+" + a + " soil" }; }
            ];
            reward = pick(choices)(); reward.tier = "uncommon";
            break;
        }
        default: {
            const choices = [
                () => { const a = rand(6, 14); state.potatoes += a; addItem("potato", a); return { icon: "🥔", title: "Potatoes", text: "+" + a + " potatoes" }; },
                () => { const a = rand(2, 5); addItem("seeds", a); return { icon: "🌱", title: "Seeds", text: "+" + a + " seeds" }; },
                () => { const a = rand(3, 8); addItem("dirtBlocks", a); return { icon: "🟫", title: "Dirt", text: "+" + a + " dirt" }; },
                () => { const a = rand(1, 2); addItem("monsterFood", a); return { icon: "🍖", title: "Monster Food", text: "+" + a + " food" }; }
            ];
            reward = pick(choices)(); reward.tier = "common";
            break;
        }
    }
    showReward(reward);
}

function pickRandomPet(tier) {
    let pool;
    if (tier === "legendary") pool = LEGENDARY_PETS;
    else if (tier === "rare") pool = RARE_PETS;
    else if (tier === "uncommon") pool = UNCOMMON_PETS;
    else pool = COMMON_PETS;
    return pick(pool);
}

function addPet(petId) {
    const pet = { uid: petId + "_" + Date.now(), id: petId, level: 1, exp: 0 };
    state.pets.push(pet);
    if (!state.activePetUid) state.activePetUid = pet.uid;
}

/* =========================================================================
   REWARD POPUP
   ========================================================================= */
function showReward(reward) {
    $("rewardTitle").textContent = reward.title;
    $("rewardIcon").textContent = reward.icon;
    $("rewardText").innerHTML = '<span class="ra-reward">' + (reward.tier ? reward.tier.toUpperCase() : "") + '</span><span class="big">' + reward.text + '</span>';
    openModal("overlay-reward");
    confetti();
}

function confetti() {
    const colors = ["#ffd24a", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6", "#e67e22"];
    for (let i = 0; i < 24; i++) {
        const p = document.createElement("div");
        p.className = "confetti";
        p.style.left = Math.random() * 100 + "vw";
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.animationDelay = (Math.random() * 0.4) + "s";
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1900);
    }
}

/* =========================================================================
   UPGRADES
   ========================================================================= */
function upgradePrice(key) {
    const def = CONFIG.UPGRADES[key];
    const lvl = state.upgrades[key];
    return def.base + lvl * def.step;
}

function buyUpgrade(key) {
    const def = CONFIG.UPGRADES[key];
    if (state.upgrades[key] >= def.max) return;
    const cost = upgradePrice(key);
    if (state.gears < cost) { showToast("⚙️ Not enough gears!"); return; }
    state.gears -= cost; addItem("gears", -cost);
    state.upgrades[key] += 1;
    showToast("🚀 " + def.name + " upgraded!");
    renderUpgradeList();
    updateHUD();
    saveToStorage();
}

/* =========================================================================
   MODALS
   ========================================================================= */
function openModal(id) {
    $(id).classList.remove("hidden");
}
function closeModal(id) {
    $(id).classList.add("hidden");
}
function closeAllModals() {
    document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
}

/* =========================================================================
   HUD / INVENTORY / PETS / UPGRADES RENDERING
   ========================================================================= */
function updateHUD() {
    $("hudPotatoes").textContent = formatNum(state.potatoes);
    $("hudGears").textContent = formatNum(state.gears);
    const pet = getActivePet();
    if (pet) {
        const def = PETS[pet.id] || { icon: "🐾" };
        $("hudPetName").textContent = def.name;
        $("hudPetIcon").textContent = def.icon;
    } else {
        $("hudPetName").textContent = "--";
        $("hudPetIcon").textContent = "🐾";
    }
}

function formatNum(n) {
    return n.toLocaleString();
}

function renderInventory() {
    const body = $("invBody");
    body.innerHTML = "";
    const entries = Object.entries(state.inventory).filter(([k, v]) => v > 0);
    if (entries.length === 0) { body.innerHTML = '<div class="empty-msg">Empty inventory. Break blocks or harvest!</div>'; return; }
    entries.forEach(([k, v]) => {
        const meta = ITEM_META[k];
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML =
            '<span class="ic">' + meta.icon + '</span>' +
            '<span class="nm">' + meta.name + '</span>' +
            '<span class="rarity rarity-' + meta.rarity + '">' + meta.rarity.toUpperCase() + '</span>' +
            '<span class="qt">' + v + '</span>';
        body.appendChild(row);
    });
}

function renderPets() {
    const body = $("petBody");
    body.innerHTML = "";
    if (state.pets.length === 0) { body.innerHTML = '<div class="empty-msg">No pets yet. Feed the monster!</div>'; return; }
    state.pets.forEach((pet) => {
        const def = PETS[pet.id] || { name: pet.id, icon: "🐾", rarity: "common", desc: "" };
        const row = document.createElement("div");
        row.className = "row" + (state.activePetUid === pet.uid ? " active" : "");
        row.innerHTML =
            '<span class="ic">' + def.icon + '</span>' +
            '<span class="nm">' + def.name + ' <span class="rarity rarity-' + def.rarity + '">' + def.rarity.toUpperCase() + '</span></span>' +
            '<span class="ds">' + def.desc + ' · Lv' + pet.level + '</span>';
        const btn = document.createElement("button");
        btn.className = "mini-btn";
        btn.textContent = state.activePetUid === pet.uid ? "✓" : "Use";
        if (state.activePetUid !== pet.uid) btn.onclick = () => { state.activePetUid = pet.uid; renderPets(); showToast("🐾 " + def.name + " equipped!"); };
        else btn.disabled = true;
        row.appendChild(btn);
        body.appendChild(row);
    });
}

function renderUpgradeList() {
    const body = $("upgradeBody");
    body.innerHTML = "";
    Object.entries(CONFIG.UPGRADES).forEach(([key, def]) => {
        const lvl = state.upgrades[key];
        const maxed = lvl >= def.max;
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML =
            '<span class="ic">' + def.icon + '</span>' +
            '<span>' +
                '<span class="nm">' + def.name + '</span> ' +
                '<span class="rarity rarity-uncommon">' + lvl + '/' + def.max + '</span>' +
                '<div class="ds">' + def.desc + '</div>' +
            '</span>';
        const btn = document.createElement("button");
        btn.className = "mini-btn";
        if (maxed) { btn.textContent = "MAX"; btn.disabled = true; }
        else { btn.textContent = "⚙️" + upgradePrice(key); btn.onclick = () => buyUpgrade(key); }
        row.appendChild(btn);
        body.appendChild(row);
    });
}

/* =========================================================================
   CANVAS RENDERING
   ========================================================================= */
let canvas, ctx, cam = { x: 0, y: 0 };

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function updateCamera() {
    const p = state.player;
    cam.x = p.x - canvas.width / 2;
    cam.y = p.y - canvas.height * 0.6;
    // clamp to world
    cam.y = Math.max(cam.y, -200);
}

const BLOCK_COLORS = {
    [BLOCK.GRASS]: { top: "#7ec850", main: "#6ab843" },
    [BLOCK.DIRT]: { main: "#8a5a2b", dark: "#6f4520" },
    [BLOCK.STONE]: { main: "#9aa0a8", dark: "#7a8088" },
    [BLOCK.WOOD]: { main: "#8a5a2b", ring: "#6b4420" },
    [BLOCK.LEAVES]: { main: "#3f9b3f", dark: "#2f7a2f" },
    [BLOCK.SOIL]: { main: "#6d4520", dark: "#55371a" },
    [BLOCK.MACHINE]: { main: "#4a8ac9", dark: "#2f5f8a" }
};

function drawBlock(tx, ty, id, growProgress) {
    const T = CONFIG.TILE;
    const px = tx * T - cam.x;
    const py = ty * T - cam.y;
    if (px + T < 0 || px > canvas.width || py + T < 0 || py > canvas.height) return;

    ctx.fillStyle = "#20262e";
    ctx.fillRect(px, py, T, T);

    if (id === BLOCK.POTATO) {
        // draw soil tile beneath
        drawSoilTile(px, py, T);
        // draw potato plant based on progress
        drawPotatoPlant(px, py, T, growProgress);
        return;
    }

    const c = BLOCK_COLORS[id] || BLOCK_COLORS[BLOCK.DIRT];
    ctx.fillStyle = c.main || "#8a5a2b";
    ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
    // top highlight
    if (c.top) { ctx.fillStyle = c.top; ctx.fillRect(px + 1, py + 1, T - 2, Math.max(2, T * 0.22)); }
    // bottom shade
    ctx.fillStyle = c.dark || "rgba(0,0,0,0.2)";
    ctx.fillRect(px + 1, py + T * 0.8, T - 2, T * 0.2);
    // pixel border
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);

    // details
    if (id === BLOCK.GRASS) {
        ctx.fillStyle = "#5aa83a";
        ctx.fillRect(px + 6, py + 1, 4, 6);
        ctx.fillRect(px + 20, py + 1, 4, 7);
        ctx.fillRect(px + 32, py + 2, 3, 4);
    } else if (id === BLOCK.STONE) {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(px + 8, py + 8, 8, 4);
        ctx.fillRect(px + 22, py + 20, 10, 5);
    } else if (id === BLOCK.WOOD) {
        ctx.fillStyle = "#5f3f1e";
        ctx.fillRect(px + T*0.45, py + 2, 4, 14);
        ctx.fillRect(px + T*0.45, py + 24, 4, 14);
    } else if (id === BLOCK.LEAVES) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(px + 6, py + 12, 6, 6);
        ctx.fillRect(px + 24, py + 24, 7, 6);
    }
}

function drawSoilTile(px, py, T) {
    ctx.fillStyle = "#6d4520";
    ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(px + 1, py + T*0.7, T - 2, T*0.3);
}

function drawPotatoPlant(px, py, T, prog) {
    // prog 0..1
    const cx = px + T / 2;
    const base = py + T;
    ctx.fillStyle = "#3a2a14";
    if (prog <= 0.3) {
        // sprout
        ctx.fillStyle = "#9be36b";
        ctx.fillRect(cx - 2, base - 8, 4, 8);
        ctx.fillRect(cx - 5, base - 14, 10, 7);
    } else if (prog <= 0.6) {
        // small bush
        ctx.fillStyle = "#6fca4f";
        ctx.fillRect(cx - 8, base - 16, 16, 12);
        ctx.fillStyle = "#9be36b";
        ctx.fillRect(cx - 4, base - 20, 8, 6);
    } else if (prog < 1) {
        // full bush
        ctx.fillStyle = "#58b843";
        ctx.fillRect(cx - 12, base - 22, 24, 20);
        ctx.fillStyle = "#7ed957";
        ctx.fillRect(cx - 8, base - 26, 16, 8);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(cx - 4, base - 24, 4, 3);
    } else {
        // ready: bush with golden potato glow
        ctx.fillStyle = "#4fae3a";
        ctx.fillRect(cx - 13, base - 24, 26, 22);
        ctx.fillStyle = "#7ed957";
        ctx.fillRect(cx - 9, base - 28, 18, 8);
        // potato visible
        ctx.fillStyle = "#ffd24a";
        ctx.fillRect(cx - 6, base - 10, 12, 9);
        ctx.fillStyle = "#b8860b";
        ctx.fillRect(cx - 4, base - 8, 3, 3);
    }
}

function drawPlayer() {
    const p = state.player;
    const T = CONFIG.TILE;
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const w = CONFIG.PLAYER_W;
    const h = CONFIG.PLAYER_H;
    const d = p.dir;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x - w/2, y + h - 2, w, 4);

    // body
    ctx.fillStyle = "#e07b39"; // shirt
    ctx.fillRect(x - w/2, y + 14, w, h - 16);

    // legs
    ctx.fillStyle = "#3a4a8f";
    ctx.fillRect(x - w/2 + 2, y + h - 16, w/2 - 4, 14);
    ctx.fillRect(x + 2, y + h - 16, w/2 - 4, 14);
    // boots
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(x - w/2 + 1, y + h - 4, w/2 - 2, 4);
    ctx.fillRect(x + 1, y + h - 4, w/2 - 2, 4);

    // head
    ctx.fillStyle = "#f2c690";
    ctx.fillRect(x - 10, y, 20, 16);
    // hair
    ctx.fillStyle = "#5a3b1a";
    ctx.fillRect(x - 10, y, 20, 5);
    // cap
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(x - 11, y - 2, 22, 5);

    // face direction
    ctx.fillStyle = "#2a2a2a";
    if (d > 0) { ctx.fillRect(x + 5, y + 8, 3, 3); }
    else { ctx.fillRect(x - 8, y + 8, 3, 3); }

    // held item hint
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px sans-serif";
    ctx.fillText(HOTBAR_DEF[selectedSlot].icon, x + d * 10, y - 4);
}

function drawMonster() {
    // Monster sits on a small platform near the farm
    const mx = MONSTER_TILE_X * CONFIG.TILE;
    const my = (state.surfaceY - 1) * CONFIG.TILE;
    const x = mx - cam.x, y = my - cam.y;
    const T = CONFIG.TILE;
    if (x + T*2 < 0 || x > canvas.width) return;

    const bob = Math.sin(Date.now() / 500) * 3;
    // body
    ctx.fillStyle = "#6d3fb0";
    ctx.fillRect(x, y - T - 10 + bob, T * 2, T + 6);
    ctx.fillStyle = "#8a55d0";
    ctx.fillRect(x + 4, y - T - 10 + bob, T * 2 - 8, 10);
    // eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 12, y - T - 4 + bob, 12, 10);
    ctx.fillRect(x + 40, y - T - 4 + bob, 12, 10);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 17, y - T - 1 + bob, 5, 5);
    ctx.fillRect(x + 45, y - T - 1 + bob, 5, 5);
    // mouth
    ctx.fillStyle = "#3a1d1d";
    ctx.fillRect(x + 22, y - T + 8 + bob, 18, 4);
    // label
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Blorp Lv" + state.monster.level, x + T, y - T - 16 + bob);
    ctx.textAlign = "left";
}

function drawExchangeMachine() {
    const mx = MACHINE_TILE_X * CONFIG.TILE;
    const my = (state.surfaceY - 1) * CONFIG.TILE;
    const x = mx - cam.x, y = my - cam.y;
    const T = CONFIG.TILE;
    if (x + T < 0) return;
    // machine body
    ctx.fillStyle = "#4a8ac9";
    ctx.fillRect(x, y - T - 8, T, T + 8);
    // screen
    ctx.fillStyle = "#1b2b3a";
    ctx.fillRect(x + 6, y - T, T - 12, 14);
    ctx.fillStyle = "#2ecc71";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EXCHANGE", x + T/2, y - T + 10);
    ctx.textAlign = "left";
    ctx.fillStyle = "#b8c9d8";
    ctx.font = "8px sans-serif";
    ctx.fillText("🥔→⚙️", x + T/2 - 8, y - T + 24);
}

function drawPets() {
    const pet = getActivePet();
    if (!pet) return;
    const def = PETS[pet.id] || { icon: "🐾" };
    const p = state.player;
    const px = p.x - cam.x + 40;
    const py = p.y - cam.y - 10 + Math.sin(Date.now() / 400) * 2;
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(def.icon, px, py);
    ctx.textAlign = "left";
}

function drawWorld() {
    // Determine visible tile range
    const x0 = Math.floor(cam.x / CONFIG.TILE) - 1;
    const x1 = Math.floor((cam.x + canvas.width) / CONFIG.TILE) + 1;
    const y0 = Math.floor(cam.y / CONFIG.TILE) - 1;
    const y1 = Math.floor((cam.y + canvas.height) / CONFIG.TILE) + 1;

    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            if (tx < 0 || tx >= world.w || ty < 0 || ty >= world.h) continue;
            const id = getTile(tx, ty);
            if (id === BLOCK.AIR) continue;
            let prog = 0;
            if (id === BLOCK.POTATO) {
                const c = cropAt(tx, ty);
                prog = c ? cropProgress(c) : 1;
            }
            drawBlock(tx, ty, id, prog);
        }
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#5fbee8");
    grad.addColorStop(0.6, "#a7ddf0");
    grad.addColorStop(1, "#8fd08a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawWorld();
    drawMonster();
    drawExchangeMachine();
    drawPets();
    drawPlayer();
}

/* =========================================================================
   MAIN LOOP
   ========================================================================= */
let last = performance.now();
let keys = {};

let lastAutoSave = performance.now();

function gameLoop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    movePlayer(dt);
    updateCamera();
    render();
    updateInteractPrompt();

    // Auto-save player position / world periodically (throttled)
    if (now - lastAutoSave > 3000) {
        lastAutoSave = now;
        saveToStorage();
    }

    requestAnimationFrame(gameLoop);
}

function updateInteractPrompt() {
    const prompt = $("interactPrompt");
    // check proximity to machine / monster / farm
    const p = state.player;
    const px = Math.floor(p.x / CONFIG.TILE);
    const py = Math.floor((p.y + CONFIG.PLAYER_H / 2) / CONFIG.TILE);

    let msg = "";
    // near machine
    if (Math.abs(px - MACHINE_TILE_X) <= 2 && Math.abs(py - state.surfaceY) <= 3) msg = "Press E or click machine to exchange";
    // near monster
    if (Math.abs(px - MONSTER_TILE_X) <= 2 && Math.abs(py - state.surfaceY) <= 3) msg = "Press E or click Blorp to feed";
    // over a ready crop
    if (!msg) {
        // check tile at player half height in front
        const fTx = Math.floor((p.x + p.dir * 20) / CONFIG.TILE);
        const fTy = Math.floor((p.y + CONFIG.PLAYER_H / 2) / CONFIG.TILE);
        if (getTile(fTx, fTy) === BLOCK.POTATO && isCropReady(fTx, fTy)) msg = "Click to harvest!";
    }

    if (msg) { prompt.textContent = msg; prompt.classList.remove("hidden"); }
    else { prompt.classList.add("hidden"); }
}

/* =========================================================================
   INPUT
   ========================================================================= */
function bindInput() {
    document.addEventListener("keydown", (e) => {
        keys[e.key] = true;
        const k = e.key.toLowerCase();
        if (k === "a") input.left = true;
        if (k === "d") input.right = true;
        if (k === " " || k === "w") { if (!jumpHeld) { input.jump = true; jumpHeld = true; } e.preventDefault(); }
        if (k === "arrowup") { if (!jumpHeld) { input.jump = true; jumpHeld = true; } e.preventDefault(); }
        if (k === "e") interactInFront();
        // number keys select hotbar
        const num = parseInt(e.key);
        if (num >= 1 && num <= HOTBAR_DEF.length) { selectedSlot = num - 1; renderHotbar(); }
        if (k === "i") toggleModalIcon("overlay-inventory");
        if (k === "f5") { e.preventDefault(); saveToStorage(); }
    });
    document.addEventListener("keyup", (e) => {
        keys[e.key] = false;
        const k = e.key.toLowerCase();
        if (k === "a") input.left = false;
        if (k === "d") input.right = false;
        if (k === " " || k === "w") jumpHeld = false;
        if (k === "arrowup") jumpHeld = false;
    });

    // Mouse position
    canvas.addEventListener("mousemove", (e) => {
        mouse.x = e.offsetX;
        mouse.y = e.offsetY;
    });
    canvas.addEventListener("mousedown", (e) => {
        mouse.x = e.offsetX;
        mouse.y = e.offsetY;
        interactAt(cam, e.button === 0);
        if (e.button !== 0) e.preventDefault();
    });
    // Prevent context menu
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Wheel to change hotbar
    window.addEventListener("wheel", (e) => {
        selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR_DEF.length) % HOTBAR_DEF.length;
        renderHotbar();
    });

    // UI buttons
    $("btnInventory").onclick = () => { renderInventory(); toggleIconModal("overlay-inventory"); };
    $("btnPets").onclick = () => { renderPets(); toggleIconModal("overlay-pets"); };
    $("btnUpgrades").onclick = () => { renderUpgradeList(); toggleIconModal("overlay-upgrades"); };
    $("btnSave").onclick = saveToStorage;

    // close buttons
    document.querySelectorAll("[data-close]").forEach((btn) => {
        btn.onclick = () => closeModal(btn.dataset.close);
    });
    // overlay bg click closes (except welcome/reward/reset)
    document.querySelectorAll(".overlay").forEach((o) => {
        o.addEventListener("mousedown", (e) => {
            if (e.target === o && o.id !== "overlay-welcome" && o.id !== "overlay-reward" && o.id !== "overlay-reset") closeModal(o.id);
        });
    });

    // exchange
    $("exInc").onclick = () => { $("exAmount").value = (parseInt($("exAmount").value)||1) + 1; };
    $("exDec").onclick = () => { $("exAmount").value = Math.max(1, (parseInt($("exAmount").value)||1) - 1); };
    $("exConfirm").onclick = doExchange;

    // monster
    $("feedGearBtn").onclick = () => feedMonster("gear");
    $("feedFoodBtn").onclick = () => feedMonster("food");

    // reward
    $("rewardOk").onclick = () => closeModal("overlay-reward");

    // welcome
    $("nameConfirm").onclick = () => {
        const nm = $("nameInput").value.trim() || "Farmer";
        state.name = nm;
        closeModal("overlay-welcome");
        saveToStorage();
        showToast("👋 Welcome, " + nm + "!");
    };

    // reset
    $("confirmReset").onclick = () => { resetGame(); closeAllModals(); renderHotbar(); updateHUD(); };

    window.addEventListener("resize", resize);
    window.addEventListener("blur", () => { input.left = input.right = false; });
}

function toggleModalIcon(id) {
    const el = $(id);
    if (el.classList.contains("hidden")) openModal(id); else closeModal(id);
}
function toggleIconModal(id) { toggleModalIcon(id); }

function interactInFront() {
    const p = state.player;
    const tx = Math.floor((p.x + p.dir * 30) / CONFIG.TILE);
    const ty = Math.floor((p.y + CONFIG.PLAYER_H / 2) / CONFIG.TILE);
    const id = getTile(tx, ty);
    if (isMonsterTile(tx, ty)) { openMonster(); return; }
    if (isMachineTile(tx, ty) || id === BLOCK.MACHINE) { openExchange(); return; }
    if (id === BLOCK.POTATO && isCropReady(tx, ty)) { harvestCrop(tx, ty); return; }
    placeSelected(tx, ty);
}

/* =========================================================================
   UTILITIES
   ========================================================================= */
function addItem(key, n) {
    if (!state.inventory[key]) state.inventory[key] = 0;
    state.inventory[key] += n;
    if (state.inventory[key] <= 0) delete state.inventory[key];
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================================
   INIT
   ========================================================================= */
function init() {
    canvas = $("game-canvas");
    ctx = canvas.getContext("2d");
    resize();

    loadGame();
    bindInput();
    renderHotbar();
    updateHUD();

    // Always show welcome on first time (no save => newGame). If just loaded, hide.
    if (localStorage.getItem(SAVE_KEY)) { closeModal("overlay-welcome"); }
    else { $("nameInput").value = ""; openModal("overlay-welcome"); }

    requestAnimationFrame(gameLoop);
}

document.addEventListener("DOMContentLoaded", init);
