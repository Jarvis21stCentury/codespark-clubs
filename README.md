# CodeSpark Clubs — homepage redesign

A rebuild of [codesparkclubs.github.io](https://codesparkclubs.github.io) with the
structure and interaction density of [landonorris.com](https://landonorris.com),
its own colour system, and the robot face-reveal as the signature moment.

The hero follows Lando's logic directly: one subject, cut out of its
background, centred at full height, with the wordmark crossing it — printed
twice, once behind the machine and once in front of its chest.

Static site. No build step, no dependencies to install.

## Run it

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` from the filesystem mostly works, but serve it over HTTP if
you want the pinned scroll scenes to measure correctly.

## Deploy

Static, no build step, so Vercel serves the repo root as-is:

```bash
vercel --prod
```

## Files

```
index.html              the homepage
assets/css/site.css     design system + all layout
assets/css/robot-reveal.css
assets/js/site.js       the motion system (documented at the top of the file)
assets/js/robot-reveal.js
assets/img/             robot pair (.png cutouts, .jpg originals) + 24 Pexels photos
```

The standalone `robot-reveal/` component and the original `robot-reveal.zip`
upload are kept out of this repo on purpose — they live in the working folder
and nothing the site serves depends on them.

## What came from the old site

Everything factual is carried over verbatim or close to it: the tagline, the
three pillars (curriculum & activities, network, promo materials), the four
steps, the 24-hour delivery promise, the founding year, the seven countries,
the three founders, `clubs.codespark@gmail.com`, and the "creating the next
generation of technology leaders" line.

## Things you should check before publishing

1. **The `$0` stat.** The old site never states a price, but it gives materials
   away through a request form, so the homepage says the club costs nothing to
   run. If that's wrong, edit the fourth `.stat` block in `index.html`.
2. **The stats row.** The old About page has counters for schools, students and
   states that all display zero. Rather than invent numbers, this row uses four
   figures the site already publishes: 7 countries, 24 hours, founded 2025, and
   the $0 above. Swap in real school/student counts when you have them —
   each tile is a `data-count` attribute.
3. **Meeting counts on the kit modules.** "4 meetings", "5 meetings" and so on
   are placeholders describing a semester's shape. Replace with the real module
   lengths.
4. **The gallery photos are stock.** They're tagged by session type rather than
   by event, so nothing claims to be a real CodeSpark meeting. Swap in real club
   photos when you have them and the tags will still read correctly.
5. **The request form has no backend.** Submitting it opens a pre-filled mail
   draft to `clubs.codespark@gmail.com`. If you want real form handling, point
   it at Formspree, Netlify Forms or a Google Form — the handler is at the
   bottom of `assets/js/site.js`.

## Design system

BMW Individual "Frozen Black". Matte paint scatters light instead of
returning it, so nothing in here is pure `#000` and nothing carries a
specular highlight.

| | |
|---|---|
| Ground | `#0b0c0d` void, `#121416` graphite, `#191b1e` carbon — matte body panels, faintly cool |
| Accent | brushed aluminium trim, `#eef0f3` → `#c3c9d1` → `#79808a`. The only material on the page that shines |
| Signal | `#d8452a` ember, used like a brake caliper behind a matte wheel: rarely, and small |
| Finish | a fixed grain sheet plus an edge vignette, both over the whole page |
| Type | Unbounded (display), Space Grotesk (body), JetBrains Mono (labels) |
| Motif | the aperture: a circle that opens onto what's inside |

Photography is graded to match — 88% grayscale, contrast up, brightness
down — so no stock photo drags a colour cast into the scheme.

The accent is deliberately not the lime green from Lando Norris's site, and
deliberately not the purple-blue gradient every AI landing page uses.

## Motion

Twenty-two named patterns, listed and explained at the top of
`assets/js/site.js`. The signature is **Ignition Reveal**: on desktop the hero
pins, scroll progress opens the robot's face panel, and the cursor steers where
inside the head you're looking. Two inputs on one object.

The kit cards reuse the same aperture at card scale, and the custom cursor
becomes that aperture when it's over one — the repetition is what makes the page
read as one piece rather than a list of effects.

### Section transitions

Ten boundaries, ten different mechanics, none repeated — a shutter, a raking
blade, a centre split, a fanned deck, an iris, a rack, a tilt, a shear, a warp,
a drawer. Each one is authored around what the section actually is: the stats
row is four panels, so it splits; the gallery is a stack of prints, so it fans;
the kit is six modules to be loaded, so they slide in like trays into a rack.

What keeps ten different moves reading as one page is **the seam** — a single
trim line drawn across every boundary as you cross it, alternating direction.

All ten are additive. The elements they animate behind (the blade, the seams)
are injected by JavaScript, so with JS off there is simply nothing to hide
behind and every section renders in full.

The whole page runs off one tempo dial — `TEMPO` at the top of
`assets/js/site.js`. Every duration, stagger and scrub is authored in base
seconds and multiplied through it, so the pace of the site is one number.

Everything degrades: `prefers-reduced-motion` gets a full static page with the
horizontal steps stacked and no section transitions at all, touch devices skip
the cursor and pin, and if the CDNs fail the page still renders and reads in
full (nothing is hidden in CSS that only JavaScript can bring back).

## The robot

`robot-exterior.png` and `robot-interior.png` are the two source frames with the
studio background matted out (Vision subject mask, eroded ~1px and feathered so
the dark background leaves no fringe). Both were matted with the *exterior's*
mask — only the face region differs between the frames, so the silhouettes
match. The `.jpg` originals are still there and still used by the kit cards and
by the standalone component in the working folder, which is framed and wants
its black ground.

## Photography

All photos from [Pexels](https://www.pexels.com), free to use under the Pexels
licence, no attribution required. Filenames keep the Pexels photo ID
(`px-8199134.jpg` → `pexels.com/photo/8199134`) so you can trace any of them.
