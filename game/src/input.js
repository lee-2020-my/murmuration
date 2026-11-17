// Keyboard and pointer input for Murmuration. The mouse steers: the pointer is the
// leader's target, and holding the mouse button (or Shift) is the boost. One-shot
// presses (start, restart, pause, call, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CALL = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const BOOST = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CALL = new Set(['KeyC']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let actions = 0;
  let pointerX = null;
  let pointerY = null;
  let pointerBoost = false;
  let keyBoost = false;
  const keys = { left: false, right: false, up: false, down: false };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (BOOST.has(event.code)) keyBoost = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (CALL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CALL;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (BOOST.has(event.code)) keyBoost = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;
    keyBoost = false;
    pointerBoost = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    pointerX = point.x;
    pointerY = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    pointerX = point.x;
    pointerY = point.y;
    if (event.button === 0) {
      // A click starts or restarts the game, and holds the boost while down.
      actions |= ACTION_CONFIRM;
      pointerBoost = true;
    } else if (event.button === 2) {
      actions |= ACTION_CALL;
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button === 0) pointerBoost = false;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerBoost = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The steering target in logical coordinates, or null when the pointer never moved. */
    pointer() {
      return pointerX === null ? null : { x: pointerX, y: pointerY };
    },

    /** -1/0/1 on each axis from the held arrow or WASD keys. */
    keys() {
      return {
        x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
        y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
      };
    },

    boosting() {
      return keyBoost || pointerBoost;
    },

    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
