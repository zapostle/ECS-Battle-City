// Input System: Captures keyboard input and writes PlayerInput component
// Natural ordering: This runs first to provide input data for later systems

import { COMP, DIR } from '../Constants.js';

export function createInputSystem(keyState) {
    // keyState is an object managed externally: { up, down, left, right, shoot }
    return function InputSystem(world) {
        for (const entityId of world.getEntitiesWith(COMP.PLAYER_INPUT)) {
            const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
            input.dir = -1;
            input.shoot = false;

            if (keyState.up) input.dir = DIR.UP;
            else if (keyState.down) input.dir = DIR.DOWN;
            else if (keyState.left) input.dir = DIR.LEFT;
            else if (keyState.right) input.dir = DIR.RIGHT;

            if (keyState.shoot) input.shoot = true;
        }
    };
}

// Creates a keyState object
export function createKeyState() {
    return { up: false, down: false, left: false, right: false, shoot: false };
}

// Attaches keyboard listeners to a keyState object
export function setupKeyListeners(keyState) {
    const onKeyDown = (e) => {
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': keyState.up = true; break;
            case 'ArrowDown': case 'KeyS': keyState.down = true; break;
            case 'ArrowLeft': case 'KeyA': keyState.left = true; break;
            case 'ArrowRight': case 'KeyD': keyState.right = true; break;
            case 'Space': case 'KeyJ': keyState.shoot = true; break;
        }
    };
    const onKeyUp = (e) => {
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': keyState.up = false; break;
            case 'ArrowDown': case 'KeyS': keyState.down = false; break;
            case 'ArrowLeft': case 'KeyA': keyState.left = false; break;
            case 'ArrowRight': case 'KeyD': keyState.right = false; break;
            case 'Space': case 'KeyJ': keyState.shoot = false; break;
        }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    };
}
