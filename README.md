# Coplas 🎴

A daily grouping puzzle: sort 16 Lotería cards into 4 hidden groups. NYT
Connections' loop fused with the Mexican Lotería deck. React Native + Expo
(SDK 57).

> Working prototype scaffold — core mechanic, streaks/stats, archive, and
> the share grid all work with placeholder emoji art. See the design doc in
> the CodeAscent project for the full plan.

## Run it

```bash
cd coplas
npm install
npx expo install --fix   # aligns native dep versions to your installed SDK
npm run validate         # check the puzzles are well-formed
npx expo start           # press w for web, or scan the QR with Expo Go
```

`npx expo install --fix` matters: the versions in package.json are pinned to
SDK 57 but this command re-pins them to exactly what your local Expo expects.

## What's here

```
app/                     Screens (expo-router)
  index.tsx              Home / today
  play.tsx               The puzzle board (core mechanic)
  archive.tsx            Past puzzles (7-day free window)
  stats.tsx              Streaks + stats
  settings.tsx           Relaxed mode, language, notifications
src/
  types.ts               Card / Group / Puzzle types
  theme.ts               Colors + tier ladder
  data/cards.ts          The 54-card deck (emoji placeholders)
  data/puzzles.json      6 sample puzzles
  data/puzzles.ts        Loader + "today" logic (America/Mexico_City)
  game/engine.ts         Pure game logic (no React)
  game/useGame.ts        React hook: selection, submit, persistence
  storage/store.ts       AsyncStorage: results, stats, settings
  share/shareGrid.ts     Spoiler-free emoji share text
  components/            CardTile, SolvedGroup
schema/puzzle.schema.json  JSON Schema for puzzles
scripts/validate-puzzles.mjs  Content validator (npm run validate)
```

## Authoring new puzzles

Add objects to `src/data/puzzles.json` following the shape of the existing
ones, then run `npm run validate`. Rules enforced: exactly 4 groups of 4, all
card ids real, 16 unique cards per puzzle, tiers exactly {1,2,3,4}, unique
id/number/date. Keep a 60–90 day buffer ahead of the current date.

## Known placeholders / next steps

- **Art:** cards render as emoji. Commission original artwork of the 54
  archetypes (do NOT ship the traditional Don Clemente illustrations — see
  design doc §10). Then add an `image` field to `Card` and swap the glyph in
  `CardTile`.
- **Card #26** ("El Charro") replaces the traditional deck's offensive name;
  finalize naming with cultural review.
- **Notifications:** the settings toggle is stored but not yet wired to
  `expo-notifications`.
- **Cloud sync:** streaks are local (AsyncStorage). Add Supabase so a
  reinstall doesn't wipe a long streak.
- **Monetization:** archive lock is a placeholder — wire RevenueCat for the
  archive-unlock IAP.
- **Remote puzzles:** currently bundled JSON. Fetch new puzzles from a
  CDN/Supabase table so you can ship content without an app update.
