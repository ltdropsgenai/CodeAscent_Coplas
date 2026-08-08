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

1. "De niña, jugábamos lotería en la mesa de mi abuela. Frijoles para marcar,
   todos gritando."
2. "Antes de cada carta se cantaba un versito. Una copla. De ahí el nombre de
   este juego."
3. "Aquí no cantamos — aquí buscamos. Dieciséis cartas, cuatro grupos de cuatro.
   Encuéntralos."

**English**

1. "When I was small, we played lotería at my grandmother's table. Beans for
   markers, everybody shouting."
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

## Parked: Abuela as the dealer between rounds

Proposed 2026-08-07, after build 23 shipped the deal animation. **Not decided.
Do not build until a real session has been played.**

The idea: she shuffles the deck between rounds, and the shuffle runs into the
deal that already exists — she becomes the dealer rather than a spectator, one
continuous gesture instead of two unrelated animations. One clip, language
agnostic, no lip-sync, so it costs a fraction of the tutorial beats. A shuffle
is a TRANSITION, not a performance, and transitions survive repetition in a way
performances do not; a dealer shuffles every hand and nobody tires of it.

**She does not speak here.** The original proposal had her say "bravo" on every
win. Rejected, by the same reasoning as video-on-every-win and for the second
time in one conversation: wins feel varied because they draw on 46 lines cast by
region, and replacing that with one repeated word trades all of it away. If the
word did not replace them, two voices would congratulate the player over the
same second.

**Why it is parked rather than planned.** The gap between rounds is the moment a
player repeats most, and the deal was deliberately made shorter after round one
to keep it from becoming friction. Whether that gap wants more in it or less is
answerable only after a proper session with build 23 — which had been in the
user's hands for about an hour when this was proposed. Deciding now means
guessing at it twice.

Revisit after twenty or so continuous rounds on 23. If the between-rounds beat
feels empty, she goes there. If it already feels long, this was saved work.

## Casting: Grandma Aurora (es-AR), and why the accent was accepted

**Voice: `aYQAm4rWuigkeuRA5i92`** — "Grandma Aurora", ElevenLabs, `es-AR`, age
`old`, tagged for character animation. One voice for BOTH languages: her Spanish
accent carries into English through the multilingual model, so the English
Abuela sounds like the same woman rather than an American stand-in.

**She is Argentine, and the game is Mexican.** This was chosen with the conflict
understood. `app/play.tsx` takes the opposite line for the celebration pack —
regionally marked slang is cast only to voices from that region, "because an
actor performing another country's slang is exactly what this audience hears
instantly" — and the primary market is Mexico and US-Hispanic.

Accepted anyway, for three reasons:

1. She is the only voice available that is actually a grandmother. Every
   alternative was middle-aged, which mismatches the approved stills and cannot
   be fixed by settings — cadence can suggest age, timbre cannot invent it.
2. **The script carries no regional slang.** It was written plain to avoid
   factual claims, and the side effect is near-neutral Latin American Spanish.
   There is no *órale* or *qué padre* to expose her. The one exposed word is
   *frijoles*, which an Argentine would more likely call *porotos*.
3. The alternative mismatch was not cheaper. A middle-aged Mexican voice over
   visibly elderly stills is also wrong, and the accent problem cannot be
   corrected after six lip-synced clips exist, while the stills could have been.

The rejected alternative was Fernanda (`ARmPWZKt7WpXh6QDHA6x`, es-MX,
middle-aged) with the stills regenerated a decade younger. Recorded here because
it is the fallback if Aurora's accent proves distracting in play.

**Settings:** speed 0.95, stability 0.45, style 0.30, `eleven_multilingual_v2`.
Slowed because cadence carries age better than timbre. Any regeneration must use
these, or the beats will not match each other.

## Amendment 2026-08-07: ES beat 1 reworded for the accent

The original line was "Cuando **yo** era niña… **y** todos gritando." Both
italicised words are `y` sounds, and Rioplatense Spanish renders `ll` and `y` as
*sh* — sheísmo, the most recognisable marker in Latin American Spanish, which a
Mexican listener places in one syllable. With Aurora cast as an Argentine voice,
those two sounds in the opening sentence were the whole exposure: beats 2 and 3
contain no `ll` or `y` at all, and beat 3's `Encuéntralos` cannot leak voseo
because the TTS reads the tú form as written.

