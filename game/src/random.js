// A small seeded random number generator: the same seed gives the same sky, the same
// hawks and the same fireflies, which is what makes the screenshot scenes repeatable.
// Implemented from the mulberry32 recurrence, written out in full here.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value between min (inclusive) and max (exclusive) from the given generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one element of an array with the given generator. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}
