/* =========================================================================
   LandBlock - Main Game Logic
   All gameplay systems: farming, exchange, monster, pets, items, upgrades,
   saving. Pure vanilla JavaScript using localStorage.
   ========================================================================= */

/* =========================================================================
   CONFIGURATION (easy to modify)
   ========================================================================= */
const CONFIG = {
    // Growth time in milliseconds for a potato
    GROW_TIME: 30000, // 30 seconds

    // Exchange rate: X potatoes = 1 gear
    EXCHANGE_RATE: 100,

    // Starting amounts
    START_POTATOES: 50,
    START_GEARS: 0,
    START_SEEDS: 10,
    START_LOCKED_TILES: 2, // number of locked tiles the player must unlock

    // Monster: feeds required per level-up
    FEEDS_PER_LEVEL: 5,
    MONSTER_MAX_HUNGER: 100,
    ITEM_FOOD_PER_FEED_REWARD: 3, // reward multiplier for using item food

    // Reward chances (must sum to 100)
    REWARD_CHANCES: {
        common: 60,
        uncommon: 30,
        rare: 10
    },

    // Upgrade definitions
    UPGRADES: {
        fasterGrowth: {
            name: "Faster Growth",
            desc: "Reduces potato growth time by 10% per level.",
            icon: "⏩",
            maxLevel: 5,
            baseCost: 3,
            costGrowth: 2
        },
        betterHarvest: {
            name: "Better Harvest",
            desc: "Grants +1 extra potato per harvest per level.",
            icon: "🌾",
            maxLevel: 5,
            baseCost: 2,
            costGrowth: 2
        },
        largerFarm: {
            name: "Larger Farm",
            desc: "Unlocks 1 additional farm tile per level.",
            icon: "📐",
            maxLevel: 5,
            baseCost: 4,
            costGrowth: 3
        },
        monsterLuck: {
            name: "Monster Luck",
            desc: "Increases rare pet reward chance by 2% per level.",
            icon: "🍀",
            maxLevel: 5,
            baseCost: 5,
            costGrowth: 3
        }
    }
};

/* =========================================================================
   ITEM DEFINITIONS
   ========================================================================= */
const ITEMS = {
    seeds: { name: "Potato Seeds", desc: "Plant these on empty soil to grow potatoes.", icon: "🌱", rarity: "common" },
    potato: { name: "Potatoes", desc: "Your main farm resource.", icon: "🥔", rarity: "common" },
    gears: { name: "Gears", desc: "Premium currency for upgrades and feeding.", icon: "⚙️", rarity: "uncommon" },
    monsterFood: { name: "Monster Food", desc: "Special tasty food the monster loves.", icon: "🍖", rarity: "uncommon" },
    fertilizer: { name: "Fertilizer", desc: "Speeds up growth on a single tile.", icon: "🧪", rarity: "uncommon" },
    goldenShovel: { name: "Golden Shovel", desc: "Instantly grows one tile to full.", icon: "⛏️", rarity: "rare" },
    magicSeed: { name: "Magic Seed", desc: "Grows instantly when planted.", icon: "✨", rarity: "rare" },
    trophy: { name: "Golden Trophy", desc: "A rare collectible from the monster.", icon: "🏆", rarity: "legendary" }
};

/* =========================================================================
   PET DEFINITIONS
   ========================================================================= */