Rewording removed both triggers, kept the meaning and the warmth, and made the
line a word shorter. What remains is intonation, which is far subtler.

Amended BEFORE any video existed, which is the only window in which the locked
script is cheap to change. The lock is not that the words can never move; it is
that they must not move once six lip-synced clips depend on them.

The English beat 1 is unchanged — no accent issue exists in English, and "When I
was small" already parallels "De niña".

## Amendment 2026-08-07: ES beat 2 shortened to fit the clip

The line was cut off mid-speech in the generated video, twice — first at a 7
second clip and again at 10.

Root cause was mine: the first pass set each clip's duration by ESTIMATING how
long the speech would run, and Spanish runs slower per character than the
estimate assumed. ES beat 2 was the longest Spanish line at 102 characters,
against 89 and 90 for the two beats that played correctly.

The cloud session is firewalled from the ElevenLabs and Higgsfield CDNs, so the
audio could not be measured directly from there — which is exactly why the
estimate was made in the first place, and exactly why it was wrong. Rather than
keep raising the duration against a model whose output length could not be
verified, the line was cut to 84 characters: shorter than beat 1, which plays.

Meaning is unchanged and arguably improved — "se cantaba" puts the singing in
the foreground, which is the point of the beat.

The lasting fix is scripts/fetch-abuela-video.mjs, which trims every clip to the
MEASURED end of speech via silence detection on the video's own audio track,
rather than to a duration anyone guessed. Same correction master-voice.mjs makes
to the voice lines, for the same reason.

English beat 2 was left alone: it is 102 characters but plays correctly, because
English runs faster per character.

## Amendment 2026-08-07: EN beat 1 shortened for lip-sync

Reported as not properly synced. At 111 characters it was the longest line in
the script — longer than ES beat 2, which had already failed twice for related
reasons. English runs faster per character than Spanish, so it did not run out
of clip the way ES2 did; the sync itself degraded.

Cut to 100 characters, below EN beat 2 at 102, which syncs correctly. "Beans for
markers" replaces "beans to mark your card, and" — tighter, and closer to how
someone actually speaks.

A pattern was claimed here — "every clip that fails is the longest line for its
language" — and it was WRONG. EN beat 3 then failed to sync at 84 characters,
the shortest line in the whole script. The claim was made on one data point per
language and stated as a rule.

What is actually supported: over-long lines caused the two TRUNCATIONS, and
shortening fixed both. Sync quality is a separate matter and appears to be
partly stochastic — wan2_7 is a sampling model, and one poor take in six is
ordinary variance rather than evidence of a rule. Treat a sync failure by
regenerating the same input first, and only change the words if the same input
fails twice.

Length still matters for truncation. 84-102 characters is proven to fit; longer
lines are what ran out of clip.

## Amendment 2026-08-07: Spanish beat 3 had been shipping cut off

Reported as "out of sync, with obvious breaks where the 3 clips were joined."
Two of those three words were wrong, and finding out which took two measurement
bugs of my own.

**The clip was truncated, not desynchronised.** The generator cut Spanish beat 3
while she was still talking: the last 0.4 s of the original 9.03 s file measures
−27 dB, which is speech. `optimize-abuela-video.mjs` then made it worse. It
decided a silence window was the trailing one when it closed within 350 ms of
the file ending, and the last window it could see was a MID-SENTENCE PAUSE that
closed 65 ms before the file did. Inside the guard band, read as the tail,
everything after it discarded. The clip shipped at 8.93 s. The regenerated one
runs to 10.76 s. Roughly 1.8 seconds of that beat had never been heard.

**The joins are not the problem.** Measured at the resolution that ships, PSNR
between one clip's last frame and the next clip's first:

    join      before   after
    es 1→2     22.6     17.5
    es 2→3     24.1     25.1
    en 1→2     23.1     22.5
    en 2→3     22.6     19.9

English measures WORSE at both joins than the Spanish that was reported broken,
and English was reported as landing fine. Asking her in the prompt to settle
back into the opening pose as the last words land did not work. Every clip is
generated from the same start image, so each opens on the identical portrait and
closes wherever her motion left her; closing that gap for real means chaining —
feeding clip N's last frame in as clip N+1's start image — which is available
and was not spent, because the evidence says the seam is not what anyone noticed.
What ships instead is a 200 ms dip in `app/tutorial.tsx`: the picture inside the
frame fades to the dark panel, the clip AND the caption change in that dark
moment, and it comes back over 260 ms. The gold hairline never moves.

