// The game state and its rules: the flight home. The flock flies right toward the
// roost; the world scrolls left under it. Distance falls with forward speed, hawks
// and gusts tear birds away, fireflies feed the boost, stray starlings join, and
// updrafts lift. Reach the roost with at least a handful of birds and the flock is
// home; lose too many and it scatters for good. All randomness comes from the one
// seeded generator, so the same seed always plays the same sky.

import {
  ENERGY,
  FIELD,
  FIREFLY,
  FLOCK,
  GUST,
  HAWK,
  LEADER,
  METRES_PER_PIXEL,
  RAMP,
  SCORE,
  SPEED,
  STRAY_BIRD,
  TRIP_METRES,
  UPDRAFT,
} from './config.js';
import { createFlock } from './flock.js';
import { createParticles } from './particles.js';
import { range } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_GATHER = 2;
export const EVENT_HAWK = 4;
export const EVENT_SCATTER = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_GUST = 64;
export const EVENT_DIVE = 128;

const HAWK_DODGE_POINTS = 10;

export function createWorld(random) {
  const state = {};
  reset();

  function reset() {
    state.random = random;
    state.time = 0;
    state.distance = TRIP_METRES;
    state.scrollPx = 0;
    state.score = 0;
    state.energy = ENERGY.max;
    state.boosting = false;
    state.callCooldown = 0;
    state.over = false;
    state.won = false;
    state.shake = 0;
    state.flash = 0;
    state.firefliesCaught = 0;
    state.birdsGathered = 0;
    state.hawksDodged = 0;
    state.birdsLost = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.particles = createParticles(random);
    state.hawkTimer = HAWK.firstAtSeconds;
    state.gustTimer = GUST.firstAtSeconds;
    state.fireflyTimer = 0.8;
    state.strayTimer = STRAY_BIRD.intervalSeconds * 0.6;
    state.updraftTimer = UPDRAFT.intervalSeconds * 0.5;
    state.hawks = [];
    state.gusts = [];
    state.fireflies = [];
    state.strays = [];
    state.updrafts = [];
    state.flock = createFlock(random, FLOCK.startBirds);
    state.clouds = [];
    for (let i = 0; i < 9; i += 1) {
      // The first four drift far away: slower, smaller, dimmer.
      const far = i < 4;
      state.clouds.push({
        x: range(random, 0, FIELD.width),
        y: range(random, 40, 420),
        scale: range(random, 0.6, 1.6) * (far ? 0.65 : 1),
        speed: range(random, 8, 22),
        drift: far ? 0.45 : 1,
        layer: far ? 0 : 1,
      });
    }
    state.stars = [];
    for (let i = 0; i < 80; i += 1) {
      state.stars.push({
        x: range(random, 0, FIELD.width),
        y: range(random, 0, 460),
        size: range(random, 0.6, 1.8),
        twinkle: range(random, 0, Math.PI * 2),
      });
    }
  }

  function spawnHawk() {
    const leader = state.flock.leader;
    const dive = state.time > HAWK.diveAfterSeconds && random() < HAWK.diveChance;
    if (dive) {
      // A diver hovers high at the edge, telegraphing its swoop, then drops.
      state.hawks.push({
        kind: 'dive',
        phase: 'hover',
        hoverTimer: HAWK.diveHoverSeconds,
        x: FIELD.width + 140,
        y: range(random, 60, 140),
        targetY: leader.y,
        warned: false,
        screeched: false,
        spent: false,
        nearMissed: false,
      });
      return;
    }
    state.hawks.push({
      kind: 'cruise',
      x: FIELD.width + 220,
      y: Math.min(600, Math.max(80, leader.y + range(random, -130, 130))),
      warned: false,
      screeched: false,
      spent: false,
      nearMissed: false,
    });
  }

  function spawnGust() {
    state.gusts.push({
      x: FIELD.width + 80,
      y: range(random, 120, 520),
      width: range(random, 190, 260),
      tearTimer: 0,
      // Half the gusts also shove the flock sideways, up or down.
      pushY: random() < GUST.sideChance ? range(random, -GUST.sidePushMax, GUST.sidePushMax) : 0,
    });
  }

  function spawnFirefly() {
    state.fireflies.push({
      x: FIELD.width + 30,
      y: range(random, 90, 590),
      phase: range(random, 0, Math.PI * 2),
    });
  }

  function spawnStray() {
    state.strays.push({
      x: FIELD.width + 40,
      y: range(random, 120, 560),
      phase: range(random, 0, Math.PI * 2),
    });
  }

  function spawnUpdraft() {
    state.updrafts.push({
      x: FIELD.width + 40,
      y: range(random, 140, 560),
      phase: range(random, 0, Math.PI * 2),
    });
  }

  /** One fixed step. steer is the leader's target point; demo runs the sky with no hazards. */
  function step(dt, steer, boosting, callRequested, demo = false) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
    if (state.callCooldown > 0) state.callCooldown -= dt;

    // The flock flies on even behind the title: a gentle wander, no hazards, no distance.
    if (demo) {
      state.flock.update(dt, steer, state.time);
      for (const cloud of state.clouds) {
        cloud.x -= cloud.speed * cloud.drift * dt;
        if (cloud.x < -220) {
          cloud.x = FIELD.width + 200;
          cloud.y = range(random, 40, 420);
        }
      }
      return 0;
    }

    const wantBoost = boosting && state.energy > 0;
    state.boosting = wantBoost;
    const speed = wantBoost ? SPEED.boost : SPEED.cruise;
    if (wantBoost) state.energy = Math.max(0, state.energy - ENERGY.boostDrainPerSecond * dt);
    else state.energy = Math.min(ENERGY.max, state.energy + ENERGY.regenPerSecond * dt);

    const metres = speed * METRES_PER_PIXEL * dt;
    state.distance = Math.max(0, state.distance - metres);
    state.scrollPx += speed * dt;
    state.score += metres / SCORE.metresPerPoint;

    // The firefly combo fades if nothing is caught in time.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    state.particles.update(dt, speed);

    if (callRequested && state.callCooldown <= 0 && state.energy >= ENERGY.callCost) {
      const called = state.flock.callBack();
      if (called > 0) {
        state.energy -= ENERGY.callCost;
        state.callCooldown = ENERGY.callCooldownSeconds;
      }
    }

    // Spawning. As the roost nears the sky gets busier: hawks and gusts come faster.
    const progress = 1 - state.distance / TRIP_METRES;
    state.hawkTimer -= dt;
    if (state.hawkTimer <= 0) {
      spawnHawk();
      const late = state.time > HAWK.lateAtSeconds;
      const base = late ? HAWK.intervalLateSeconds : HAWK.intervalSeconds;
      state.hawkTimer = base * (1 - RAMP.hawk * progress) * range(random, 0.85, 1.15);
    }
    state.gustTimer -= dt;
    if (state.gustTimer <= 0) {
      spawnGust();
      state.gustTimer = GUST.intervalSeconds * (1 - RAMP.gust * progress) * range(random, 0.85, 1.2);
    }
    state.fireflyTimer -= dt;
    if (state.fireflyTimer <= 0) {
      spawnFirefly();
      state.fireflyTimer = FIREFLY.intervalSeconds + range(random, 0, FIREFLY.intervalJitter);
    }
    state.strayTimer -= dt;
    if (state.strayTimer <= 0) {
      spawnStray();
      state.strayTimer = STRAY_BIRD.intervalSeconds * range(random, 0.9, 1.2);
    }
    state.updraftTimer -= dt;
    if (state.updraftTimer <= 0) {
      spawnUpdraft();
      state.updraftTimer = UPDRAFT.intervalSeconds * range(random, 0.85, 1.2);
    }

    // Hawks sweep in from the right, homing gently on the flock's height. A diver
    // hovers high first, then drops on the leader's line.
    const leader = state.flock.leader;
    for (let i = state.hawks.length - 1; i >= 0; i -= 1) {
      const hawk = state.hawks[i];
      const prevX = hawk.x;
      if (hawk.kind === 'dive') {
        if (hawk.phase === 'hover') {
          hawk.x -= 60 * dt;
          hawk.y += Math.sin(state.time * 3) * 14 * dt;
          hawk.hoverTimer -= dt;
          if (hawk.hoverTimer <= 0) {
            hawk.phase = 'swoop';
            hawk.targetY = leader.y;
            events |= EVENT_DIVE;
          }
        } else if (hawk.phase === 'swoop') {
          hawk.x -= HAWK.diveSpeed * dt;
          const dy = hawk.targetY - hawk.y;
          const stepY = Math.max(-HAWK.diveSpeed * 0.8 * dt, Math.min(HAWK.diveSpeed * 0.8 * dt, dy));
          hawk.y += stepY;
          if (hawk.x < leader.x + 40 || Math.abs(dy) < 30) hawk.phase = 'cruise';
        } else {
          hawk.x -= HAWK.speed * dt;
          const dy = leader.y - hawk.y;
          hawk.y += Math.max(-HAWK.homing * dt, Math.min(HAWK.homing * dt, dy));
        }
      } else {
        hawk.x -= HAWK.speed * dt;
        const dy = leader.y - hawk.y;
        hawk.y += Math.max(-HAWK.homing * dt, Math.min(HAWK.homing * dt, dy));
      }
      if (!hawk.screeched && hawk.x < FIELD.width) {
        hawk.screeched = true;
        events |= EVENT_HAWK;
      }
      // A hawk that slips past close without striking is a near miss: a jolt, no loss.
      if (!hawk.nearMissed && prevX > leader.x && hawk.x <= leader.x) {
        hawk.nearMissed = true;
        if (!hawk.spent && Math.abs(hawk.y - leader.y) < HAWK.nearMissRadius) {
          state.shake = Math.max(state.shake, HAWK.nearMissShake);
        }
      }
      if (!hawk.spent) {
        const scattered = state.flock.scatterAt(hawk.x, hawk.y, HAWK.scatterRadius, HAWK.maxScattered);
        if (scattered > 0) {
          hawk.spent = true;
          state.shake = 1;
          state.flash = 0.7;
          events |= EVENT_SCATTER;
        }
      }
      if (hawk.x < -90) {
        state.hawks.splice(i, 1);
        state.hawksDodged += 1;
        state.score += HAWK_DODGE_POINTS;
      }
    }

    // Gusts tear through and shove the flock.
    for (let i = state.gusts.length - 1; i >= 0; i -= 1) {
      const gust = state.gusts[i];
      gust.x -= GUST.speed * dt;
      const inside =
        leader.x > gust.x - 20 &&
        leader.x < gust.x + gust.width + 20 &&
        leader.y > gust.y - GUST.height / 2 &&
        leader.y < gust.y + GUST.height / 2;
      if (inside) {
        leader.x = Math.max(LEADER.minX, leader.x + GUST.pushX * dt);
        if (gust.pushY !== 0) {
          leader.y = Math.min(LEADER.maxY, Math.max(LEADER.minY, leader.y + gust.pushY * dt));
        }
        gust.tearTimer += dt;
        if (gust.tearTimer >= GUST.tearSeconds) {
          gust.tearTimer = 0;
          if (state.flock.scatterNearest(leader.x, leader.y) > 0) {
            state.shake = Math.max(state.shake, 0.5);
            events |= EVENT_GUST;
          }
        }
      }
      if (gust.x + gust.width < -40) state.gusts.splice(i, 1);
    }

    // Fireflies drift and bob; the leader gathers them.
    for (let i = state.fireflies.length - 1; i >= 0; i -= 1) {
      const fly = state.fireflies[i];
      fly.x -= FIREFLY.drift * dt;
      const y = fly.y + Math.sin(state.time * 2.2 + fly.phase) * 12;
      if (Math.hypot(leader.x - fly.x, leader.y - y) < FIREFLY.collectRadius) {
        state.fireflies.splice(i, 1);
        // Pickups close together build a combo: each one in the window pays more.
        state.combo = state.comboTimer > 0 ? Math.min(state.combo + 1, FIREFLY.comboMax) : 1;
        state.comboTimer = FIREFLY.comboWindowSeconds;
        state.score += FIREFLY.points * state.combo;
        state.energy = Math.min(ENERGY.max, state.energy + ENERGY.firefly);
        state.firefliesCaught += 1;
        state.particles.spark(fly.x, y);
        events |= EVENT_PICKUP;
        continue;
      }
      if (fly.x < -30) state.fireflies.splice(i, 1);
    }

    // A stray starling waits to be gathered.
    for (let i = state.strays.length - 1; i >= 0; i -= 1) {
      const stray = state.strays[i];
      stray.x -= 34 * dt;
      if (Math.hypot(leader.x - stray.x, leader.y - stray.y) < STRAY_BIRD.collectRadius) {
        state.strays.splice(i, 1);
        state.flock.addBird(random);
        state.score += STRAY_BIRD.points;
        state.birdsGathered += 1;
        state.particles.spark(stray.x, stray.y);
        events |= EVENT_GATHER;
        continue;
      }
      if (stray.x < -40) state.strays.splice(i, 1);
    }

    // Updraft rings lift and refill.
    for (let i = state.updrafts.length - 1; i >= 0; i -= 1) {
      const up = state.updrafts[i];
      up.x -= 62 * dt;
      if (Math.hypot(leader.x - up.x, leader.y - up.y) < UPDRAFT.collectRadius) {
        state.updrafts.splice(i, 1);
        state.score += UPDRAFT.points;
        state.energy = Math.min(ENERGY.max, state.energy + ENERGY.updraft);
        leader.vy -= UPDRAFT.lift;
        events |= EVENT_PICKUP;
        continue;
      }
      if (up.x < -80) state.updrafts.splice(i, 1);
    }

    for (const cloud of state.clouds) {
      cloud.x -= (cloud.speed * cloud.drift + speed * 0.12) * dt;
      if (cloud.x < -220) {
        cloud.x = FIELD.width + 200;
        cloud.y = range(random, 40, 420);
      }
    }

    // Feathers burst where birds were scattered or lost for good.
    for (const at of state.flock.scatteredFx) state.particles.feathers(at.x, at.y, 5);
    state.flock.scatteredFx.length = 0;

    state.flock.update(dt, steer, state.time);
    const lost = state.flock.removeLost();
    if (lost > 0) {
      state.birdsLost += lost;
      state.flash = Math.max(state.flash, 0.5);
      for (const at of state.flock.lostFx) state.particles.feathers(at.x, at.y, 8);
      events |= EVENT_SCATTER;
    }
    state.flock.lostFx.length = 0;

    if (state.distance <= 0) {
      state.over = true;
      state.won = true;
      state.score += SCORE.winBonus + SCORE.winPerBird * state.flock.flyingCount();
      return events | EVENT_WIN | EVENT_OVER;
    }
    if (state.flock.total < FLOCK.minBirds) {
      state.over = true;
      state.won = false;
      return events | EVENT_OVER;
    }
    return events;
  }

  return { state, reset, step };
}
