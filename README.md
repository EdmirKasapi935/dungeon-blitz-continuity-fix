# Classic Dungeon Blitz — Private Server (Patched Build)

A TypeScript/Node.js private server reimplementation of the Flash MMO **Dungeon Blitz**, paired with a patched version of the original Flash client. This repository is a fork/continuation of an existing fan reimplementation project, with a round of bug-fixing applied on top.

## Credit & Original Project

This project is built on top of the excellent groundwork laid by the original creators:

**Original repository:** [github.com/theminesastudios/classic-dungeon-blitz](https://github.com/theminesastudios/classic-dungeon-blitz)

All credit for the initial server architecture, client patching, and reverse-engineering of the original game's protocol and data goes to the original authors. This fork exists to document and contribute a set of bug fixes discovered through play-testing, not to claim ownership of the underlying reimplementation work.

Dungeon Blitz is the intellectual property of its original developers/publisher. This is a non-commercial fan project preserving and continuing access to a now-defunct Flash game, not an official product.

## What's Fixed in This Build

### Dungeons ending early, before the boss was actually dead
A series of fixes addressing dungeons completing prematurely, mid-boss-fight, instead of at a genuine kill:

- **Fixed duplicated HP-calculation code.** The same "how much HP does this monster have" logic existed as two separate copies in different files. Only one was getting fixed at a time, so the bug kept resurfacing.
- **Added proper Hard-mode HP scaling.** Hard-mode monsters were using the exact same HP as their Normal-mode versions. Fixed by using each dungeon's own declared difficulty level to scale monster HP correctly.
- **Fixed Hard-mode scaling conflicting with player-level scaling.** A separate system scales monsters to match the player's own character level. The two systems were overriding each other instead of combining — now the higher of the two is used.
- **Extended and fixed the "trust the client's kill" system.** A mechanism that lets the client confirm a boss's death (instead of the server guessing) existed but only worked for a handful of dungeons, and was checking the wrong internal flag for most monsters. Now applies correctly across all Hard dungeons.
- **Corrected missing difficulty data for 3 dungeons.** *Death to Meylour*, *Royal Intervention*, and *Ring of Fire* were missing the difficulty boost every other Hard dungeon has, which would have left their bosses too weak even after the fixes above.
- **Fixed the dev server not picking up data-file changes.** Data fixes needed a full manual restart to take effect; the server now detects them automatically.

## Notes

This build also includes various research/data-exploration tooling used during investigation (gear/mount lookup scripts, sprite-extraction utilities for unused game content, etc.) that isn't part of the server's runtime behavior — see the repository history for details.