**Two measurement bugs, same family as the one this project already named.**

1. `ffErr` returned `''` on success and read stderr only from the exception. But
   ffmpeg exits 0 for both `silencedetect` and `psnr`, so it read nothing every
   time. The trim became a no-op that printed `11.0s → 11.0s` and called it
   success. *A checker that reads less than the data it checks doesn't fail, it
   approves* — written in these docs, and written again here by me.
2. Reference PSNR figures of 27–29 dB were measured on 200 px thumbnails and
   then quoted as thresholds against 640 px output, where the same joins measure
   17–25 dB. PSNR is not scale-invariant. The script now prints before-and-after
   at one resolution and no verdict.

**The lasting fix** is `scripts/lib/speech-end.mjs` — ONE copy, imported by all
three scripts that trim a clip. It reverses the audio and looks for silence at
the start, so trailing silence is found by construction and there is no "is this
really the end" judgement left to get wrong. A clip still above the threshold at
its last sample reports itself as truncated, which now blocks promotion instead
of being trimmed shorter still. The three previous copies of this logic were
pasted from one another, exactly as `sim-rounds.mjs` inherited the `trapsPool()`
bug by copy-paste.

**Operational note.** Do not run `git` through the device bridge. The VM cannot
delete files, so any git command that creates `.git/index.lock` leaves it behind
and blocks the next command on Windows. Both `index.lock` incidents in this work
were caused this way, by me, and the first one was misdiagnosed as a crashed
editor.

## Amendment 2026-08-07: one take per language, not three clips

"I don't want this to play like 3 clips joined, I want it to play like one
entire video clip." Every earlier attempt treated that as a presentation problem
— hard cut, then a dip, then a cross-dissolve — and each one only changed what
the seam looked like. Three takes do not become one take.

**The narration is now a single continuous take per language.** A 30-second
unbroken shot was generated once (seedance_2_5, t2v), then lip-synced to the
full narration in one pass (sync_so) against Aurora's read of the locked script,
generated through the user's own ElevenLabs voice and imported to the generator
by URL. Two files: `assets/abuela/es.mp4` and `en.mp4`, 23.71 s each. There is
no second clip in either language, so there is nothing that can show a join.
The captions follow playback time from `src/data/abuelaMarks.json`.

### The ceiling that forced three clips in the first place
Every model here that lip-syncs to a SUPPLIED audio track caps at 15 seconds:
wan2_7, minimax_h3 and kling3_0 all clamp a 30-second request to 15. The only
model that generates 30 seconds, seedance_2_5, rejects reference images — its
IP check on the reference never completes, across three separate copies of the
portrait and ten minutes of retries. So the 30-second plate had to be generated
from the character DESCRIPTION rather than from the approved portrait.

**The open risk that follows from that:** she may not match the Home still and
the four achievement poses. If she has drifted, re-derive those stills from a
frame of this take. Do not go back to three clips.

### Two more measurement defects, both mine
- **The trim gate raised a false alarm.** `sync_mode: 'cut_off'` ends the file
  the instant the audio ends, so the trailing silence is ~0.15 s — shorter than
  the minimum window `silencedetect` can see. No window found was being read as
  "cut off mid-word", and it blocked a take whose last syllable was complete.
  `speech-end.mjs` now asks the amplitude directly in that case: below −45 dBFS
  across the final 150 ms is a decay, above it is a severed word. The Spanish
  beat 3 that really did ship truncated measures −27 dB and is still caught.
- **The caption marks were right in Spanish and wrong in English.** The beat
  boundary after "everybody shouting" sits at 7.72–8.04 s with a floor between
  −40 and −38 dB, so at −40 dB / 0.30 s it was invisible and the
  nearest-to-one-third rule fell back on the sentence break at 4.34 s — the
  second caption would have changed mid-sentence. Detection is now −38 dB over
  0.15 s. **Correct in the language you happen to check is how this ships.**
  Every candidate pause is printed for exactly that reason.

## Amendment 2026-08-08: she is alive on Home, and answers a tap

She was a still JPEG with `pointerEvents="none"`. Now:

