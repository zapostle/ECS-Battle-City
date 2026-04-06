// Component factory functions - Pure data containers (reference semantics)

// Position: x,y in game units
export function createPosition(x, y) {
    return { x: x || 0, y: y || 0 };
}

// Direction: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
export function createDirection(dir = 0) {
    return { dir };
}

// Velocity: speed + move flag
export function createVelocity() {
    return { speed: 0, moving: false };
}

// TankType: 'player' or 'enemy', with color info
export function createTankType(type, colorKey) {
    return { type, colorKey: colorKey || 'enemy1' };
}

// HP: hit points
export function createHP(hp) {
    return { hp, maxHp: hp };
}

// Collision: AABB half-size
export function createCollision(halfW, halfH, blockLevel = 1) {
    return { halfW: halfW || 7, halfH: halfH || 7, blockLevel };
}

// Bullet: marks entity as a bullet, stores owner and power
export function createBullet(ownerId, power = 1) {
    return { ownerId, power };
}

// DamageInfo: EVENT component - consumed once by DamageSystem
export function createDamageInfo(attackerId, damage, tags = []) {
    return { attackerId, damage, tags };
}

// ShootCooldown: frames until next shot
export function createShootCooldown(frames = 0, maxCooldown = 30) {
    return { cooldown: frames, maxCooldown };
}

// PlayerInput: desired move direction + shoot flag (set by InputSystem)
export function createPlayerInput() {
    return { dir: -1, shoot: false };
}

// AIController: enemy AI parameters
export function createAIController(behavior = 'patrol') {
    return {
        behavior,       // 'patrol' | 'chase' | 'guard'
        thinkTimer: 0,  // frames until next AI decision
        moveTimer: 0,   // frames remaining in current move action
        moveDir: 2,     // current AI movement direction
        shootChance: 0.02
    };
}

// Render: render info
export function createRender(type, color, zIndex = 0) {
    return { type, color, zIndex, flash: 0 };
}

// Tile: static map tile
export function createTile(tileType) {
    return { tileType };
}

// Animation: frame-based animation state
export function createAnimation(totalFrames, loop = true) {
    return { frame: 0, totalFrames, loop, timer: 0, done: false };
}

// Destroyed: marks entity for deferred removal
export function createDestroyed() {
    return {};
}

// SpawnProtect: invincibility frames after spawn
export function createSpawnProtect(frames = 120) {
    return { frames };
}

// Explosion: visual explosion effect
export function createExplosion(size = 1) {
    return { size, timer: 0, maxTimer: size === 1 ? 8 : 20 };
}

// PowerUp: power-up item on the map
export function createPowerUp(powerType) {
    return { powerType, timer: 600 }; // disappears after 600 frames
}

// Score: tracks score for the player
export function createScore() {
    return { value: 0, combo: 0 };
}

// Stage: game stage/level state
export function createStage(level) {
    return { level, state: 'playing', enemyCount: 0, enemiesSpawned: 0, maxEnemies: 20, spawnTimer: 0 };
}
