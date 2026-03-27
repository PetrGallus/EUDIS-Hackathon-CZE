# Handoff Prompt for Next Chatbot

You are continuing work in the repository `EUDIS-Hackathon-CZE`.

Your job is to continue implementation work with strong focus on visuals and interaction quality in `gamified-physical-webapp/apps/marketing`, while avoiding regressions in controls/challenge flow.

## 1. Repository Overview

This is a monorepo with multiple apps:

- `gamified-physical-webapp/apps/web`: tactical dashboard (main product dashboard)
- `gamified-physical-webapp/apps/bridge`: telemetry bridge API (MATLAB integration)
- `gamified-physical-webapp/apps/marketing`: immersive 3D marketing/demo experience (current active focus)
- `gamified-physical-webapp/packages/shared`: shared contracts/types
- `gamified-physical-webapp/dashboard/`: legacy prototype
- `matlab-code-outputs/`: MATLAB code outputs
- `simulink-output-1/`: Simulink output project
- `simulink-output-2/`: Simulink output project

Top-level README mostly describes `gamified-physical-webapp/apps/web` + `gamified-physical-webapp/apps/bridge` telemetry flow. Current active UX/graphics iteration is happening in `gamified-physical-webapp/apps/marketing`.

## 2. Current Priority

Primary priority from user: **graphics quality is the most important thing right now**.

Secondary constraints:

- Keep controls stable and readable
- Keep challenge playable (not overwhelming)
- Avoid modal/page scrolling UX issues

## 3. Current `gamified-physical-webapp/apps/marketing` State

### Rendering stack

- React + TypeScript + Vite
- `@react-three/fiber`
- `@react-three/drei`
- `@react-three/rapier`
- `@react-three/postprocessing` (recently added)

### Core files

- `gamified-physical-webapp/apps/marketing/src/App.tsx`
- `gamified-physical-webapp/apps/marketing/src/scene/PortfolioScene.tsx`
- `gamified-physical-webapp/apps/marketing/src/scene/IslandChallenge.tsx`
- `gamified-physical-webapp/apps/marketing/src/scene/projects.ts`
- `gamified-physical-webapp/apps/marketing/src/styles.css`

### Implemented scene/gameplay behavior

- Camera-follow drone movement in larger arena (`arenaHalf = 46`, 92x92 world)
- Camera-relative WASD/arrow controls for flight
- Animated ocean with vertex displacement waves
- Futuristic drone mesh (custom geometry + thruster glow + logo panels)
- 3 project islands with trigger colliders and dossier unlock flow
- Mini-game challenge is now drone-themed grid interception (arrows + space EMP)

## 4. Most Recent Graphics Upgrades (already in code)

### Tone and post-processing

- `App.tsx` canvas uses ACES filmic tone mapping:
  - `toneMapping: THREE.ACESFilmicToneMapping`
  - `toneMappingExposure: 1.1`

- `PortfolioScene.tsx` now includes:
  - `Stars` background
  - `EffectComposer` with `Bloom` + `Vignette`

### Visual tuning

- Darker background/fog for contrast (`#020c16`)
- Emissive intensities boosted for drone thrusters, island accents, and neon boundary walls
- Ocean color/emissive tuned brighter to respond better with bloom

### Dependencies updated

- `gamified-physical-webapp/apps/marketing/package.json` includes `@react-three/postprocessing`

## 5. Challenge Status (important: do not regress)

`IslandChallenge.tsx` was stabilized after user complaints:

- Arrow keys fixed using window keydown listener in capture phase
- `preventDefault` + `stopPropagation` used for arrows/space
- Difficulty reduced:
  - slower tick (`stepMs = 190`)
  - fewer initial hostiles (`initialHostiles = 2`)
  - hostiles move every second tick
  - capped spawn pressure (`< 4` hostiles, periodic spawn)

Maintain this playability unless user asks to rebalance.

## 6. UI/UX Constraints Already Addressed

- Page/root scrolling disabled (`overflow: hidden` on `html, body, #root`)
- Challenge modal compacted and constrained to viewport height
- User should not need page scroll to interact with challenge modal

## 7. Known Risks / Open Areas

- Water still may look angle-dependent in some camera/light situations (partially mitigated)
- Post-processing and emissive boosts may need additional balancing for performance and readability
- Bundle size warning exists in production build (non-blocking for now)

## 8. Build and Verification

From `gamified-physical-webapp/apps/marketing`:

```bash
npm run build
```

Build currently passes.

## 9. Suggested Next Iteration Plan (graphics-first)

Use this order unless user changes direction:

1. Improve ocean realism further (depth gradient, fresnel-like response, shoreline effects)
2. Improve lighting composition (key/fill/rim consistency + environment strategy)
3. Add subtle atmospheric FX (haze layers, volumetric-feel fake planes, sky treatment)
4. Improve island material language consistency (metal/glass/energy readability)
5. Keep challenge and controls untouched unless a regression appears

## 10. If User Offers Asset Uploads

If user asks whether they can upload files: yes.
Useful assets:

- HDRI files (`.hdr`/`.exr`) in `gamified-physical-webapp/apps/marketing/public/`
- Textures (`.png`, `.jpg`) in `gamified-physical-webapp/apps/marketing/src/images/`

Then wire these into scene materials/environment.

## 11. Operational Instructions for You

- Focus edits on `gamified-physical-webapp/apps/marketing`
- Do not refactor unrelated monorepo apps unless requested
- Prefer incremental, testable visual changes
- After each substantial change, run build and confirm no regressions
- Keep the user’s key intent in mind: visuals first
