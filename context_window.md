# Context Window Handoff (2026-03-28)

## Scope
This repository is focused on `gamified-physical-webapp/apps/marketing` (React + Three.js + Rapier) for a gamified interceptor-drone showcase.

The user priority in this session: improve graphics/experience quality first (especially marketing app), plus tutorial flow quality and map storytelling.

## User Intent Snapshot
The latest user directions before context rollover:
- Make tutorial route/camera more cinematic (spawn + waypoints tuning, avoid harsh cross-map camera cuts).
- Add the same style 3D board to the second polygon zone as preparation for later MATLAB CSV playback (drone1/drone2 coordinates to be provided later).
- User feedback on current visual result: "hele to nevypada moc dobre :D" (looks not good yet), so visual polish remains open.

## What Is Already Implemented
- Intro branding and favicon wiring:
  - `apps/marketing/index.html` includes `/Logo.png` favicon.
  - `apps/marketing/public/Logo.png` added.
  - tutorial intro panel shows logo.
- Multistage tutorial flow:
  - Added `simulation` stage between target and outro.
- i18n extended (CZ/EN/UK):
  - tutorial simulation texts.
  - scene labels for simulation point.
  - board phase titles/bodies.
- Zone 1 board + intercept animation:
  - 3-phase 3D board exists in first polygon zone.

## Current Working Tree State (Important)
There are unstaged modifications in:
- `gamified-physical-webapp/apps/marketing/src/App.tsx`
- `gamified-physical-webapp/apps/marketing/src/scene/PortfolioScene.tsx`
- `gamified-physical-webapp/apps/marketing/src/i18n.tsx`
- `gamified-physical-webapp/apps/marketing/src/scene/projects.ts`
- `gamified-physical-webapp/apps/marketing/src/styles.css`
- `gamified-physical-webapp/apps/marketing/index.html`
- `gamified-physical-webapp/apps/marketing/public/Logo.png`

## Critical Delta Introduced Right Before Rollover
In `App.tsx`, a new prop was started:
- `tutorialSpawn` constant added and passed to `PortfolioScene`.

But `PortfolioScene` has not been fully updated in this latest delta to consume `tutorialSpawn` yet in the final form of code at rollover, so this can cause type/build mismatch depending on the exact file state.

## Known Quality Issues
1. 3D board style/readability currently feels visually weak to user.
2. Camera motion still needs filmic tuning (trajectory bias + smoother segment transitions).
3. Second polygon zone board is not yet fully adapted to be clearly distinct as "MATLAB playback placeholder".

## Immediate Next Steps (Do First)
1. Fix compile consistency:
- Ensure `PortfolioSceneProps` includes `tutorialSpawn`.
- Pass `tutorialSpawn` through `PortfolioScene -> SceneContents -> Drone/TutorialRoute/FollowCamera` as needed.
- Run build.

2. Improve cinematic tutorial route:
- Use multi-point curved route (Catmull-Rom or segmented waypoints) for:
  - spawn -> checkpoint
  - checkpoint -> Shahed
  - Shahed -> simulation zone
- Avoid direct diagonal across map center when not narratively needed.

3. Improve camera feel:
- Add tutorial-mode camera rails/offset presets per segment.
- Keep look-at slightly ahead of drone heading (not always exactly drone center).
- Add damping tuned separately for position and look target.

4. Improve board design quickly:
- Reduce extreme perspective/skew impact by adjusting board position/rotation in-zone.
- Increase text contrast and simplify background layers.
- Reduce excessive width and increase line spacing for readability.

5. Add board in second zone:
- Reuse same component with different title/body keys:
  - indicate "MATLAB simulation playback placeholder".
- Keep a clear visual distinction from first zone (e.g., color accent).

## Suggested Commands
From repo root:
```bash
cd gamified-physical-webapp/apps/marketing
npm run build
```

For dev preview:
```bash
cd gamified-physical-webapp/apps/marketing
npm run dev -- --host 0.0.0.0 --port 5174
```

## File Hotspots
- `gamified-physical-webapp/apps/marketing/src/App.tsx`
- `gamified-physical-webapp/apps/marketing/src/scene/PortfolioScene.tsx`
- `gamified-physical-webapp/apps/marketing/src/i18n.tsx`
- `gamified-physical-webapp/apps/marketing/src/styles.css`

## Notes For Next Agent
- Do not revert unrelated user edits.
- Keep Czech-friendly phrasing where user-visible text is added/changed.
- User prefers direct implementation over long planning.
- The user explicitly approved future MATLAB CSV-driven zone simulation, but data is not provided yet.