const PETS = {
    potatoBug: { name: "Potato Bug", rarity: "common", icon: "🐛", bonus: "extraHarvest", bonusValue: 1, desc: "+1 bonus potato per harvest" },
    tinySlime: { name: "Tiny Slime", rarity: "common", icon: "🫧", bonus: "fasterGrowth", bonusValue: 5, desc: "-5% growth time" },
    farmMouse: { name: "Farm Mouse", rarity: "common", icon: "🐭", bonus: "betterLuck", bonusValue: 1, desc: "+1% monster luck" },
    greenDragon: { name: "Green Dragon", rarity: "uncommon", icon: "🐉", bonus: "fasterGrowth", bonusValue: 10, desc: "-10% growth time" },
    rockTurtle: { name: "Rock Turtle", rarity: "uncommon", icon: "🐢", bonus: "extraHarvest", bonusValue: 2, desc: "+2 bonus potatoes per harvest" },
    goldenChicken: { name: "Golden Chicken", rarity: "uncommon", icon: "🐔", bonus: "gearBonus", bonusValue: 10, desc: "10% more gears on exchange" },
    shadowWolf: { name: "Shadow Wolf", rarity: "rare", icon: "🐺", bonus: "betterLuck", bonusValue: 3, desc: "+3% monster luck" },
    crystalFox: { name: "Crystal Fox", rarity: "rare", icon: "🦊", bonus: "fasterGrowth", bonusValue: 20, desc: "-20% growth time" },
    babyMonster: { name: "Baby Monster", rarity: "rare", icon: "👹", bonus: "extraHarvest", bonusValue: 3, desc: "+3 bonus potatoes per harvest" }
};

/* =========================================================================
   RARITY POOL (for rewards)
   ========================================================================= */
const RARITY_POOL = {
    common: ["potatoBug", "tinySlime", "farmMouse"],
    uncommon: ["greenDragon", "rockTurtle", "goldenChicken"],
    rare: ["shadowWolf", "crystalFox", "babyMonster"]
};

/* =========================================================================
   DEFAULT GAME STATE
   ========================================================================= */
function defaultState() {
    const totalTiles = 12; // base tiles in the grid
    return {
        playerName: "Farmer",
        landName: "~ My Little Farm ~",
        potatoes: CONFIG.START_POTATOES,
        gears: CONFIG.START_GEARS,
        seeds: CONFIG.START_SEEDS,
        monsterFood: 0,
        tiles: [],
        inventory: {},
        pets: [],
        activePet: null,
        monster: {
            hunger: CONFIG.MONSTER_MAX_HUNGER,
            level: 1,
            growth: 0,
            feeds: 0
        },
        upgrades: {
            fasterGrowth: 0,
            betterHarvest: 0,
            largerFarm: 0,
            monsterLuck: 0
        }
    };
}

function createDefaultTiles() {
    const tiles = [];
    for (let i = 0; i < 12; i++) {
        // First 2 tiles locked by default; others start as empty soil
        tiles.push({
            id: i,
            state: "empty", // empty | growing | ready
            stage: 0,       // 0=empty ... 4=grown
            growthStartTime: null,
            locked: i < CONFIG.START_LOCKED_TILES
        });
    }
    return tiles;
}

/* =========================================================================
   STATE MANAGEMENT
   ========================================================================= */
let state = null;

const SAVE_KEY = "landblock_save_v1";

function newGame() {
    state = defaultState();
    state.tiles = createDefaultTiles();
    state.inventory = { seeds: CONFIG.START_SEEDS };
}

function saveGame() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        toast("💾 Game saved!");
    } catch (e) {
        toast("⚠️ Could not save (storage full?)");
    }
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
        newGame();
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        // Merge with defaults to be safe across versions
        state = Object.assign(defaultState(), parsed);
        // Ensure tiles exist
        if (!state.tiles || state.tiles.length === 0) {
            state.tiles = createDefaultTiles();
        }
    } catch (e) {
        newGame();
    }
}

function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    newGame();
    renderAll();
    closeAllModals();
    toast("♻️ Game reset!");
}

/* =========================================================================
   DOM REFERENCES (cached)
   ========================================================================= */
const $ = (id) => document.getElementById(id);

/* =========================================================================
   FARMING SYSTEM
   ========================================================================= */

// Compute effective growth time based on upgrades + active pet
function getGrowthTime() {
    let time = CONFIG.GROW_TIME;
    const growthUp = state.upgrades.fasterGrowth;
    time *= (1 - growthUp * 0.10);
    const pet = getActivePet();
    if (pet && pet.bonus === "fasterGrowth") {
        time *= (1 - pet.bonusValue / 100);
    }
    return Math.max(1000, time);
}

