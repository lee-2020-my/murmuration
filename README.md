# murmuration

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/lee-2020-my/murmuration/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/lee-2020-my/murmuration/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Murmuration is an original 2D canvas game: steer a starling flock home across a
dusk sky. Guide the leader with the mouse, boost with a held click or Shift, call
scattered birds home with C, dodge the hawks — cruisers and the divers that hover
high, then drop on your line — ride out the gusts that shove you sideways,
chain fireflies into a score combo and gather stray starlings — and reach the old
oak before nightfall. The sky darkens and the hazards thicken as the roost
nears. Plain Canvas 2D and WebAudio synthesis throughout: no libraries, no audio
files, no network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## How to play

- Mouse — steer the leader; the flock follows in a flowing murmuration.
- Hold mouse or Shift — boost (drains energy; fireflies and updrafts refill it).
- C or right-click — call scattered birds home.
- P or Esc — pause. M — mute. Space or click — start and restart.
- Win by reaching the roost with your flock. Lose the flock — fewer than 6 birds
  left — and it scatters for good.

## Shots

The three screenshots in `screenshots/` are deterministic renders of the game
itself: start, play and win, each taken at `?shot=<scene>&seed=1`.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards
