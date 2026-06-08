# Changes

## New gameplay layer

- Added a true zero-start loop: the player begins with `$300`, no apartment, no job, no wardrobe, and no film access.
- Added a salary ladder through the employment office, with hard requirements for education, wardrobe tier, experience, and reputation.
- Added housing choices with monthly rent, eviction back to the couch, and cheap-flat robbery risk.
- Added wardrobe tiers with wear, job gating, and couch storage pressure.
- Added film-school classes, freelance gigs, first-camera unlock, and a gated transition into filmmaking.
- Added a headless logic API for the main action functions (`buyScript`, `hire`, `doShoot`, `doPost`, `doPremiere`, `doCinema`, `doTv`, `doFund`, `doPinv`, `haggle`, `goToBuilding`, `flyTo`, `endDay`, `bankDo`, `buyEquip`).

## Visual-only changes

- Rebuilt the game as a full-screen illustrated board with ring navigation, animated avatar movement, skyline backdrops, and a persistent status strip.
- Added large building interiors with clerk characters, speech bubbles, satirical room copy, marquee feedback, floating notifications, theme cycling, and WebAudio chiptune cues.
- Added a start screen, high-score panel, multi-city palettes, and goal-progress cards.

## Existing engine notes

- The original `studio-mogul-365.html` source referenced by the brief was not present in the workspace, so this implementation reconstructs the requested systems as a standalone single-file game rather than patching an existing engine.
- Added `test-sm365.js` and `test-winbot.js` as smoke tests for the headless logic layer and a deterministic production/win path.