// Extra harvest bonus from upgrades and pets
function getHarvestBonus() {
    let bonus = 0;
    bonus += state.upgrades.betterHarvest;
    const pet = getActivePet();
    if (pet && pet.bonus === "extraHarvest") {
        bonus += pet.bonusValue;
    }
    return bonus;
}

// Effective monster luck from upgrades + pet
function getMonsterLuckBonus() {
    let luck = 0;
    luck += state.upgrades.monsterLuck * 2; // 2% per level
    const pet = getActivePet();
    if (pet && pet.bonus === "betterLuck") {
        luck += pet.bonusValue;
    }
    return luck;
}

// Gear exchange multiplier from pet
function getGearBonus() {
    const pet = getActivePet();
    if (pet && pet.bonus === "gearBonus") {
        return 1 + pet.bonusValue / 100;
    }
    return 1;
}

function getActivePet() {
    if (!state.activePet) return null;
    return state.pets.find((p) => p.uid === state.activePet) || null;
}

// Render farm tiles
function renderFarm() {
    const grid = $("farmGrid");
    grid.innerHTML = "";

    const tileCount = CONFIG.START_LOCKED_TILES + state.tiles.length;
    // Build list of display tiles (include unlocked growth)
    state.tiles.forEach((tile) => {
        const div = document.createElement("div");
        div.className = "tile";
        div.dataset.id = tile.id;

        if (tile.locked) {
            div.classList.add("locked");
            div.textContent = "🔒";
            div.title = "Locked. Unlock with the Larger Farm upgrade.";
        } else {
            // Determine appearance by state/stage
            const face = getTileFace(tile);
            div.textContent = face.emoji;
            if (face.cls) {
                div.classList.add(face.cls);
            }
            if (tile.state === "ready") {
                div.classList.add("harvest-ready");
            }
            div.title = getTileTitle(tile);
            // Click to interact
            div.addEventListener("click", () => onTileClick(tile));
        }
        grid.appendChild(div);
    });

    // Render locked placeholder tiles for the larger farm slots not yet built
    // (tiles array may grow with largerFarm unlock; those are real tiles)
}

function getTileFace(tile) {
    // Returns emoji + optional css class for current stage
    switch (tile.state) {
        case "growing":
            switch (tile.stage) {
                case 1: return { emoji: "🌱", cls: "" };       // seed
                case 2: return { emoji: "🌿", cls: "" };       // small plant
                case 3: return { emoji: "🪴", cls: "" };       // growing plant
                default: return { emoji: "🌱", cls: "" };
            }
        case "ready":
            return { emoji: "🥔", cls: "harvest-ready" };      // fully grown
        case "empty":
        default:
            return { emoji: "", cls: "" };                      // empty soil
    }
}

function getTileTitle(tile) {
    if (tile.locked) return "Locked tile";
    switch (tile.state) {
        case "growing": return "Potato growing... (click to water? no, just wait)";
        case "ready": return "Harvest!";
        default: return "Click to plant";
    }
}

// Update a growing tile to its next visual stage based on progress
function updateTileStage(tile) {
    if (tile.state !== "growing") return;
    const elapsed = Date.now() - tile.growthStartTime;
    const total = getGrowthTime();
    const progress = Math.min(1, elapsed / total);
    tile.stage = Math.min(4, 1 + Math.floor(progress * 3)); // stages 1..4
    if (progress >= 1) {
        tile.state = "ready";
        tile.stage = 4;
    }
}

// Global tick: advance all growing tiles
function tickGrowth() {
    if (!state) return;
    state.tiles.forEach((tile) => {
        if (tile.locked) return;
        updateTileStage(tile);
    });
    renderFarm();
}

function onTileClick(tile) {
    if (tile.locked) {
        toast("🔒 This tile is locked!");
        return;
    }

    if (tile.state === "ready") {
        harvest(tile);
    } else if (tile.state === "empty") {
        plant(tile);
    } else {
        // Growing - show remaining time
        const elapsed = Date.now() - tile.growthStartTime;
        const total = getGrowthTime();
        const remain = Math.max(0, total - elapsed);
        toast("⏳ Growing... " + Math.ceil(remain / 1000) + "s left");
    }
}