- **An idle loop.** `assets/abuela/idle.mp4` — breathing, blinking, sitting with
  you. Built by `scripts/fetch-abuela-idle.mjs`, which plays a generated clip
  forward and then backward with both junction frames dropped, so the last frame
  is the NEIGHBOUR of the first and the loop point is seamless by construction.
  Asking a generator to return to its opening pose was tried on the tutorial
  beats and failed; this does not ask. Reversal is only safe because the motion
  has no direction — breathing backwards is breathing. It would not be safe for
  a gesture that goes somewhere. Silent regardless of the sound setting.
- **A tap plays one of her lines, then opens the tutorial.** Eight lines per
  language in her own voice, not the celebration pool — that is a different
  speaker and the illusion dies the moment anyone notices. The push WAITS for
  the line, because the tutorial's narration starts on mount and two recordings
  of the same woman over each other is worse than no line. `playLine` resolves
  on the clip end or a 2.2 s cap. Sound off means no line and no wait. A ref
  guards the second tap, which would otherwise push the tutorial twice.
  Nothing gendered in any line: "mija" assumes the player is a girl, so it is
  out; "mi vida" and "corazón" work for anyone.

She is a touch target now, which the Home layout comment said she must never be.
That comment was about the CTAs and still holds: her band belongs to the hero
card alone, and reaching the card needs s > 1.07 against a solver capped at 1.

### The seam gate, and an absolute threshold getting it wrong a third time
The first version demanded 32 dB and failed a loop for a number nobody had
measured. **PSNR between consecutive frames depends on how much moves and how
hard the file was compressed; no absolute floor survives either.** The gate now
samples the frame-to-frame steps the clip itself takes and fails only if the
loop point is a bigger jump than any of them — her blink is 31 dB, the seam is
35. Verified by installing a non-ping-ponged loop: 26.5 dB against a worst step
of 32.0, and it fails.

The real fix was quality, not the threshold. At CRF 28 the seam genuinely WAS
the largest step, because of quantisation error at the tail of a GOP. CRF 20
takes the file from 0.10 MB to 0.33 MB and the seam from 30.8 dB to 35.0.

### master-voice was discarding re-recordings
It kept an original only if none was stored, so once a clip had been mastered,
**re-recording it did nothing**: the fresh file was overwritten by a re-master of
the stale original, silently, with a success line printed. Three of Abuela's
lines were regenerated and the regenerations were thrown away exactly this way —
the shipped versions of `abuela_es_1..3` and `abuela_en_1..3` are the first
renders, not the second. Same words, same voice, so nothing was lost this time.

It now records the md5 of every file it writes, in `scripts/_voice_orig/.mastered.json`.
A file that is not the output it last wrote is a new recording, and is adopted
as the original. Verified by swapping a clip for a different one: it reported
`re-recorded since the last run, adopted as new originals`, and restoring the
original reproduced the previous output byte for byte.

**The pattern, again:** a script that silently prefers stale input is the same
family as a checker that reads less than the data it checks. Both report success.

## Amendment 2026-08-08: she animated on Android and would not answer a tap

Reported: the idle loop played, the tap did nothing — no line, no navigation.

The Pressable was correct and so was the handler. The picture inside it is a
`VideoView`, which on Android is a NATIVE SURFACE. A native child that is not a
React touch target takes the touch at that point and the Pressable never hears
about it. iOS was forgiving, as it has been every other time this app has hit an
Android/iOS split.

Three changes, and only the first is the diagnosis:

1. **The visual is `pointerEvents="none"`**, so the video is out of hit-testing
   altogether, with a transparent `absoluteFill` View after it so the topmost
   thing under a finger is a view React owns.
2. **`zIndex: 2` and `elevation: 2`.** Android dispatches a touch to the LAST
   sibling whose bounds contain the point, whatever is painted — and everything
   after her in the `today` block is a full-width `Text` or button. The vertical
   gap should hold at every fit scale, but it should not have to.
3. `collapsable={false}` on both wrappers, so Android's view flattening cannot
   remove a View whose only job is to exist for touch.

**This is a diagnosis I could not test.** There is no OTA channel and no device
in this session, so it goes out as a store build on reasoning alone. If the tap
still does nothing after this, the video is NOT the cause and the next suspect
is the parent bounds: Android does not hit-test an absolutely-positioned child
outside its parent's box, and she is absolutely positioned inside `today`.

The third Android/iOS split in this project, all the same shape — Android is
strict where iOS is permissive:
- Android CLIPS children that overflow their parent; iOS draws them.
- Android refuses natively-driven layout properties far more readily.
- Android will not route a touch through a native surface to a JS parent.
