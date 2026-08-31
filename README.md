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
api/request.mjs         serverless endpoint behind the request form (see below)
```

The standalone `robot-reveal/` component and the original `robot-reveal.zip`
upload are kept out of this repo on purpose — they live in the working folder
and nothing the site serves depends on them.

## What came from the old site

Everything factual is carried over verbatim or close to it: the tagline, the
three pillars (curriculum & activities, network, promo materials), the four
steps, the 24-hour delivery promise, the founding year, the club network,
the three founders, `clubs.codespark@gmail.com`, and the "creating the next
generation of technology leaders" line.

## Things you should check before publishing

1. **The `$0` stat.** The old site never states a price, but it gives materials
   away through a request form, so the homepage says the club costs nothing to
   run. If that's wrong, edit the fourth `.stat` block in `index.html`.
2. **The stats row.** 128+ schools, 2,700+ students, 8 countries, $0 — the
   figures Armaan supplied. Each tile is a `data-count` attribute in
   `index.html`; add `data-plus` for a trailing "+" and `data-group` for a
   thousands separator. The same numbers appear in the hero meta row and in the
   last line of the About timeline, so update all three together.
3. **Meeting counts on the kit modules.** "4 meetings", "5 meetings" and so on
   are placeholders describing a semester's shape. Replace with the real module
   lengths.
4. **The gallery photos are stock.** They're tagged by session type rather than
   by event, so nothing claims to be a real CodeSpark meeting. Swap in real club
   photos when you have them and the tags will still read correctly.
5. **The request form needs one environment variable to go live.** See
   "Request form email" below. Until it is set the form still works — it falls
   back to a pre-filled mail draft.

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
| Type | Archivo at width 118 (display), Instrument Sans (body), Martian Mono at width 78 (labels). Deliberately not Inter/Space Grotesk/Unbounded — the width axes are what keep it off the default startup shelf. The two axis values live in `--wide` and `--narrow`. |
| Motif | the aperture: a circle that opens onto what's inside |

Photography is graded to match — 88% grayscale, contrast up, brightness
down — so no stock photo drags a colour cast into the scheme.

The accent is deliberately not the lime green from Lando Norris's site, and
deliberately not the purple-blue gradient every AI landing page uses.

## Motion

Twenty-five named patterns, listed and explained at the top of
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

### Ambient life

Patterns 1-22 are all *transitions into* something: they fire once at a
boundary and then the section holds still. A page built only of those reads as
static no matter how many of them there are, which is exactly how this one
read. Three patterns run continuously instead:

- **23 Drift Plates** — every photograph rides slower than the frame holding
  it, at one of three depths so no two neighbours track together. The images
  are oversized and offset in CSS (`height:118%; top:-9%`) purely to give the
  plate headroom to travel through without exposing an edge. Note the hover
  scale on `.shot img` / `.door__bg img` uses the independent `scale` property,
  not `transform: scale()` — GSAP owns `transform` for the drift, and the two
  compose only if they stay on separate properties.
- **24 Idle Respiration** — the hero breathes on a slow sine. The pin timeline
  drives `.hero__figure`, so this animates `#heroReveal` *inside* it and the
  transforms compose rather than fight.
- **25 Current Run** — a charge travels the length of every section rule.

Everything degrades: `prefers-reduced-motion` gets a full static page with the
horizontal steps stacked and no section transitions at all, touch devices skip
the cursor and pin, and if the CDNs fail the page still renders and reads in
full (nothing is hidden in CSS that only JavaScript can bring back).

## Performance

The page holds a locked 60fps with no frame over 32ms anywhere in a full-page
scroll (worst frame 18.7ms). It did not start that way — it had hitches of
250-350ms at the hero and the gallery, which read as "glitchy". The cause was
not JavaScript (there were no long tasks): it was image decode. Every photo
shipped at 1500px regardless of the ~260-630px it actually rendered at, and the
two robot cutouts were 2.8MB of PNG.

So, if you add images: **size them to what they actually render at** (2x for
retina) and keep the cutouts as WebP. The robot pair went 2.8MB → 134KB with
the alpha mask intact. Everything together went 6.7MB → 2.0MB. Every `<img>`
also carries `decoding="async"` so decode stays off the main thread.

## The robot

`robot-exterior.webp` and `robot-interior.webp` are what the page actually
loads. `robot-exterior.png` and `robot-interior.png` are kept as the lossless
masters they were derived from — nothing references them at runtime, so if you
re-cut the mattes, edit the PNGs and re-export the WebPs from them.

The PNGs are the two source frames with the
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


## Request form email

`api/request.mjs` runs on every submission and sends two emails through
[Resend](https://resend.com):

1. **The materials email**, to the requester: the Google Drive link, the
   `sparkresources.github.io` address and its password. This is the whole
   point of the form — people get the materials immediately instead of waiting
   on someone to send them by hand.
2. **The submission**, to `clubs.codespark@gmail.com`, with `Reply-To` set to
   the requester, so every request is filed and searchable and hitting reply
   just works. It leads with whether the materials email actually reached the
   requester, and if it did not the subject is prefixed `[ACTION NEEDED]` —
   a silent delivery failure would otherwise look exactly like a success.

The link, the resources URL and the password are three constants at the top of
`api/request.mjs`. Rotating the password is a one-line edit there.

### Turning it on

**`RESEND_API_KEY` and `MAIL_TO` are already set** on the Vercel project across
production, preview and development, and the endpoint has been tested
end-to-end. What follows is what they are and how to change them.

1. Keys are created at resend.com/api-keys (the one in use is send-only).
2. In the Vercel project → Settings → Environment Variables:

   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the key from step 1 (required) |
   | `MAIL_FROM` | a verified sender, e.g. `CodeSpark Clubs <clubs@yourdomain>`. Without a verified domain, leave it unset and Resend's shared `onboarding@resend.dev` sender is used — fine for testing, but it will land in spam more often. |
   | `MAIL_TO` | where submissions are filed. Defaults to `clubs.codespark@gmail.com`. |

3. Redeploy.

Until `RESEND_API_KEY` exists the endpoint returns 503 and the front end falls
back to a mail draft, so the form is never broken while the key is missing —
it just stops being automatic.

### The one thing still outstanding: a verified domain

Without `MAIL_FROM` pointing at a domain you own, mail goes out through
Resend's shared `onboarding@resend.dev` sender, which **only delivers to the
Resend account owner's own address**. In practice that means submissions reach
`clubs.codespark@gmail.com` fine, but the confirmation to a student's address
will be rejected.

The endpoint is built to survive that: filing the submission and sending the
confirmation are separate, and a failed confirmation is logged and reported as
`{ok:true, confirmed:false}` rather than failing the request. Nobody loses a
request over it. But confirmations stay off until a domain is verified at
resend.com/domains and `MAIL_FROM` is set to an address on it.

### A note on the password

The materials email sends `sparkresources.github.io`'s password to anyone who
completes the form, which is deliberate — the materials are free and the email
explicitly asks people to pass them on. Just be aware that it makes the
password effectively public, so it should not protect anything that is not
meant to be freely shared. To rotate it, change `RESOURCES_PASSWORD` in
`api/request.mjs` and the site it guards.