function plant(tile) {
    if (state.seeds <= 0) {
        toast("🌱 No seeds! Check your inventory.");
        return;
    }
    state.seeds -= 1;
    tile.state = "growing";
    tile.stage = 1;
    tile.growthStartTime = Date.now();
    toast("🌱 Planted a potato!");
    renderAll();
}

function harvest(tile) {
    // Base potatoes + bonuses
    const base = 1;
    const bonus = getHarvestBonus();
    const amount = base + bonus;
    state.potatoes += amount;
    state.inventory.potato = state.potatoes;
    state.inventory.seeds = state.seeds;

    // Reset tile to empty
    tile.state = "empty";
    tile.stage = 0;
    tile.growthStartTime = null;

    // Visual feedback
    tile.harvestBurst = true;
    renderAll();
    burstEffect(tile.id);
    toast("🥔 +" + amount + " potatoes!");
}

/* =========================================================================
   BURST EFFECT
   ========================================================================= */
function burstEffect(tileId) {
    const tile = document.querySelector(`.tile[data-id="${tileId}"]`);
    if (!tile) return;
    tile.classList.add("burst");
    setTimeout(() => tile.classList.remove("burst"), 500);
}

/* =========================================================================
   GEAR EXCHANGE SYSTEM
   ========================================================================= */
function renderExchange() {
    $("exPotatoes").textContent = state.potatoes;
    $("exGears").textContent = state.gears;
    $("exRate").textContent = CONFIG.EXCHANGE_RATE;
    updateExAffordability();
}

function updateExAffordability() {
    const amount = parseInt($("exAmount").value) || 1;
    const cost = amount * CONFIG.EXCHANGE_RATE;
    $("exConfirm").disabled = state.potatoes < cost;
    $("exFeedback").textContent = "";
}

function doExchange() {
    const amount = parseInt($("exAmount").value) || 1;
    if (amount < 1) { $("exAmount").value = 1; return; }
    const cost = amount * CONFIG.EXCHANGE_RATE;
    if (state.potatoes < cost) {
        $("exFeedback").textContent = "Not enough potatoes!";
        $("exFeedback").className = "feedback error";
        return;
    }
    let gearsGained = Math.floor(amount * getGearBonus());
    state.potatoes -= cost;
    state.gears += gearsGained;
    state.inventory.potato = state.potatoes;
    state.inventory.gears = state.gears;
    $("exFeedback").textContent = "✨ +" + amount + " gears (pet bonus applied: +" + (gearsGained - amount) + ")";
    $("exFeedback").className = "feedback success";
    renderAll();
    renderExchange();
}

/* =========================================================================
   MONSTER SYSTEM
   ========================================================================= */
function renderMonster() {
    $("monsterLevel").textContent = state.monster.level;
    const hungerPct = Math.round((state.monster.hunger / CONFIG.MONSTER_MAX_HUNGER) * 100);
    $("hungerFill").style.width = hungerPct + "%";
    const growthProgress = state.monster.feeds % CONFIG.FEEDS_PER_LEVEL;
    const growthPct = (growthProgress / CONFIG.FEEDS_PER_LEVEL) * 100;
    $("monsterGrowthFill").style.width = growthPct + "%";
    $("feedMonsterTitle").textContent = "🍖 Feed " + $("monsterName").textContent;
}

/* =========================================================================
   MONSTER FEEDING
   ========================================================================= */
function feedMonster(type) {
    // type: "gear" or "item"
    if (state.monster.hunger <= 0) {
        toast("😴 The monster is full!");
        return;
    }
    if (type === "gear") {
        if (state.gears < 1) { toast("⚙️ Not enough gears!"); return; }
        state.gears -= 1;
        state.inventory.gears = state.gears;
    } else {
        if (state.monsterFood < 1) { toast("🍖 No monster food!"); return; }
        state.monsterFood -= 1;
        state.inventory.monsterFood = state.monsterFood;
    }

    // Feed effect
    $("monsterCard").classList.add("feeding");
    setTimeout(() => $("monsterCard").classList.remove("feeding"), 700);

    // Decrease hunger
    const hungerDrop = type === "item" ? 35 : 25;
    state.monster.hunger = Math.max(0, state.monster.hunger - hungerDrop);

    // Track feeds & level up
    state.monster.feeds += 1;
    if (state.monster.feeds % CONFIG.FEEDS_PER_LEVEL === 0) {
        state.monster.level += 1;
        toast("🎉 Monster leveled up to " + state.monster.level + "!");
    }

    // Grant a random reward
    const reward = rollReward();
    giveReward(reward);

    renderAll();
    renderMonster();
    saveGame();
}

