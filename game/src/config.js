// Every tuning number and colour for Murmuration in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size. The flock flies right, toward the roost,
// and the world scrolls left under it.

export const FIELD = { width: 1280, height: 720, skyBottom: 648 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole journey home, in metres. One pixel of forward flight is half a metre. */
export const TRIP_METRES = 3000;
export const METRES_PER_PIXEL = 0.5;

export const LEADER = {
  startX: 300,
  startY: 360,
  minX: 90,
  maxX: 900,
  minY: 70,
  maxY: 610,
  /** How hard the leader accelerates toward the steering target. */
  accel: 1500,
  maxSpeed: 470,
};

export const FLOCK = {
  startBirds: 24,
  maxBirds: 40,
  /** Below this many birds the flock is lost. */
  minBirds: 6,
  /** How far a bird may sit from the leader, in pixels, before the formation pulls it back. */
  spread: 150,
  /** Seconds a scattered bird waits at the edge before it is gone for good. */
  straySeconds: 4.5,
};

export const ENERGY = {
  max: 100,
  boostDrainPerSecond: 28,
  regenPerSecond: 7,
  firefly: 12,
  updraft: 30,
  callCost: 10,
  callCooldownSeconds: 6,
};

export const SPEED = {
  cruise: 150,
  boost: 255,
};

export const HAWK = {
  firstAtSeconds: 12,
  intervalSeconds: 8,
  intervalLateSeconds: 6,
  /** After this many seconds of flight the interval shortens. */
  lateAtSeconds: 45,
  speed: 390,
  /** How fast a hawk closes on the flock's height. */
  homing: 70,
  warnSeconds: 1.2,
  /** Birds inside this radius of a hawk are scattered. */
  scatterRadius: 110,
  maxScattered: 6,
  /** Diving hawks only appear after this many seconds of flight. */
  diveAfterSeconds: 50,
  /** Chance a spawned hawk is a diver instead of a cruiser. */
  diveChance: 0.35,
  /** How long a diver hovers high, telegraphing its swoop, in seconds. */
  diveHoverSeconds: 0.9,
  /** The swoop itself, in pixels a second. */
  diveSpeed: 520,
  /** A hawk that slips past this close to the leader is a near miss. */
  nearMissRadius: 180,
  nearMissShake: 0.45,
};

export const GUST = {
  firstAtSeconds: 20,
  intervalSeconds: 9,
  speed: 300,
  height: 170,
  /** Seconds inside a gust before it tears one bird away. */
  tearSeconds: 0.9,
  pushX: -130,
  /** Chance a gust also shoves the flock sideways; the push itself is up to this many pixels a second. */
  sideChance: 0.5,
  sidePushMax: 95,
};

export const FIREFLY = {
  intervalSeconds: 1.6,
  intervalJitter: 0.9,
  collectRadius: 30,
  points: 25,
  drift: 46,
  /** Pickups inside this many seconds of each other build a combo. */
  comboWindowSeconds: 3,
  /** The score multiplier caps here (x5). */
  comboMax: 5,
};

/** How much the hawk and gust intervals shorten as the roost nears (0..1 of the trip). */
export const RAMP = {
  hawk: 0.35,
  gust: 0.3,
};

export const STRAY_BIRD = {
  intervalSeconds: 14,
  collectRadius: 34,
  points: 50,
};

export const UPDRAFT = {
  intervalSeconds: 11,
  radius: 64,
  collectRadius: 52,
  points: 10,
  lift: 90,
};

export const SCORE = {
  metresPerPoint: 10,
  winBonus: 400,
  winPerBird: 25,
};

/** Seconds of flight per dusk step; the sky darkens as the roost nears. */
export const DUSK = { steps: 5 };

export const PALETTE = {
  // Dusk sky, from amber evening (progress 0) to indigo night (progress 1).
  skyTopStart: '#f2a35e',
  skyTopEnd: '#1c2340',
  skyMidStart: '#e87e5a',
  skyMidEnd: '#2c2f55',
  skyBottomStart: '#7d5a7a',
  skyBottomEnd: '#12162b',
  sun: '#ffd98a',
  moon: '#e8ecff',
  hillFarther: '#6b5578',
  hillFar: '#5a4468',
  hillNear: '#3a2c4e',
  treeLine: '#241a33',
  oak: '#160f22',
  oakRim: '#f2a35e',
  bird: '#191423',
  birdRim: '#f2a35e',
  feather: '#2a2138',
  combo: '#ffd166',
  streak: '#ffffff',
  firefly: '#ffe066',
  hawk: '#4a3428',
  hawkEye: '#ff5a3c',
  gust: '#cfd8ff',
  updraft: '#7fe3d0',
  stray: '#ffd166',
  panel: '#14101fdd',
  panelEdge: '#ffffff2e',
  text: '#f5efe4',
  muted: '#c9bfae',
  danger: '#ff6b57',
  energy: '#7fe3d0',
  energyBack: '#ffffff22',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'murmuration.best';
