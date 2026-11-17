// Short-lived visual particles: feather bursts when a bird is lost, sparks when
// a firefly is caught or a stray joins. Purely visual — they never change the
// rules — but they are still driven by the game's seeded generator and the fixed
// step, so the same seed paints the same frame.

import { FIELD, PALETTE } from './config.js';
import { range } from './random.js';

const MAX_PARTICLES = 120;

export function createParticles(random) {
  const list = [];

  function add(particle) {
    if (list.length >= MAX_PARTICLES) list.shift();
    list.push(particle);
  }

  return {
    get count() {
      return list.length;
    },

    /** A burst of dark feathers where a bird was torn away. */
    feathers(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        add({
          kind: 'feather',
          x: x + range(random, -8, 8),
          y: y + range(random, -8, 8),
          vx: range(random, -160, -40),
          vy: range(random, -70, 60),
          rot: range(random, 0, Math.PI * 2),
          vr: range(random, -6, 6),
          size: range(random, 4, 8),
          life: 0,
          maxLife: range(random, 0.7, 1.3),
        });
      }
    },

    /** A warm spark where something was gathered. */
    spark(x, y) {
      for (let i = 0; i < 6; i += 1) {
        add({
          kind: 'spark',
          x: x + range(random, -6, 6),
          y: y + range(random, -6, 6),
          vx: range(random, -90, 90),
          vy: range(random, -90, 90),
          rot: 0,
          vr: 0,
          size: range(random, 2, 4),
          life: 0,
          maxLife: range(random, 0.3, 0.55),
        });
      }
    },

    /** Advance every particle one fixed step; the world scrolls under them. */
    update(dt, scrollSpeed) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          list.splice(i, 1);
          continue;
        }
        p.x += (p.vx - scrollSpeed * 0.35) * dt;
        p.y += p.vy * dt;
        if (p.kind === 'feather') {
          p.vy += 130 * dt;
          p.vx *= Math.max(0, 1 - 1.4 * dt);
          p.rot += p.vr * dt;
        } else {
          p.vx *= Math.max(0, 1 - 3 * dt);
          p.vy *= Math.max(0, 1 - 3 * dt);
        }
        if (p.x < -20 || p.y > FIELD.height + 20) list.splice(i, 1);
      }
    },

    draw(ctx) {
      for (const p of list) {
        const fade = 1 - p.life / p.maxLife;
        if (p.kind === 'feather') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = 0.85 * fade;
          ctx.fillStyle = PALETTE.feather;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = PALETTE.birdRim;
          ctx.globalAlpha = 0.5 * fade;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, Math.PI * 0.9, Math.PI * 1.6);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.globalAlpha = fade;
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
          glow.addColorStop(0, 'rgba(255, 224, 102, 0.9)');
          glow.addColorStop(1, 'rgba(255, 224, 102, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