/* =========================================================================
   REWARD SYSTEM
   ========================================================================= */
function rollReward() {
    // Adjust chances with monster luck
    const luckBonus = getMonsterLuckBonus();
    let rare = CONFIG.REWARD_CHANCES.rare + luckBonus;
    if (rare > 34) rare = 34;
    let uncommon = CONFIG.REWARD_CHANCES.uncommon;
    let common = 100 - rare - uncommon;
    if (common < 0) common = 0;

    const roll = Math.random() * 100;
    if (roll < common) return { tier: "common" };
    if (roll < common + uncommon) return { tier: "uncommon" };
    return { tier: "rare" };
}

// Build the actual reward content based on tier
function buildReward(tier) {
    const commonPool = [
        { type: "potatoes", amount: rand(5, 12), text: "Potatoes" },
        { type: "seeds", amount: rand(2, 5), text: "Potato Seeds" },
        { type: "monsterFood", amount: rand(1, 2), text: "Monster Food" }
    ];
    const uncommonPool = [
        { type: "fertilizer", amount: 1, text: "Fertilizer" },
        { type: "seeds", amount: rand(5, 10), text: "Potato Seeds" },
        { type: "gears", amount: rand(2, 5), text: "Gears" },
        { type: "monsterFood", amount: 2, text: "Monster Food" }
    ];
    const rarePool = [
        { type: "pet", petId: pick(RARITY_POOL.rare), text: "Rare Pet" },
        { type: "goldenShovel", amount: 1, text: "Golden Shovel" },
        { type: "magicSeed", amount: 1, text: "Magic Seed" },
        { type: "pet", petId: pick(RARITY_POOL.uncommon), text: "Uncommon Pet" }
    ];

    let chosen;
    if (tier === "rare") chosen = pick(rarePool);
    else if (tier === "uncommon") chosen = pick(uncommonPool);
    else chosen = pick(commonPool);

    return Object.assign({ tier }, chosen);
}

function giveReward(reward) {
    switch (reward.type) {
        case "potatoes":
            state.potatoes += reward.amount;
            state.inventory.potato = state.potatoes;
            showReward("🥔", reward.tier, "Potatoes", "+" + reward.amount + " potatoes");
            break;
        case "seeds":
            state.seeds += reward.amount;
            state.inventory.seeds = state.seeds;
            showReward("🌱", reward.tier, "Potato Seeds", "+" + reward.amount + " seeds");
            break;
        case "monsterFood":
            state.monsterFood += reward.amount;
            state.inventory.monsterFood = state.monsterFood;
            showReward("🍖", reward.tier, "Monster Food", "+" + reward.amount + " monster food");
            break;
        case "gears":
            state.gears += reward.amount;
            state.inventory.gears = state.gears;
            showReward("⚙️", reward.tier, "Gears", "+" + reward.amount + " gears");
            break;
        case "fertilizer":
            addItem("fertilizer", reward.amount || 1);
            showReward("🧪", reward.tier, "Fertilizer", "+1 fertilizer");
            break;
        case "goldenShovel":
            addItem("goldenShovel", 1);
            showReward("⛏️", reward.tier, "Golden Shovel", "+1 golden shovel");
            break;
        case "magicSeed":
            addItem("magicSeed", 1);
            showReward("✨", reward.tier, "Magic Seed", "+1 magic seed");
            break;
        case "pet":
            const pet = addPet(reward.petId);
            showReward(pet.icon, reward.tier, pet.name, "New pet obtained!");
            break;
        default:
            break;
    }
}

