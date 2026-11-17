// The starling flock: one leader the player steers, and the birds around it. Each
// bird holds a slot in a slowly turning formation (a golden-angle spiral flattened
// into a murmuration blob), and a damped spring pulls it there, so the flock flows
// and ripples instead of marching in lockstep. A scattered bird waits at the edge
// of the sky, circling, until it is called back or lost for good.

import { FIELD, FLOCK, LEADER } from './config.js';
import { range } from './random.js';

/** The golden angle, so the formation slots never line up in rows. */
const GOLDEN_ANGLE = 2.399963229728653;

function makeBird(random, index, leader) {
  return {
    x: leader.x + range(random, -60, 60),
    y: leader.y + range(random, -40, 40),
    vx: 0,
    vy: 0,
    phase: random() * Math.PI * 2,
    slotSeed: index * GOLDEN_ANGLE,
    slotWobble: random() * Math.PI * 2,
    state: 'flock',
    strayTimer: 0,
    anchorX: 0,
    anchorY: 0,
  };
}

export function createFlock(random, startBirds) {
  const leader = { x: LEADER.startX, y: LEADER.startY, vx: 0, vy: 0 };
  const birds = [];
  for (let index = 0; index < startBirds; index += 1) birds.push(makeBird(random, index, leader));
  let total = startBirds;

  /** Where bird i wants to be, relative to the leader, at this moment. */
  function slotFor(bird, time) {
    const angle = bird.slotSeed + time * 0.32;
    const radius = 26 + (bird.slotSeed % 1) * 64 + 9 * Math.sin(time * 0.9 + bird.slotWobble);
    const spread = 0.8 + total * 0.012;
    return {
      x: leader.x + Math.cos(angle) * radius * spread,
      y: leader.y + Math.sin(angle) * radius * spread * 0.62,
    };
  }

  function steerBird(bird, target, dt, strength) {
    bird.vx += (target.x - bird.x) * strength * dt;
    bird.vy += (target.y - bird.y) * strength * dt;
    bird.vx *= Math.max(0, 1 - 5.2 * dt);
    bird.vy *= Math.max(0, 1 - 5.2 * dt);
    bird.x += bird.vx * dt;
    bird.y += bird.vy * dt;
  }

  return {
    leader,
    birds,

    /** Birds still alive: flying, returning, or scattered but recoverable. */
    get total() {
      return total;
    },

    /** Birds flying with the flock right now (the HUD number). */
    flyingCount() {
      let count = 0;
      for (const bird of birds) if (bird.state !== 'stray') count += 1;
      return count;
    },

    /** Steer the leader toward the target point; the birds follow their slots. */
    update(dt, target, time) {
      leader.vx += (target.x - leader.x) * 7 * dt;
      leader.vy += (target.y - leader.y) * 7 * dt;
      leader.vx *= Math.max(0, 1 - 3.4 * dt);
      leader.vy *= Math.max(0, 1 - 3.4 * dt);
      const speed = Math.hypot(leader.vx, leader.vy);
      if (speed > LEADER.maxSpeed) {
        leader.vx = (leader.vx / speed) * LEADER.maxSpeed;
        leader.vy = (leader.vy / speed) * LEADER.maxSpeed;
      }
      leader.x = Math.min(LEADER.maxX, Math.max(LEADER.minX, leader.x + leader.vx * dt));
      leader.y = Math.min(LEADER.maxY, Math.max(LEADER.minY, leader.y + leader.vy * dt));

      for (const bird of birds) {
        bird.phase += dt * (9 + Math.hypot(bird.vx, bird.vy) * 0.03);
        if (bird.state === 'flock') {
          steerBird(bird, slotFor(bird, time), dt, 42);
        } else if (bird.state === 'returning') {
          const slot = slotFor(bird, time);
          steerBird(bird, slot, dt, 90);
          if (Math.hypot(slot.x - bird.x, slot.y - bird.y) < 34) bird.state = 'flock';
        } else {
          // Stray: drift to its anchor at the edge and circle there, waiting.
          bird.strayTimer += dt;
          const orbit = bird.strayTimer * 2.4;
          const target = {
            x: bird.anchorX + Math.cos(orbit) * 20,
            y: bird.anchorY + Math.sin(orbit) * 14,
          };
          steerBird(bird, target, dt, 26);
        }
      }
    },

    /** Scatter up to maxCount flying birds near a point (a hawk strike). */
    scatterAt(x, y, radius, maxCount) {
      let scattered = 0;
      for (const bird of birds) {
        if (scattered >= maxCount) break;
        if (bird.state !== 'flock') continue;
        if (Math.hypot(bird.x - x, bird.y - y) > radius) continue;
        bird.state = 'stray';
        bird.strayTimer = 0;
        bird.anchorX = range(random, 30, 110);
        bird.anchorY = range(random, 80, 600);
        bird.vx = -140;
        bird.vy = range(random, -60, 60);
        scattered += 1;
      }
      return scattered;
    },

    /** Scatter the single flying bird nearest a point (a gust tearing one away). */
    scatterNearest(x, y) {
      let nearest = null;
      let nearestDistance = Infinity;
      for (const bird of birds) {
        if (bird.state !== 'flock') continue;
        const distance = Math.hypot(bird.x - x, bird.y - y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = bird;
        }
      }
      if (!nearest) return 0;
      nearest.state = 'stray';
      nearest.strayTimer = 0;
      nearest.anchorX = range(random, 30, 110);
      nearest.anchorY = range(random, 80, 600);
      nearest.vx = -160;
      nearest.vy = range(random, -80, 80);
      return 1;
    },

    /** Call every scattered bird home. Returns how many answered. */
    callBack() {
      let called = 0;
      for (const bird of birds) {
        if (bird.state === 'stray') {
          bird.state = 'returning';
          called += 1;
        }
      }
      return called;
    },

    /** A stray starling joins: it appears at the right edge and flies into formation. */
    addBird(random) {
      if (total >= FLOCK.maxBirds) return false;
      const bird = makeBird(random, birds.length, leader);
      bird.x = FIELD.width + 30;
      bird.y = range(random, 120, 560);
      bird.vx = -220;
      bird.state = 'returning';
      birds.push(bird);
      total += 1;
      return true;
    },

    /** Drop scattered birds whose wait ran out. Returns how many were lost. */
    removeLost() {
      let lost = 0;
      for (let index = birds.length - 1; index >= 0; index -= 1) {
        const bird = birds[index];
        if (bird.state === 'stray' && bird.strayTimer > FLOCK.straySeconds) {
          birds.splice(index, 1);
          total -= 1;
          lost += 1;
        }
      }
      return lost;
    },
  };
}
