// Everything Murmuration shows: a dusk sky that deepens as the roost nears, the
// scrolling hills and treeline, the oak that grows on the horizon, the flock itself,
// hawks, gusts, fireflies and the HUD. All drawing is plain Canvas 2D, no images.

import { ENERGY, FIELD, FIREFLY, FONT, GUST, PALETTE, TRIP_METRES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function lerpColor(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mix = a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 0;

  function fit() {
    const next = Math.min(window.devicePixelRatio || 1, 2);
    if (next !== dpr) {
      dpr = next;
      canvas.width = FIELD.width * dpr;
      canvas.height = FIELD.height * dpr;
    }
  }

  function drawSky(state) {
    const progress = 1 - state.distance / TRIP_METRES;
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, lerpColor(PALETTE.skyTopStart, PALETTE.skyTopEnd, progress));
    gradient.addColorStop(0.55, lerpColor(PALETTE.skyMidStart, PALETTE.skyMidEnd, progress));
    gradient.addColorStop(1, lerpColor(PALETTE.skyBottomStart, PALETTE.skyBottomEnd, progress));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // The setting sun sinks as the roost nears; the moon rises in its place.
    const sunY = 250 + progress * 330;
    if (progress < 0.85) {
      ctx.globalAlpha = clamp(1.15 - progress, 0, 1);
      ctx.fillStyle = PALETTE.sun;
      ctx.beginPath();
      ctx.arc(210, sunY, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25 * (1 - progress);
      ctx.beginPath();
      ctx.arc(210, sunY, 74, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (progress > 0.25) {
      ctx.globalAlpha = clamp((progress - 0.25) / 0.6, 0, 0.95);
      ctx.fillStyle = PALETTE.moon;
      ctx.beginPath();
      ctx.arc(1050, 520 - progress * 380, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Stars fade in with the dark.
    const starAlpha = clamp((progress - 0.35) / 0.6, 0, 1);
    if (starAlpha > 0) {
      ctx.fillStyle = '#ffffff';
      for (const star of state.stars) {
        ctx.globalAlpha = starAlpha * (0.45 + 0.55 * Math.abs(Math.sin(state.time * 1.4 + star.twinkle)));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Two cloud layers: the far ones drift slow and faint, the near ones full size.
    for (const layer of [0, 1]) {
      for (const cloud of state.clouds) {
        if (cloud.layer !== layer) continue;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = layer === 0 ? 0.05 : 0.10 + 0.05 * Math.sin(cloud.scale * 5);
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, 90 * cloud.scale, 20 * cloud.scale, 0, 0, Math.PI * 2);
        ctx.ellipse(cloud.x + 52 * cloud.scale, cloud.y + 8, 60 * cloud.scale, 15 * cloud.scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHills(state) {
    const layers = [
      { factor: 0.12, base: 572, amp: 34, colour: PALETTE.hillFarther },
      { factor: 0.25, base: 600, amp: 26, colour: PALETTE.hillFar },
      { factor: 0.55, base: 632, amp: 20, colour: PALETTE.hillNear },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.colour;
      ctx.beginPath();
      ctx.moveTo(0, FIELD.height);
      for (let x = 0; x <= FIELD.width; x += 16) {
        const scroll = state.scrollPx * layer.factor;
        const y =
          layer.base +
          Math.sin((x + scroll) * 0.004) * layer.amp +
          Math.sin((x + scroll) * 0.011 + 2) * layer.amp * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(FIELD.width, FIELD.height);
      ctx.closePath();
      ctx.fill();
    }
    // The treeline along the bottom.
    ctx.fillStyle = PALETTE.treeLine;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    const scroll = state.scrollPx;
    for (let x = 0; x <= FIELD.width; x += 26) {
      const h = 14 + 10 * Math.abs(Math.sin((x + scroll) * 0.021)) + 8 * Math.abs(Math.sin((x + scroll) * 0.047 + 1));
      ctx.lineTo(x, FIELD.skyBottom - h);
      ctx.lineTo(x + 13, FIELD.skyBottom - h - 12);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }

  /** The roost oak, growing on the right as the distance falls. */
  function drawOak(state) {
    if (state.distance > 480 && !state.won) return;
    const oakX = FIELD.width + 60 - (480 - Math.max(0, state.distance)) * 2.1;
    const scale = 0.7 + (480 - Math.max(0, state.distance)) / 480 * 0.7;
    ctx.save();
    ctx.translate(oakX, FIELD.skyBottom + 6);
    ctx.scale(scale, scale);
    // Warm glow behind the tree.
    const glow = ctx.createRadialGradient(0, -190, 10, 0, -190, 260);
    glow.addColorStop(0, 'rgba(242, 163, 94, 0.30)');
    glow.addColorStop(1, 'rgba(242, 163, 94, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -190, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.oak;
    ctx.fillStyle = PALETTE.oak;
    ctx.lineCap = 'round';
    // Trunk.
    ctx.beginPath();
    ctx.moveTo(-16, 10);
    ctx.quadraticCurveTo(-12, -90, -6, -170);
    ctx.lineTo(8, -170);
    ctx.quadraticCurveTo(14, -90, 18, 10);
    ctx.closePath();
    ctx.fill();
    // Branches: a wider crown than before, reaching both ways.
    const branches = [
      [-4, -160, -90, -230, -150, -260],
      [4, -165, 70, -240, 130, -270],
      [-2, -150, -40, -210, -70, -280],
      [6, -155, 50, -200, 90, -250],
      [0, -170, 0, -240, -12, -300],
      [-6, -140, -120, -190, -180, -210],
      [8, -145, 110, -185, 165, -205],
    ];
    ctx.lineWidth = 9;
    for (const [x1, y1, x2, y2, x3, y3] of branches) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x2, y2, x3, y3);
      ctx.stroke();
    }
    // Moss hanging from the low branches, swaying almost still.
    ctx.strokeStyle = '#2c2438';
    ctx.lineWidth = 2;
    for (const [x, y, len] of [[-120, -196, 26], [96, -192, 22], [-60, -218, 18], [140, -200, 24]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 3, y + len * 0.6, x - 2, y + len);
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.oak;
    // Canopy.
    const blobs = [
      [-120, -270, 62], [20, -290, 74], [120, -270, 58], [-40, -320, 66], [70, -320, 60], [0, -250, 70],
      [-170, -240, 44], [170, -240, 42],
    ];
    for (const [x, y, r] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // A warm rim on the sunset side of the crown, so the oak reads against the night.
    ctx.strokeStyle = PALETTE.oakRim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2.5;
    for (const [x, y, r] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r - 1, Math.PI * 0.75, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE.oak;
    // Nests tucked in the branches.
    ctx.fillStyle = '#2c1f16';
    for (const [x, y] of [[-58, -196], [52, -206], [4, -238]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Starlings already perched on the low branches, waiting for the flock.
    ctx.fillStyle = PALETTE.bird;
    for (const [x, y] of [[-118, -204], [94, -198], [-32, -222]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x - 9, y - 2);
      ctx.lineTo(x - 9, y + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBirdShape(x, y, heading, flap, size, rimAlpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(size, size);
    ctx.fillStyle = PALETTE.bird;
    // Body.
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail.
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-11, -2.4);
    ctx.lineTo(-11, 2.4);
    ctx.closePath();
    ctx.fill();
    // Wings: one above, one below, their tips riding the flap. The sweep is wide
    // so the beat reads even at a glance.
    const lift = Math.sin(flap);
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-6, -3 - 9 * lift);
    ctx.lineTo(2, -2 - 8 * lift);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-6, 3 + 9 * lift);
    ctx.lineTo(2, 2 + 8 * lift);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // A faint sheen along the back, so the body is not one flat blob.
    ctx.strokeStyle = PALETTE.birdRim;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(0, -0.5, 6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // A warm rim on the sunset side, so the birds read against the night sky.
    if (rimAlpha > 0) {
      ctx.strokeStyle = PALETTE.birdRim;
      ctx.globalAlpha = rimAlpha;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, 7, Math.PI * 0.9, Math.PI * 1.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawFlock(state) {
    const flock = state.flock;
    for (const bird of flock.birds) {
      const heading = Math.atan2(bird.vy, bird.vx);
      const clamped = Math.abs(bird.vx) + Math.abs(bird.vy) < 4 ? 0 : clamp(heading, -0.9, 0.9);
      drawBirdShape(bird.x, bird.y, clamped, bird.phase, 1, bird.state === 'stray' ? 0.55 : 0.3);
    }
    // The leader wears a stronger warm rim so the eye finds it.
    const leader = flock.leader;
    drawBirdShape(leader.x, leader.y, clamp(Math.atan2(leader.vy, leader.vx), -0.9, 0.9), state.time * 11, 1.35, 0.6);
  }

  function drawHawks(state) {
    for (const hawk of state.hawks) {
      if (hawk.x > FIELD.width) {
        // Warning marker at the edge before it sweeps in. A diver gets a
        // downward chevron as well: it is coming from above.
        ctx.fillStyle = PALETTE.danger;
        ctx.font = `bold 26px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', FIELD.width - 26, hawk.y);
        ctx.beginPath();
        ctx.moveTo(FIELD.width - 40, hawk.y + 12);
        ctx.lineTo(FIELD.width - 12, hawk.y + 12);
        ctx.lineTo(FIELD.width - 26, hawk.y + 26);
        ctx.closePath();
        ctx.fill();
        if (hawk.kind === 'dive') {
          ctx.beginPath();
          ctx.moveTo(FIELD.width - 38, hawk.y - 14);
          ctx.lineTo(FIELD.width - 14, hawk.y - 14);
          ctx.lineTo(FIELD.width - 26, hawk.y - 2);
          ctx.closePath();
          ctx.fill();
        }
        continue;
      }
      const diving = hawk.kind === 'dive' && hawk.phase === 'swoop';
      ctx.save();
      ctx.translate(hawk.x, hawk.y);
      // A swooping diver tilts down and folds its wings back; a cruiser glides level.
      ctx.rotate(diving ? 0.5 : 0.12);
      if (diving) {
        ctx.strokeStyle = PALETTE.hawk;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(24, 2);
        ctx.lineTo(52, -6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = PALETTE.hawk;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (diving) {
        // Wings swept back along the body.
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-20, -6);
        ctx.lineTo(-4, -3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-18, 7);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-16, -22);
        ctx.lineTo(4, -4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-14, 20);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-26, -5);
      ctx.lineTo(-26, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.hawkEye;
      ctx.beginPath();
      ctx.arc(-13, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGusts(state) {
    for (const gust of state.gusts) {
      ctx.strokeStyle = PALETTE.gust;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      // A gust that shoves sideways leans its streaks that way.
      const slant = (gust.pushY || 0) * 0.35;
      for (let i = 0; i < 5; i += 1) {
        const y = gust.y - GUST.height / 2 + ((i + 0.5) * GUST.height) / 5;
        ctx.beginPath();
        ctx.moveTo(gust.x + 20, y);
        ctx.lineTo(gust.x + gust.width - 20, y + 26 + slant);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFireflies(state) {
    for (const fly of state.fireflies) {
      const y = fly.y + Math.sin(state.time * 2.2 + fly.phase) * 12;
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 3.1 + fly.phase * 2);
      const glow = ctx.createRadialGradient(fly.x, y, 0, fly.x, y, 16 * pulse);
      glow.addColorStop(0, 'rgba(255, 224, 102, 0.85)');
      glow.addColorStop(1, 'rgba(255, 224, 102, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(fly.x, y, 16 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.firefly;
      ctx.beginPath();
      ctx.arc(fly.x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStrays(state) {
    for (const stray of state.strays) {
      const flap = state.time * 10 + stray.phase;
      drawBirdShape(stray.x, stray.y, 0, flap, 1.1, 0.55);
      const twinkle = 0.5 + 0.5 * Math.sin(state.time * 4 + stray.phase);
      ctx.strokeStyle = PALETTE.stray;
      ctx.globalAlpha = 0.4 + 0.6 * twinkle;
      ctx.lineWidth = 1.6;
      const x = stray.x;
      const y = stray.y - 26;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawUpdrafts(state) {
    for (const up of state.updrafts) {
      const pulse = 1 + 0.12 * Math.sin(state.time * 3 + up.phase);
      ctx.strokeStyle = PALETTE.updraft;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(up.x, up.y, 52 * pulse, 30 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(up.x, up.y, 34 * pulse, 19 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.updraft;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LIFT', up.x, up.y + 4);
    }
  }

  function drawHud(state) {
    const progress = 1 - state.distance / TRIP_METRES;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    panel(ctx, 16, 14, 208, 56);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('SCORE', 30, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(String(Math.floor(state.score)), 30, 60);

    // The firefly combo: quick pickups in a row pay a multiplier.
    if (state.combo >= 2) {
      ctx.fillStyle = PALETTE.combo;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(`x${state.combo} COMBO`, 30, 90);
      ctx.fillStyle = PALETTE.energyBack;
      ctx.beginPath();
      ctx.roundRect(30, 96, 120, 5, 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.combo;
      ctx.beginPath();
      ctx.roundRect(30, 96, Math.max(4, 120 * (state.comboTimer / FIREFLY.comboWindowSeconds)), 5, 2);
      ctx.fill();
    }

    panel(ctx, FIELD.width / 2 - 84, 14, 168, 56);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('FLOCK', FIELD.width / 2, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`${state.flock.flyingCount()} / ${state.flock.total}`, FIELD.width / 2, 60);
    ctx.textAlign = 'left';

    panel(ctx, FIELD.width - 270, 14, 254, 56);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('ROOST', FIELD.width - 256, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(state.distance)} m`, FIELD.width - 30, 58);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.energyBack;
    ctx.beginPath();
    ctx.roundRect(FIELD.width - 256, 44, 150, 8, 4);
    ctx.fill();
    ctx.fillStyle = PALETTE.energy;
    ctx.beginPath();
    ctx.roundRect(FIELD.width - 256, 44, Math.max(8, 150 * progress), 8, 4);
    ctx.fill();

    // Boost energy, bottom left.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('BOOST', 18, 668);
    ctx.fillStyle = PALETTE.energyBack;
    ctx.beginPath();
    ctx.roundRect(76, 656, 190, 14, 7);
    ctx.fill();
    ctx.fillStyle = state.energy < 25 ? PALETTE.danger : PALETTE.energy;
    ctx.beginPath();
    ctx.roundRect(76, 656, Math.max(6, 190 * (state.energy / ENERGY.max)), 14, 7);
    ctx.fill();

    // Call prompt, bottom centre, when birds are scattered.
    const strays = state.flock.birds.filter((bird) => bird.state === 'stray').length;
    if (strays > 0) {
      const pulse = 0.65 + 0.35 * Math.sin(state.time * 6);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = PALETTE.stray;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      const label =
        state.callCooldown > 0
          ? `CALL READY IN ${Math.ceil(state.callCooldown)}s — ${strays} BIRD${strays === 1 ? '' : 'S'} ADRIFT`
          : `PRESS C — CALL ${strays} SCATTERED BIRD${strays === 1 ? '' : 'S'} HOME`;
      ctx.fillText(label, FIELD.width / 2, 690);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('Mouse — steer · Hold — boost · C — call · P — pause · M — sound', FIELD.width - 16, 694);
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.42)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 88px ${FONT}`;
    ctx.fillText('MURMURATION', FIELD.width / 2, 218);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `22px ${FONT}`;
    ctx.fillText('Guide the flock home before nightfall', FIELD.width / 2, 262);

    panel(ctx, FIELD.width / 2 - 300, 300, 600, 168);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    const lines = [
      'Mouse — steer the leader · hold mouse or Shift — boost',
      'C or right-click — call scattered birds home',
      'Catch fireflies for boost · gather stray starlings',
      'Dodge the hawks · ride out the gusts · reach the oak',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 334 + i * 32));

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    if (best > 0) ctx.fillText(`Best score  ${best}`, FIELD.width / 2, 508);
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.firefly;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('Click or press Space to begin', FIELD.width / 2, 548);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText('Paused', FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText('Press P or Space to keep flying', FIELD.width / 2, 376);
    ctx.textAlign = 'left';
  }

  function drawOver(state, best) {
    const won = state.won;
    ctx.fillStyle = 'rgba(10, 8, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(ctx, FIELD.width / 2 - 290, 150, 580, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? PALETTE.firefly : PALETTE.danger;
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText(won ? 'Home at Last' : 'The Flock Scattered', FIELD.width / 2, 232);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(
      won ? 'Every bird that made it is roosting in the old oak.' : 'Too few birds are left to hold the flock together.',
      FIELD.width / 2,
      270,
    );
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    const rows = [
      ['Score', String(Math.floor(state.score))],
      ['Birds home', `${state.flock.flyingCount()} of ${state.flock.total}`],
      ['Fireflies caught', String(state.firefliesCaught)],
      ['Starlings gathered', String(state.birdsGathered)],
      ['Flight time', `${minutes}:${seconds}`],
      ['Best score', String(Math.max(best, Math.floor(state.score)))],
    ];
    rows.forEach(([label, value], i) => {
      const y = 312 + i * 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(label, FIELD.width / 2 - 220, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(value, FIELD.width / 2 + 220, y);
    });
    ctx.textAlign = 'center';
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.firefly;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('Space or click — fly again', FIELD.width / 2, 506);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /** Streaks of air while boosting. Their places come from the scroll and the
   *  clock alone, so the same moment always paints the same streaks. */
  function drawSpeedLines(state) {
    ctx.strokeStyle = PALETTE.streak;
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      const y = 30 + ((i * 97 + 53) % 660);
      const x = FIELD.width - ((state.scrollPx * 2.4 + i * 211) % 1500);
      const length = 40 + ((i * 37) % 50);
      ctx.globalAlpha = 0.10 + 0.08 * ((i * 7) % 3) / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y - 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, best) {
    fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shake = state.shake;
    if (shake > 0) {
      const ox = Math.sin(state.time * 127.1) * shake * 7;
      const oy = Math.cos(state.time * 141.3) * shake * 7;
      ctx.translate(ox, oy);
    }
    drawSky(state);
    drawHills(state);
    drawOak(state);
    drawUpdrafts(state);
    drawFireflies(state);
    drawStrays(state);
    drawGusts(state);
    drawHawks(state);
    drawFlock(state);
    state.particles.draw(ctx);
    if (state.boosting) drawSpeedLines(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 40, ${state.flash * 0.22})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
