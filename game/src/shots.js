// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot
// that dodges hawks, gathers what it can and calls the scattered home, so the frame
// is what a real game looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;

/** How far ahead, in pixels, the autopilot looks for a hawk it must dodge. */
const HAWK_LOOKAHEAD = 520;

/**
 * One autopilot decision: where to steer, whether to boost, whether to call.
 * It keeps the flock off a hawk's line, chases the nearest useful thing ahead,
 * and otherwise cruises the middle of the sky.
 */
function autopilot(state) {
  const leader = state.flock.leader;
  const time = state.time;
  let call = false;

  const strays = state.flock.birds.filter((bird) => bird.state === 'stray').length;
  if (strays > 0 && state.callCooldown <= 0 && state.energy >= 10) call = true;

  // A hawk closing on our height: climb or dive away from its line.
  for (const hawk of state.hawks) {
    if (hawk.x > leader.x - 40 && hawk.x < leader.x + HAWK_LOOKAHEAD) {
      const away = leader.y < hawk.y ? -1 : 1;
      return {
        target: { x: leader.x + 60, y: Math.min(600, Math.max(80, leader.y + away * 200)) },
        boost: false,
        call,
      };
    }
  }

  // The nearest thing worth gathering ahead of the leader.
  let pick = null;
  let pickDistance = Infinity;
  const consider = (x, y) => {
    if (x < leader.x - 40 || x > leader.x + 460) return;
    const distance = Math.hypot(x - leader.x, y - leader.y);
    if (distance < pickDistance) {
      pickDistance = distance;
      pick = { x, y };
    }
  };
  for (const fly of state.fireflies) consider(fly.x, fly.y);
  for (const stray of state.strays) consider(stray.x, stray.y);
  for (const up of state.updrafts) consider(up.x, up.y);

  const cruise = { x: leader.x + 140, y: 360 + Math.sin(time * 0.7) * 130 };
  const target = pick ?? cruise;
  const hawkNear = state.hawks.some((hawk) => hawk.x > leader.x - 40 && hawk.x < leader.x + 420);
  return { target, boost: state.energy > 65 && !hawkNear, call };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      const target = {
        x: 300 + Math.sin(state.time * 0.5) * 110,
        y: 300 + Math.sin(state.time * 0.8) * 130,
      };
      world.step(STEP, target, false, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  let events = 0;
  for (let index = 0; index < limit / STEP; index += 1) {
    const decision = autopilot(state);
    events = world.step(STEP, decision.target, decision.boost, decision.call);
    if (events & EVENT_OVER) break;
  }
  const over = state.over;
  return {
    screen: over ? SCREEN_OVER : SCREEN_PLAY,
    best: Math.floor(state.score),
    won: Boolean(events & EVENT_WIN),
  };
}
