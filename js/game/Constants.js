// Game Constants
export const TILE = 16;          // Tile size in game units (each tile = 16x16 pixels)
export const TILE_SIZE = 16;     // Display size of one tile
export const MAP_W = 26;         // Map width in tiles
export const MAP_H = 26;        // Map height in tiles (includes 2-row status bar at bottom)
export const GAME_W = MAP_W * TILE;  // 416
export const GAME_H = MAP_H * TILE;  // 416
export const PLAYER_SIZE = 14;
export const ENEMY_SIZE = 14;
export const BULLET_SIZE = 4;
export const PLAYER_SPEED = 1.2;
export const ENEMY_SPEED = 0.6;
export const BULLET_SPEED = 3;

// Directions
export const DIR = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

// Direction vectors [dx, dy]
export const DIR_VEC = {
    0: [0, -1],  // UP
    1: [1, 0],   // RIGHT
    2: [0, 1],   // DOWN
    3: [-1, 0]   // LEFT
};

// Tile types
export const TILE_EMPTY = 0;
export const TILE_BRICK = 1;
export const TILE_STEEL = 2;
export const TILE_WATER = 3;
export const TILE_GRASS = 4;
export const TILE_ICE = 5;
export const TILE_BASE = 6;     // Eagle/base
export const TILE_BASE_DEAD = 7;

// Tank types
export const TANK_PLAYER = 'player';
export const TANK_ENEMY = 'enemy';

// Tank render colors
export const TANK_COLORS = {
    player: '#FFD700',
    enemy1: '#C0C0C0',
    enemy2: '#FF6B6B',
    enemy3: '#32CD32',
    enemy4: '#87CEEB'
};

// Component type name constants
export const COMP = {
    POSITION: 'Position',
    DIRECTION: 'Direction',
    VELOCITY: 'Velocity',
    TANK_TYPE: 'TankType',
    HP: 'HP',
    COLLISION: 'Collision',
    BULLET: 'Bullet',
    DAMAGE_INFO: 'DamageInfo',
    SHOOT_COOLDOWN: 'ShootCooldown',
    SHOOT_REQUEST: 'ShootRequest',
    PLAYER_INPUT: 'PlayerInput',
    AI_CTRL: 'AIController',
    RENDER: 'Render',
    TILE: 'Tile',
    ANIMATION: 'Animation',
    DESTROYED: 'Destroyed',
    SPAWN_PROTECT: 'SpawnProtect',
    EXPLOSION: 'Explosion',
    POWERUP: 'PowerUp',
    SCORE: 'Score',
    STAGE: 'Stage',
    PLAYER_DATA: 'PlayerData',
};
