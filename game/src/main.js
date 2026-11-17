// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between four screens: title, play, paused and game
// over. The mouse steers the leader; holding the mouse or Shift boosts; C calls the
// scattered birds home.
//
// ?seed=N fixes the sky. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_DIVE, EVENT_GATHER, EVENT_GUST, EVENT_HAWK, EVENT_OVER, EVENT_PICKUP, EVENT_SCATTER, EVENT_WIN } from './world.js';
import { ACTION_CALL, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
// No seed given: the clock picks one, so every visit flies a different sky.
const seed = Number.isInteger(seedParam) ? seedParam : Date.now() % 4294967296;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let wasBoosting = false;
  // The steering target: the pointer sets it outright; the arrow keys nudge it.
  const target = { x: 420, y: 360 };

  // Sound starts on the first gesture, as the browser requires.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Guide the flock home.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = Math.floor(world.state.score);
      saveBest(best);
    }
    if (world.state.won) {
      audio.win();
      announce(`Home at last. Score ${Math.floor(world.state.score)}. Best ${best}.`);
    } else {
      audio.thud();
      announce(`The flock scattered. Score ${Math.floor(world.state.score)}. Best ${best}.`);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return Boolean(actions & ACTION_CALL);
  }

  function updateTarget(dt) {
    const pointer = input.pointer();
    if (pointer) {
      target.x = pointer.x;
      target.y = pointer.y;
      return;
    }
    const keys = input.keys();
    if (keys.x !== 0 || keys.y !== 0) {
      target.x = Math.min(900, Math.max(90, target.x + keys.x * 520 * dt));
      target.y = Math.min(610, Math.max(70, target.y + keys.y * 520 * dt));
    }
  }

  function step(dt, callRequested) {
    if (screen === SCREEN_TITLE) {
      const wander = {
        x: 300 + Math.sin(world.state.time * 0.5) * 110,
        y: 300 + Math.sin(world.state.time * 0.8) * 130,
      };
      world.step(STEP, wander, false, false, true);
      return;
    }
    const events = world.step(STEP, target, input.boosting(), callRequested);
    if (events & EVENT_PICKUP) audio.chirp();
    if (events & EVENT_GATHER) audio.gather();
    if (events & EVENT_HAWK) audio.screech();
    if (events & EVENT_DIVE) audio.diveScreech();
    if (events & EVENT_GUST) audio.whoosh();
    if (events & EVENT_SCATTER) audio.thud();
    if (world.state.boosting && !wasBoosting) audio.boostWhoosh();
    wasBoosting = world.state.boosting;
    audio.setWind(world.state.boosting ? 1 : 0.3);
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const callRequested = handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      updateTarget(dt);
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(STEP, callRequested);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting hawks strike unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Murmuration. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