function addItem(itemKey, amount) {
    if (!state.inventory[itemKey]) state.inventory[itemKey] = 0;
    state.inventory[itemKey] += amount;
}

function addPet(petId) {
    const def = PETS[petId];
    const pet = {
        uid: petId + "_" + Date.now(),
        id: petId,
        name: def.name,
        rarity: def.rarity,
        icon: def.icon,
        level: 1,
        exp: 0,
        bonus: def.bonus,
        bonusValue: def.bonusValue,
        desc: def.desc
    };
    state.pets.push(pet);
    return pet;
}

/* =========================================================================
   REWARD POPUP + CONFETTI
   ========================================================================= */
function showReward(icon, tier, title, text) {
    $("rewardGraphic").textContent = icon;
    $("rewardTitle").textContent = title;
    $("rewardText").innerHTML =
        '<span class="rarity rarity-' + tier + '">' + tier.toUpperCase() + '</span><span class="big">' + text + '</span>';
    openModal("rewardOverlay");
    launchConfetti();
}

/* =========================================================================
   PET SYSTEM
   ========================================================================= */
function setActivePet(uid) {
    state.activePet = uid;
    renderAll();
    renderPets();
    toast("🐾 Pet selected!");
}

function gainPetExp(pet, amt) {
    pet.exp += amt;
    if (pet.exp >= pet.level * 10) {
        pet.exp = 0;
        pet.level += 1;
        toast(pet.name + " leveled up to " + pet.level + "!");
    }
}

function renderPets() {
    const list = $("petList");
    list.innerHTML = "";
    $("topPetName").textContent = "None";

    if (state.pets.length === 0) {
        list.innerHTML = '<div class="empty-msg">No pets yet. Feed the monster to find some!</div>';
        return;
    }

    const active = getActivePet();
    if (active) $("topPetName").textContent = active.name;

    state.pets.forEach((pet) => {
        const card = document.createElement("div");
        card.className = "pet-card" + (state.activePet === pet.uid ? " active-pet" : "");
        card.innerHTML =
            '<span class="pet-icon">' + pet.icon + '</span>' +
            '<div>' +
                '<div class="pet-name">' + pet.name + ' <span class="rarity rarity-' + pet.rarity + '">' + pet.rarity.toUpperCase() + '</span></div>' +
                '<div class="pet-meta">Lv <span class="pet-lvl">' + pet.level + '</span> · Exp <span class="pet-exp">' + pet.exp + '</span></div>' +
                '<div class="pet-bonus">' + pet.desc + '</div>' +
            '</div>';
        const btn = document.createElement("button");
        btn.className = "btn btn-activate";
        btn.textContent = state.activePet === pet.uid ? "Active" : "Activate";
        if (state.activePet !== pet.uid) {
            btn.addEventListener("click", () => setActivePet(pet.uid));
        } else {
            btn.disabled = true;
        }
        card.appendChild(btn);
        list.appendChild(card);
    });
}

/* =========================================================================
   INVENTORY SYSTEM
   ========================================================================= */
function renderInventory() {
    const list = $("inventoryList");
    list.innerHTML = "";

    // Build inventory display from live state + extra items
    const inv = {
        seeds: state.seeds,
        potato: state.potatoes,
        gears: state.gears,
        monsterFood: state.monsterFood
    };
    // Add any special items already stored
    ["fertilizer", "goldenShovel", "magicSeed", "trophy"].forEach((k) => {
        if (state.inventory[k]) inv[k] = state.inventory[k];
    });

    const entries = Object.entries(inv).filter(([k, v]) => v > 0);
    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-msg">Your inventory is empty.</div>';
        return;
    }

    entries.forEach(([key, count]) => {
        const def = ITEMS[key];
        if (!def) return;
        const item = document.createElement("div");
        item.className = "inv-item";
        item.innerHTML =
            '<span class="item-icon">' + def.icon + '</span>' +
            '<div>' +
                '<span class="item-name">' + def.name + '</span> <span class="rarity rarity-' + def.rarity + '">' + def.rarity.toUpperCase() + '</span>' +
                '<div class="item-desc">' + def.desc + '</div>' +
            '</div>' +
            '<span class="item-count">×' + count + '</span>';
        list.appendChild(item);
    });
}

