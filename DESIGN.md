# Design System Inspired by invoice.bit (Core) × Acctual (Feature Section) × Pro Finance (Footer)

**Sourcing key used throughout this doc:**
- 🅰️ = Site-wide default — header, hero, fonts, buttons, spacing, arrangement (Image A — invoice.bit)
- 🅱️ = One scoped section only — the paper-peel/corkboard feature block (Image B — Acctual)
- 🅲 = Footer only (Image C — Pro Finance)

**Governing rule:** 🅰️ is the system. Fonts, base button style, spacing rhythm, and page arrangement come from invoice.bit everywhere, including inside the 🅱️ and 🅲 sections — only their background color, imagery, and section-specific micro-components (sticky notes, paper curl, newsletter capture) are borrowed. Where a source's screenshot implies a different typeface, that's overridden in favor of 🅰️'s type system, per your brief.

## 1. Visual Theme & Atmosphere

The core identity (🅰️) is clean fintech-meets-crypto: white base, confident black grotesk type, one lilac/purple accent, and a distinctive hand-drawn squiggle underline on emphasized headline words. Its signature visual device is a cluster of tilted, wired-together UI cards in the hero, each shadowed with a hard black diagonal-hatch pattern instead of a blur — a very specific, non-default shadow treatment worth preserving exactly. Against that clean base, one section deliberately breaks the mold: a page-curl transition from a plain white panel into a textured dark-green "corkboard" scene with pinned sticky notes (🅱️), used as a single high-impact feature moment rather than a recurring pattern. The footer (🅲) closes the page in solid black with one lime-green accent, standard multi-column link groups, and an inline newsletter capture.

**Key Characteristics**
- White base with black ink type and one lilac/purple accent color running through the entire core site (🅰️)
- Hard, diagonal-hatch "shadow" pattern behind hero cards instead of blur or offset — a specific, deliberate signature, not a generic drop shadow (🅰️)
- Two headline words per hero statement get a hand-drawn wavy underline in the lilac accent color (🅰️)
- Buttons use a solid twin-rectangle offset (a second black rectangle peeking out behind the button) rather than a soft shadow (🅰️)
- One section only breaks into a dark green, grid-textured "corkboard" scene entered via a curling paper-page transition, with pinned sticky notes as the content device (🅱️, scoped)
- Footer is solid black with a lime-green accent dot on the logo and a lime arrow button on the newsletter field — otherwise fully consistent with the core's type and spacing (🅲, scoped)

## 2. Color Palette & Roles

### Primary (Site-wide) 🅰️
- **Ink** (`#101010`): All text, borders, hero card outlines, primary button fill
- **White Base** (`#FFFFFF`): Page background across the core site

### Accent (Site-wide) 🅰️
- **Lilac** (`#9A87F7`): Headline underline squiggles, "UX research" hero card fill
- **Pale Blue** (`#C6E6F8`): Secondary hero card fill (contacts card)
- **Muted Gray** (`#6E6E6E`): Body copy, card metadata text

### Feature Section Only 🅱️ (does not appear anywhere else on the site)
- **Deep Forest Green** (`#14382C`): Section background
- **Grid Line Green** (`#2C5847`, low opacity): Fine graph-paper texture over the green
- **Paper White** (`#FFFFFF`): The curling top panel — same white as the core base, which is what makes the transition feel seamless
- **Paper Back Gray** (`#D6D6D6`): Underside of the curling page corner
- **Sticky Pink** (`#F28FB0`): "Needs to be paid ASAP" note
- **Sticky Yellow** (`#F5DE58`): "Paid this twice" note
- **Metal Clip Gray** (`#B7B7B7`): Paperclip accents pinning the notes

### Footer Only 🅲 (does not appear anywhere else on the site)
- **Footer Black** (`#0D0D0D`): Footer background
- **Footer Link Gray** (`#9A9A9A`): Secondary link text
- **Lilac** (`#9A87F7`): Logo accent dot, newsletter submit button fill
- **Newsletter Field Fill** (`#1E1E1E`): Email input background

## 3. Typography Rules

### Font Family (site-wide, including inside 🅱️ and 🅲) 🅰️
**Primary (Display):** General Sans, sans-serif — bold, clean grotesk, used for hero and section headlines everywhere on the site, including the feature section and footer headings
Fallback: 'Inter Tight', Inter, sans-serif

**Secondary (UI/Body):** Inter, sans-serif — nav, body copy, buttons, captions, footer links
Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|-----------------|-------|
| Display 1 | General Sans | 52px | 700 | 58px | -0.5px | Hero headline, 3 lines, two words per statement get the lilac squiggle underline 🅰️ |
| Display 2 | General Sans | 40px | 700 | 44px | -0.5px | Feature section headline ("Love you, Pay me." equivalent) 🅱️ |
| Heading 3 | Inter | 15px | 700 | 20px | 0px | Hero card titles, footer column headers |
| Body Regular | Inter | 16px | 400 | 24px | 0px | Hero subhead, section body copy |
| Nav Label | Inter | 15px | 500 | 20px | 0px | Header nav links |
| Button | Inter | 15px | 600 | 20px | 0px | Button text across all contexts |
| Card Meta | Inter | 13px | 400 | 18px | 0px | Hero card addresses, amounts, footer link rows |
| Sticky Note Text | General Sans | 15px | 600 | 20px | -0.25px | Hand-set marker-style feel achieved by italicizing this role slightly, kept in the site's own display face rather than a separate handwritten font 🅱️ |

### Principles
- General Sans carries every display headline sitewide, including inside the feature section and footer — this is the one non-negotiable consistency rule tying all three sources together
- Reserve the lilac squiggle underline for exactly two emphasized words per hero-style headline; don't apply it to body copy or section subheads
- Sticky note text stays in the site's own type family rather than switching to a script/handwritten font — the "handwritten" feel comes from the sticky-note shape and slight rotation, not from the typeface
- Footer headers (Resources/Company) use the same Heading 3 role as hero card titles — no separate footer-only type scale

## 4. Component Stylings

### Buttons — Site-wide Default 🅰️
**Primary Button (Get Started)**
- **Background:** `#101010`
- **Text Color:** `#FFFFFF`
- **Padding:** `14px 28px`
- **Border Radius:** `6px`
- **Border:** none
- **Font:** Inter, 15px, 600
- **Height:** `48px`
- **Signature Shadow:** A second solid black rectangle offset `8px` down-right behind the button, fully opaque, no blur — reads as a "twin rectangle" rather than a soft shadow
- **Hover State:** Button shifts to close the gap with its offset twin, landing flush on press

**Text Link Button (Watch Video)**
- **Background:** none
- **Text Color:** `#101010`
- **Icon:** Circular outline play icon, `18px`, positioned left of the label
- **Font:** Inter, 15px, 500

### Feature Section Button 🅱️ (scoped exception, used only inside the peel section)
- **Background:** `#101010`
- **Text Color:** `#FFFFFF`
- **Padding:** `10px 22px`
- **Border Radius:** `9999px` (full pill — distinct from the core's 6px rectangular button, since this section is visually its own moment)
- **Shadow:** none — this section's depth comes from the paper curl and sticky notes, not from button shadows

### Footer Newsletter Button 🅲 (scoped exception, footer only)
- **Background:** `#D6E62A`
- **Icon:** Black arrow, centered
- **Border Radius:** `10px`
- **Size:** `44px × 44px`
- **Positioned:** Inline, flush against the right edge of the email input

### Cards & Containers

**Hero Card Cluster** 🅰️ (signature component)
- **Background:** Varies per card — White (My Wallet), Pale Blue (Contacts), Lilac (Invoice/UX Research), Ink Black (Received confirmation)
- **Border Radius:** `10px`
- **Border:** none
- **Rotation:** Each card tilted independently, roughly `-4° to 5°`, to suggest a loosely arranged stack
- **Signature Shadow:** A hard, diagonal black hatch-line pattern positioned behind the card (not a blurred shadow) — visible as a stripe field peeking from one edge
- **Connectors:** Thin `1.5px` black wire/line paths connecting related cards, like a flowchart

**Paper-Peel Feature Section** 🅱️ (scoped, one instance only)
- **Structure:** An upper white panel (headline, subcopy, pill CTA) with its top-right corner curling upward in a skeuomorphic page-peel, revealing `#D6D6D6` paper-back underneath
- **Reveal:** Beneath the curl, the page transitions into the `#14382C` grid-textured section
- **Contents of Green Section:** Bold white Display 2 headline, muted white subcopy, and 2-3 pinned sticky notes (rotated `-6° to 8°`, drop shadow soft and dark since they sit on a dark background) plus an optional floating chat-message screenshot card for social proof
- **Sticky Note Shape:** Square-ish, `140-160px`, slight rotation, a small metal paperclip or pin graphic at one corner

**Footer** 🅲 (scoped, structure only)
- **Background:** `#0D0D0D`
- **Layout:** 4-column grid — logo + social icons, Resources links, Company links, newsletter capture
- **Padding:** `64px 48px`
- **Logo Accent:** A small lime-green circle (`#D6E62A`) overlapping part of the wordmark
- **Link Column Header:** Heading 3, white
- **Link Rows:** Card Meta role, `#9A9A9A`, `12px` vertical gaps
- **Newsletter Field:** `#1E1E1E` fill, `10px` radius, paired inline with the lime arrow button

### Inputs & Forms

**Text Input (core site)** 🅰️ (extrapolated — not directly visible, styled consistently with the core button's rectangular language)
- **Background:** `#FFFFFF`
- **Border:** `1.5px solid #101010`
- **Border Radius:** `6px`
- **Height:** `48px`
- **Padding:** `0px 16px`

**Newsletter Input** 🅲 (footer-scoped, see Footer component above)

### Navigation 🅰️

**Primary Navigation**
- **Background:** `#FFFFFF`
- **Text Color:** `#101010`
- **Layout:** Logo + wordmark left, centered nav links, "Log in" (plain text) + "Sign up" (underlined text link) right — no button chrome in the nav itself
- **Padding:** `24px 40px`
- **Font:** Inter, 15px, 500

## 5. Layout Principles

### Spacing System (site-wide) 🅰️
**Base Unit:** `4px`
**Scale:** `4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px`

**Usage Context:**
- `4–12px`: Card meta line spacing, sticky note internal padding
- `16–24px`: Button padding, nav gaps
- `32–48px`: Hero content spacing, footer column gaps
- `64–96px`: Section-to-section spacing, footer vertical padding

### Grid & Container
**Max Width:** `1280px`, centered
**Hero Arrangement:** Two-column split — tilted card cluster on the left, headline/copy/CTA on the right (🅰️)
**Feature Section Arrangement:** Full-bleed, single centered column within the green panel (🅱️)
**Footer Arrangement:** Full-bleed black band, 4-column grid (🅲)

### Whitespace Philosophy
The core site stays open and structured, letting the tilted card cluster feel loosely arranged rather than cluttered. The feature section intentionally tightens up — sticky notes overlapping and layered close together — since that density is part of what sells the "corkboard" feeling. The footer returns to generous, evenly gridded spacing, consistent with the core's calm rhythm.

### Border Radius Scale
- `6px` – Core buttons, inputs (🅰️)
- `9999px` – Feature-section button only (🅱️)
- `10px` – Hero cards, footer newsletter button (🅰️/🅲)
- `140-160px square, slight rotation` – Sticky notes (🅱️, not a radius per se but the section's signature shape)

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Nav, body text, links |
| Hatch Shadow | Hard black diagonal stripe field, no blur | Hero cards (🅰️, signature) |
| Twin Offset | Solid second rectangle, no blur | Core buttons (🅰️, signature) |
| Soft Dark | Standard blurred drop shadow | Sticky notes on the green background (🅱️, since a hatch or twin-offset shadow wouldn't read against a dark textured surface) |
| None | Flat black surface, no elevation | Footer (🅲) |

**Shadow Philosophy:** The core site has two distinct, deliberate shadow signatures — hatch-pattern behind hero cards, twin-rectangle behind buttons — and neither is a generic blur. The feature section is the one place a conventional soft shadow appears, because the sticky notes need to visually lift off a dark textured background in a way neither core signature would achieve. The footer stays flat by design.

## 7. Do's and Don'ts

### Do
- Use General Sans for every headline across all three contexts — this is what keeps the composite from reading as three unrelated pages
- Keep the hatch-pattern shadow and twin-rectangle button shadow exclusive to the core site; don't introduce them into the feature section or footer
- Keep the feature section's dark green palette and sticky notes contained to that one section — never let it bleed into the core white pages
- Keep the footer's lime accent limited to the logo dot and newsletter button — don't spread it elsewhere in the footer or onto the core site
- Rotate hero cards and sticky notes independently and slightly, never perfectly aligned to the grid

### Don't
- Don't give the feature section's pill-shaped button a hatch or twin-rectangle shadow — it uses no shadow device at all, by design
- Don't apply the core's lilac accent inside the feature section or footer; each scoped section keeps its own accent color
- Don't use a handwritten/script font for the sticky notes — the site's own General Sans carries that role, just rotated and shaped like a note
- Don't extend the footer's 4-column structure elsewhere on the site — it's a footer-only pattern
- Don't let the paper-curl transition appear more than once on the page; it's a single dramatic moment, not a repeatable section template

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|--------------|
| Mobile | 375px–599px | Hero card cluster stacks below the headline instead of beside it; feature section sticky notes reduce to 1-2; footer collapses to a single column |
| Tablet | 600px–1023px | Hero split narrows but stays two-column; footer becomes 2-column |
| Desktop | 1024px–1439px | Full layouts as designed across all three contexts |
| Wide | 1440px+ | Max-width 1280px container, centered |

### Touch Targets
- **Minimum:** `44px × 44px` everywhere, including the footer's newsletter arrow button

### Collapsing Strategy
- **Hero (🅰️):** Card cluster and connector wires simplify to a single stacked card or a static illustration below ~768px, since the wired-flowchart arrangement doesn't survive narrow viewports well
- **Feature Section (🅱️):** Paper curl and green reveal stay intact even on mobile — it's a full-bleed moment — but sticky note count drops and the chat-screenshot card is dropped first
- **Footer (🅲):** 4 columns → 2 columns → 1 column as the viewport narrows, newsletter capture always stays visible near the top of the stack

## 9. Agent Prompt Guide

### Quick Color Reference
- **Core:** Ink (`#101010`), White (`#FFFFFF`), Lilac (`#9A87F7`), Pale Blue (`#C6E6F8`)
- **Feature Section:** Forest Green (`#14382C`), Sticky Pink (`#F28FB0`), Sticky Yellow (`#F5DE58`)
- **Footer:** Footer Black (`#0D0D0D`), Lilac (`#9A87F7`)

### Iteration Guide
1. **General Sans is the headline font everywhere** — core hero, feature section, and footer headings all use it; never substitute a different display face for any of the three contexts.
2. **Hero cards get the hatch-pattern shadow; core buttons get the twin-rectangle shadow** — these are the two core signatures and shouldn't appear anywhere outside the core site.
3. **The feature section is the only place the deep green palette and sticky notes exist** — build it as a self-contained full-bleed block, never as a recurring card style.
4. **The footer's lime accent is used in exactly two places**: the logo dot and the newsletter submit button — nowhere else.
5. **Core buttons are 6px-radius rectangles; the feature section's one button is a full pill** — don't unify these into a single button shape across the site.
6. **Rotate hero cards and sticky notes independently** — perfect alignment breaks both signatures.
7. **The paper-curl transition is a one-time device** — don't reuse it as a generic section divider elsewhere on the page.
8. **Footer structure is a 4-column grid (logo/social, Resources, Company, newsletter)** — keep this exact column order when building it out.
9. **Lilac squiggle underlines apply to exactly two words in the hero headline** — don't extend the treatment to the feature section's headline.
10. **Body and UI text sitewide (including inside the footer) is Inter, never General Sans** — the display face is reserved for headlines only.
