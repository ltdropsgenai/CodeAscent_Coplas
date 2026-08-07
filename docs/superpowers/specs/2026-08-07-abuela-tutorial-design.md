# Abuela — tutorial narrator and recurring presence

**Status:** approved design, not yet implemented
**Date:** 2026-08-07

## What this is

A cartoon Abuela who opens the tutorial: she tells the player, in her own
words, what lotería was like at her grandmother's table, explains where the
name "Coplas" comes from, and hands off to the interactive demo that already
exists. She then recurs — as stills, not video — at rare earned moments, and
sits on the Home screen as a small permanent presence.

## Decisions, and why

### She tells her memory, not the game's history

She makes **no factual claim**: no dates, no publishers, no assertion that can
be contested or go stale.

This is deliberate. The store listing states Coplas "is not affiliated with,
associated with, authorised by, or sponsored by Don Clemente, Inc.,
Pasatiempos Gallo, or any other publisher of lotería card decks"; keywords were
chosen (`sinónimos` over `connections`) to keep trademark arguments off the
field; and attorney review of the deck is still listed as blocking production.
The real history of lotería runs directly through those names — the classic
54-card deck is Don Clemente's 1887 publication. Narrating that inside the app,
in the section explaining where our game comes from, would undo distance that
was built on purpose.

Her memory costs nothing legally, is warmer, is what a grandmother would
actually say, and earns the app's name: the *coplas* were the verses the caller
sang before each card. Nothing in the app currently explains that.

### The script (locked before any video is generated)

Three beats, ~7 seconds each, ~20 seconds per language.

**Español**

1. "Cuando yo era niña, jugábamos lotería en la mesa de mi abuela. Frijoles para
   marcar, y todos gritando."
2. "Antes de cada carta, el que cantaba decía un versito. Una copla. De ahí viene
   el nombre de este juego."
3. "Aquí no cantamos — aquí buscamos. Dieciséis cartas, cuatro grupos de cuatro.
   Encuéntralos."

**English**

1. "When I was small, we played lotería at my grandmother's table. Beans to mark
   your card, and everybody shouting."
2. "Before each card, the caller would sing a little verse. A copla. That's where
   this game gets its name."
3. "Here we don't sing — here we look. Sixteen cards, four groups of four. Go
   find them."

The English is not a translation. Each version is written the way that language
would say it (`versito` / `little verse`).

**THE SCRIPT IS LOCKED BEFORE PRODUCTION.** She is fully lip-synced with one
video set per language, so a wording change means regenerating video — and with
EAS Update unavailable (2154 assets against a 1000 cap) every regeneration is a
store build and a review. This is the one piece of work in this project that
must be got right before it is made, rather than measured and corrected after.

### She is rendered differently from the deck, on purpose

The 995 cards are painterly 2D. Fully lip-synced generated video will not match
that, and no prompting reliably produces consistent painterly 2D with accurate
mouth shapes across twenty seconds. Rather than chase a match we will not get:
**she is a person telling you about the game; the cards are objects in it.**

Different technique, unified by palette (indigo night, marigold gold), by
lighting (one warm lamp against indigo falloff), and by the squared gold
hairline frame she sits in. Squared, not rounded — the house rule in
`theme.ts`, restated when the reading scrim was added.

Her design: a Mexican abuela at a kitchen table at night, silver hair pinned
back, rebozo over a plain blouse, laugh lines, lotería cards and a dish of
frijoles in front of her. Drawn with the dignity the deck now insists on. Two
caricatures were removed from that deck; she is the last place to reintroduce
one.

### Captions are never optional

Text carries the meaning; voice is enrichment. Sound can be off, "Durante la
partida" has a `silencio` mode, and a player who cannot hear must get the whole
segment. This also fixes the dependency direction: the words are the content,
the performance is the delivery.

### She is not on the board

No presence during a round. The board is where the player is thinking, and a
character watching you solve is pressure, not warmth.

### Recurrence: stills at earned moments, plus Home

Video on every win was considered and rejected. `app/play.tsx` already records
why, about the celebration voices: firing on every solved group "is worse… a
voice you expect is wallpaper — the same way the round beds felt thin before
they stopped repeating. Rarity is what makes it land." In continuous play a
player finishes twenty rounds a sitting. There is also an economics problem: the
celebration survives repetition because it draws on **46** voice lines cast by
region; a lip-synced Abuela with one or two clips would be the most-repeated
asset in the game.

Instead:

- **Earned moments** hook onto `computeAchievements` / `newlyUnlocked` in
  `src/game/achievements`, which are already computed at round end and already
  rare by construction. No second notion of "something special happened" to keep
  in sync, and new achievements bring her along for free.
- **Home** carries one still behind a single `ABUELA_ON_HOME` constant, so
  removing it is a one-line change rather than an unpicking job. It is explicitly
  provisional.

## Architecture

| Unit | Responsibility |
|---|---|
| `src/components/Abuela.tsx` | Renders her in the squared gold-hairline frame. Takes either a pose key (still) or a beat (video). One component for both uses so the frame and the fallbacks cannot drift apart. |
| `src/data/abuelaAssets.ts` | Registry: poses, six video clips keyed by beat × language, caption keys. |
| `app/tutorial.tsx` | Gains one Step at the front; `STEPS` 4 → 5. Her three beats play inside that single step. |
| `app/index.tsx` | Home still, behind `ABUELA_ON_HOME`. |
| achievements hook | Existing `newlyUnlocked` result drives which pose appears, if any. |

**Staging.** One tutorial step, not three — the flow has four dots today and
adding three more turns a tutorial into a slideshow. Beats auto-advance; a tap
advances early; the existing "Siguiente" moves on to the demo.

**Fallbacks**, each matching a pattern the app already uses:

- Reduce-motion → still plus caption, no video. `AppBackground` and
  `DealOverlay` both do this.
- Sound off → plays silent; captions carry it.
- Missing or unplayable clip → falls back to the still, matching the audio
  system's rule that sources missing from the registry simply do not play rather
  than crashing.

## Assets

Six lip-synced clips (3 beats × 2 languages), four or five stills, captions in
the i18n dictionary.

`check-assets` covers existence and extension-matches-bytes automatically, since
it walks every required asset. Bundle impact (~40s of video against 114.8 MB) is
to be **measured after generation, not estimated**.

## New gate

`scripts/check-abuela.mjs`: every beat has a clip in both languages, every beat
has a caption in both languages, every pose referenced by code exists on disk.

A half-localised character is exactly the failure that ships silently and is
only visible to the Spanish-speaking half of the audience — the same shape as
the voice clips nobody had measured and the SFX pack nobody had measured. Every
gate in this repo exists because something was asserted and never checked.

## Out of scope

- Any presence during a round.
- Voice for the recurring stills — they are silent, and the existing 46-line
  celebration pack is untouched.
- `select.mp3` (a failed render at -77 dBFS RMS, needs regenerating) and
  `grupo.mp3` (clipping at +1.0 dBFS). Both are real and both belong to an SFX
  pass with its own gate.
