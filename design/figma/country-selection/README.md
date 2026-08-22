# Kinkord Country Selection (Desktop) — Figma pull

Pulled 2026-08-19 from Figma via MCP.

- **File:** [KINKORD](https://www.figma.com/design/BIcp5EnoAPjkOBHZ6MNCXo/KINKORD?node-id=168-139)
- **Page:** `168:139` "COUNTRY SELECTION DESKTOP VERSION"
- **Frame:** `170:2` "Kinkord Country Selection — Desktop" — **1440 × 960**
- **Render:** [full-frame.png](full-frame.png)
- **Reference code:** [reference-code.md](reference-code.md) — reference only; adapt per `AGENTS.md`.
- Companions: [`../homepage/`](../homepage/README.md) (mobile) · [`../homepage-desktop/`](../homepage-desktop/README.md)

## What this screen actually is

**Onboarding step 1 of 5** for signup — not a standalone page. It maps directly onto the auth API:

| Design element | API field / feature |
|---|---|
| Country row + radio (`170:12–18`) | profile `country` (feature 004) |
| "I confirm I am over 18." checkbox (`170:21–23`) | `ageAttested` (age gate, enforced server-side) |
| Terms/Privacy/Guidelines checkbox (`170:25–28`) | terms acceptance at signup |
| CONTINUE (`170:30–32`) | proceeds to next signup step |
| "Already have an account? Log in" (`170:33–35`) | login route |
| Step dots 1–5 (`170:43–59`) | signup wizard progress (5 steps total — steps 2–5 designs not in file yet) |

## Layout (top → bottom, all centered)

1. KINKORD wordmark image (`170:38`, 392×77) + tagline (tracking 5, `#faf7ed`)
2. Progress: 5 × 48px circles connected by 1px line — active = filled `#FFB014` circle w/ black numeral; inactive = `#FFC729` outline w/ cream numeral
3. Heading: "SELECT" (Inter Black 42, `#f2f2ed`) / "YOUR COUNTRY" (48, `#ffc729`) + faded gold rule (`#966400` @50%)
4. Country row (800×64, bg `#090908`, border `#382b0f`, radius 14): flag + name (Inter SemiBold 28) + radio SVG — **only Nigeria exists in the design**; the flag is drawn as rects, not an image
5. Confirmation panel (800×208, bg `#090908`, border `#1f1f1c`, radius 18): two 2px `#ffb014` outline checkboxes; "18+" bold; link-colored terms lines in `#ffc729`; `▤` glyph
6. CONTINUE: 600×76, bg `#ffc729`, radius 18, Inter ExtraBold 32 `#020202` + `→`
7. "Already have an account?" `#a1a19c` / "Log in" `#ffc729` + gold accent bar

## Palette additions vs other pulls

| Hex | Usage |
|---|---|
| `#ffc729` | CTA yellow here (≠ `#ffd147` mobile, ≠ `#faab14` desktop CTA — third yellow variant, flag to designer) |
| `#ffb014` | Checkbox borders, active step (close to `#faab14`, not equal) |
| `#382b0f` | Country row border |
| `#1f1f1c` | Panel border/divider |
| `#f2f2ed` / `#a1a19c` | Text / muted (≈ but ≠ `#faf7ed` / `#c2bfb2`) |
| `#966400` | Faded heading rule |
| `#058c4d` / `#f5f5ed` | Nigeria flag green/white (drawn in rects) |

**Color drift keeps growing:** three near-identical yellows and two cream/muted pairs across three screens. Recommend consolidating to one token set at implementation (we'll pick: gold `#faab14`, CTA `#ffc729` or `#ffd147`, cream `#faf7ed`, muted `#a1a19c`) and confirming with the designer.

## Assets

| File | Size | Identity |
|---|---|---|
| `assets/kinkord-wordmark.jpg` | 1280×252 | Tight-crop wordmark (new proportion vs 1280×427 in other pulls; JPEG despite .png serving) |
| `assets/radio-unselected.svg` | 33×33 | Country radio, unselected ring |
| `assets/step-active.svg` | 48×48 | Filled `#FFB014` step circle |
| `assets/step-inactive.svg` | 48×48 | `#FFC729` outline step circle |
| `assets/raw/raw-02.jpeg` | 320×63 | Wordmark small |

No byte-duplicates against the other two pulls (the tight-crop wordmark is new art).

## Implementation notes

- Steps 2–5 of the signup wizard have no designs yet — ask the designer, or we extrapolate from this one (likely: account details → verify email → profile → done).
- Flags: design draws Nigeria's flag in rects; for the 5-country list (Nigeria, US, South Africa, Kenya, Ghana per `constants/landing.ts`) use an emoji/SVG flag set instead.
- The three SVGs are trivial primitives — implement as styled divs/CSS, keep SVGs as reference.
- Radio/checkbox/CTA colors flow from the consolidated token set, not per-screen hex.