/* =========================================================================
   UPGRADES SYSTEM
   ========================================================================= */
function renderUpgrades() {
    const list = $("upgradeList");
    list.innerHTML = "";

    Object.entries(CONFIG.UPGRADES).forEach(([key, def]) => {
        const level = state.upgrades[key];
        const maxed = level >= def.maxLevel;
        const cost = maxed ? 0 : def.baseCost + level * def.costGrowth;

        const card = document.createElement("div");
        card.className = "upgrade-card" + (maxed ? " maxed" : "");
        card.innerHTML =
            '<div class="up-name">' + def.icon + ' ' + def.name + ' <span class="rarity rarity-' + (maxed ? "legendary" : "uncommon") + '">' + level + '/' + def.maxLevel + '</span></div>' +
            '<div class="up-desc">' + def.desc + '</div>' +
            '<div class="up-actions">' +
                '<span class="up-level">Lv ' + level + '</span>' +
                (maxed
                    ? '<span class="up-price" style="color:var(--gem-green)">MAXED</span>'
                    : '<span class="up-price">⚙️ Cost: ' + cost + '</span>') +
                '<button class="btn btn-small" data-up="' + key + '" ' + (maxed ? "disabled" : "") + '>Buy</button>' +
            '</div>';
        list.appendChild(card);
    });

    // Bind buy buttons
    list.querySelectorAll("[data-up]").forEach((btn) => {
        btn.addEventListener("click", () => buyUpgrade(btn.dataset.up));
    });
}

function buyUpgrade(key) {
    const def = CONFIG.UPGRADES[key];
    const level = state.upgrades[key];
    if (level >= def.maxLevel) return;
    const cost = def.baseCost + level * def.costGrowth;
    if (state.gears < cost) {
        toast("⚙️ Not enough gears!");
        return;
    }
    state.gears -= cost;
    state.upgrades[key] += 1;
    state.inventory.gears = state.gears;

    // If larger farm, unlock a tile
    if (key === "largerFarm") {
        unlockTile();
    }

    toast("🚀 " + def.name + " upgraded!");
    renderAll();
    renderUpgrades();
    saveGame();
}

function unlockTile() {
    // Find the first locked tile and unlock it
    const locked = state.tiles.find((t) => t.locked);
    if (locked) {
        locked.locked = false;
        locked.state = "empty";
        locked.stage = 0;
    } else {
        // Add a brand-new tile beyond initial set
        state.tiles.push({
            id: state.tiles.length,
            state: "empty",
            stage: 0,
            growthStartTime: null,
            locked: false
        });
    }
}

/* =========================================================================
   MODAL MANAGEMENT
   ========================================================================= */
function openModal(id) {
    $(id).classList.remove("hidden");
    if (id === "inventoryOverlay") renderInventory();
    if (id === "petsOverlay") renderPets();
    if (id === "upgradesOverlay") renderUpgrades();
    if (id === "exchangeOverlay") renderExchange();
    if (id === "feedOverlay") renderFeed();
}

function closeModal(id) {
    $(id).classList.add("hidden");
}

function closeAllModals() {
    document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
}

function toggleModal(id) {
    if ($(id).classList.contains("hidden")) openModal(id);
    else closeModal(id);
}

function renderFeed() {
    $("feedGearBtn").disabled = state.gears < 1;
    $("feedItemBtn").disabled = state.monsterFood < 1;
    $("feedFeedback").textContent = "";
    $("feedFeedback").className = "feedback";
    renderMonster();
}

/* =========================================================================
   TOAST NOTIFICATION
   ========================================================================= */
function toast(msg) {
    let toastEl = document.getElementById("toast");
    if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.id = "toast";
        toastEl.style.cssText =
            "position:fixed;top:70px;left:50%;transform:translateX(-50%);" +
            "background:rgba(20,22,25,0.95);color:#fff;padding:10px 20px;border-radius:20px;" +
            "z-index:200;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.4);" +
            "transition:opacity 0.3s ease;border:2px solid var(--gold);";
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => { toastEl.style.opacity = "0"; }, 1800);
}

function flashFeedback(id) {
    // small highlight on the save button, used for confirmation
}

/* =========================================================================
   CONFETTI HELPER
   ========================================================================= */
function launchConfetti() {
    const colors = ["#f6b93b", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6", "#e67e22"];
    for (let i = 0; i < 24; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti";
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = (Math.random() * 0.5) + "s";
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 2000);
    }
}

/* =========================================================================
   RANDOM HELPERS
   ========================================================================= */
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================================================================
   RENDER ALL
   ========================================================================= */
function renderAll() {
    if (!state) return;
    $("topPotatoes").textContent = state.potatoes;
    $("topGears").textContent = state.gears;
    $("playerNameStat").textContent = state.playerName;
    $("landName").textContent = "🌾 " + state.landName + " ~";
    renderFarm();
    renderMonster();
    renderTopPet();
}

function renderTopPet() {
    const pet = getActivePet();
    if (pet) {
        $("topPetName").textContent = pet.name;
        const icon = $("topPetBox").querySelector(".pet-icon");
        if (icon) icon.textContent = pet.icon;
    } else {
        $("topPetName").textContent = "None";
    }
}

function renderAllModalsOpen() {
    // re-render any open modals
    document.querySelectorAll(".overlay:not(.hidden)").forEach((o) => {
        if (o.id === "inventoryOverlay") renderInventory();
        if (o.id === "petsOverlay") renderPets();
        if (o.id === "upgradesOverlay") renderUpgrades();
        if (o.id === "exchangeOverlay") renderExchange();
    });
}

/* =========================================================================
   EVENT BINDINGS
   ========================================================================= */
function bindEvents() {
    // Close buttons
    document.querySelectorAll(".modal-close").forEach((btn) => {
        btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll("[data-close]").forEach((btn) => {
        if (btn.classList.contains("modal-close")) return; // already bound
        btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });

    // Nav buttons
    document.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => toggleModal(btn.dataset.modal));
    });

    // Overlay background click to close
    document.querySelectorAll(".overlay").forEach((o) => {
        o.addEventListener("click", (e) => {
            if (e.target === o) closeModal(o.id);
        });
    });

    // Exchange
    $("exInc").addEventListener("click", () => {
        const v = parseInt($("exAmount").value) || 1;
        $("exAmount").value = v + 1;
        updateExAffordability();
    });
    $("exDec").addEventListener("click", () => {
        const v = parseInt($("exAmount").value) || 1;
        $("exAmount").value = Math.max(1, v - 1);
        updateExAffordability();
    });
    $("exAmount").addEventListener("input", updateExAffordability);
    $("exConfirm").addEventListener("click", doExchange);

    // Monster
    $("monsterCard").addEventListener("click", () => openModal("feedOverlay"));
    $("feedMonsterBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        openModal("feedOverlay");
    });
    $("feedGearBtn").addEventListener("click", () => feedMonster("gear"));
    $("feedItemBtn").addEventListener("click", () => feedMonster("item"));

    // Reward
    $("rewardOk").addEventListener("click", () => closeModal("rewardOverlay"));

    // Save / Reset
    $("saveBtn").addEventListener("click", saveGame);
    $("resetBtn").addEventListener("click", () => openModal("resetOverlay"));
    $("confirmReset").addEventListener("click", resetGame);

    // Close reset modal on escape-like cancel handled by data-close buttons

    // Keyboard: Escape closes modals
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllModals();
    });
}

/* =========================================================================
   MAIN GAME TICK & INIT
   ========================================================================= */
function gameLoop() {
    // Advance growth every second
    tickGrowth();
}

function init() {
    loadGame();
    bindEvents();
    renderAll();
    setInterval(gameLoop, 1000);
}

// Start the game when the page is ready
document.addEventListener("DOMContentLoaded", init);
