# Profile Picture Expand

Animated click-to-expand viewer for profile pictures. Clicking a profile avatar on the profile page opens a centered, full-screen lightbox that animates from the avatar's on-screen position to the middle of the screen.

---

## Table of contents

- [Overview](#overview)
- [Expected behavior](#expected-behavior)
  - [Trigger](#trigger)
  - [Open animation](#open-animation)
  - [Expanded state](#expanded-state)
  - [Close animation](#close-animation)
  - [No-image fallback](#no-image-fallback)
  - [Reduced motion](#reduced-motion)
- [Accessibility](#accessibility)
- [Files](#files)
  - [New](#new)
  - [Modified](#modified)
  - [Untouched](#untouched)
- [Implementation notes](#implementation-notes)
  - [Why the image is centered](#why-the-image-is-centered)
  - [Why no portal is needed](#why-no-portal-is-needed)
  - [Animation mechanics](#animation-mechanics)
- [Edge cases and guarantees](#edge-cases-and-guarantees)
- [Testing checklist](#testing-checklist)
- [Out of scope](#out-of-scope)
- [Future work](#future-work)

---

## Overview

On `/profile` and `/u/[username]`, the profile picture is displayed twice depending on viewport:

| Viewport | Component | Avatar position |
|---|---|---|
| Mobile / tablet (`< lg`) | `ProfileHero` | Overlay on the cover, bottom-left |
| Desktop (`≥ lg`) | `ProfileSideCard` | Overlay on the card cover, top-left |

Both avatars become clickable. Clicking either opens the same animated lightbox.

The feature is purely presentational — it does not call any API, does not change profile data, and does not require any new backend support. It works with the existing `vm.avatarUrl` (presigned S3 URL) already provided by `useOwnProfilePresenter` / `useMemberProfilePresenter`.

---

## Expected behavior

### Trigger

1. The avatar renders as a circular image, exactly as before this feature — same size (`100px` on the profile page, `98px` in the edit hub), same ring, same position.
2. The cursor over the avatar is `cursor-zoom-in` (a magnifier with a `+`).
3. The avatar is a `<button>`, not a plain `<img>`. It is focusable by keyboard and activatable with `Enter` or `Space`.
4. Clicking anywhere on the avatar opens the lightbox. Clicking outside the avatar does nothing.
5. The follow `+` badge (on `ProfileSideCard` for other members) sits **on top of** the avatar and is **not** part of the trigger. Clicking the badge toggles follow and does **not** open the lightbox.

### Open animation

1. On click, the small circular avatar smoothly expands into a large circular image at the center of the viewport.
2. The animation is a spring, not a linear tween: `stiffness: 320`, `damping: 32`, `mass: 0.9`. It settles in roughly 350–500 ms.
3. Simultaneously, a dark backdrop (`bg-black/90` with `backdrop-blur-md`) fades in from `opacity: 0` to `opacity: 1` over `200 ms`.
4. The image animates **from the exact on-screen rect of the avatar** — not from a fixed corner. Position, size, and shape interpolate together, so on a phone the avatar appears to "grow out of" the cover, and on desktop it "grows out of" the side card.
5. The page underneath does **not** scroll, shift, or reflow during the animation. Only the avatar and the backdrop move.

### Expanded state

1. The image is centered on **both axes** of the viewport.
2. The image is a perfect circle (equal width and height) sized at `min(90vw, 90dvh, 480px)`:
   - On a small phone (e.g. 375 × 667), that's `337.5px` — 90% of the narrowest axis.
   - On a large desktop (e.g. 1920 × 1080), that's capped at `480px`.
3. The image is fully visible — it never overflows any viewport edge, at any orientation.
4. The image uses `object-cover`, so it fills the circle without distortion.
5. A soft drop shadow (`0 24px 80px rgba(0,0,0,0.6)`) separates the image from the backdrop.
6. The backdrop covers everything else on the page, including the mobile tab bar and desktop top nav.
7. The cursor over the expanded image is `cursor-zoom-out` (a magnifier with a `−`).
8. `Escape` closes the viewer.
9. Clicking the backdrop closes the viewer.
10. Clicking the image itself also closes the viewer (same affordance as the backdrop — this is a single-image viewer, not a gallery).
11. Body scroll is locked: `document.body.style.overflow = "hidden"` for the duration of the expanded state, restored to its prior value on close.
12. Focus moves to the close button. Pressing `Tab` keeps focus inside the dialog (the only focusable elements are the close button and the image).

### Close animation

1. On close (backdrop click, image click, or `Escape`), the large image animates back to the exact on-screen rect of the original avatar.
2. The backdrop fades out over `200 ms` in parallel.
3. The page scroll position is unchanged.
4. Body scroll is re-enabled.
5. Focus returns to the avatar button that opened the viewer.
6. If the underlying avatar has been unmounted in the meantime (e.g. the tab changed while the viewer was open), the close animation falls back to a simple fade-out at the center — the page does not error.

### No-image fallback

When `vm.avatarUrl` is `null` (member has not uploaded a photo):

1. The placeholder (the `people` mask icon inside a `bg-pf-surface-2` circle) renders exactly as today.
2. The placeholder is **not** clickable, is not a `<button>`, and does not open the lightbox.
3. The cursor stays default.

This is intentional: there is nothing to expand.

### Reduced motion

When the OS reports `prefers-reduced-motion: reduce`:

1. All spring and fade durations collapse to `0`.
2. The avatar still expands to the center and the backdrop still appears — the state change is preserved.
3. There is no visible animation; the viewer simply appears and disappears.
4. No layout shift, no flicker, no partial frames.

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Keyboard reachable | The avatar is a native `<button>`; it appears in the tab order exactly where the `<img>` used to be. |
| Keyboard activatable | `Enter` and `Space` open the viewer (native button behavior). |
| Close by keyboard | `Escape` closes the viewer. |
| Focus management | Focus moves to the close button on open and back to the avatar on close. |
| Modal semantics | The overlay is `role="dialog"` with `aria-modal="true"`. |
| Labeled dialog | `aria-label` is set to the member's display name. |
| Backdrop button | The backdrop `<button>` has `aria-label="Close"`. |
| Image is decorative inside the dialog | The expanded `<img>` has `alt=""` because the dialog already carries the name; this avoids double-announcement. |
| Trigger label | The avatar button has `aria-label="View {displayName}"` so screen readers announce the action, not just the image. |
| Motion safety | `useReducedMotion()` disables all animation when the OS preference is set. |

Not yet implemented (see [Future work](#future-work)):

- A true focus trap. Currently focus can still leave the dialog via the browser chrome or by tabbing to the (visually-hidden but still focusable) mobile tab bar if it isn't fully covered. In practice the `fixed inset-0` overlay makes this a non-issue for the current design, but a full trap is the correct next step.

---

## Files

### New

```
components/profile/ExpandableAvatar.tsx
```

A self-contained client component. Owns the open/closed state, the body scroll lock, the `Escape` handler, and both the trigger and the lightbox. Renders nothing when `src` is `null`.

### Modified

```
components/profile/ProfileHero.tsx
components/profile/ProfileSideCard.tsx
```

In each file, the avatar `<img>` (inside the absolutely-positioned wrapper) is replaced by `<ExpandableAvatar />`. The surrounding ring `<span>`, the cover image, the follow badge, the presence text, and every action button below are unchanged. The avatar's on-screen box (`100px`, offset `left-[5px] top-[8px]`) is identical before and after.

### Untouched

```
app/profile/page.tsx
app/u/[username]/page.tsx (if present)
components/profile/ProfileScreen.tsx
components/profile/ProfileShell.tsx
components/profile/ProfileTopNav.tsx
components/profile/ProfileNavBar.tsx
components/app/AvatarCircle.tsx
components/profile/edit/EditHub.tsx
components/profile/edit/EditPhotos.tsx
presenters/useOwnProfilePresenter.ts
presenters/useMemberProfilePresenter.ts
domain/member.ts
app/globals.css
package.json
```

No new dependencies. No new design tokens. No CSS changes.

---

## Implementation notes

### Why the image is centered

The overlay is:

```tsx
<motion.div className="fixed inset-0 z-[100] flex items-center justify-center">
  <button className="absolute inset-0 ..." />            {/* backdrop */}
  <motion.img className="relative z-[1] h-[min(90vw,90dvh,480px)] w-[min(90vw,90dvh,480px)] ..." />
</motion.div>
```

Three things combine to guarantee centering on any device:

1. **`fixed inset-0`** — the overlay is pinned to the viewport, not to any scrolling or positioned ancestor. Its origin is always `(0, 0)` of the visual viewport.
2. **`flex items-center justify-center`** — the image is the only in-flow child (the backdrop is `absolute`), so flexbox places it at the exact horizontal and vertical center.
3. **Equal explicit `w` and `h`** — `min(90vw, 90dvh, 480px)` on both axes. Because width equals height, the flex box has no reason to stretch one axis, and the circle stays a circle.

The unit `dvh` (dynamic viewport height) is used instead of `vh` so the image stays centered and fully visible when mobile browser chrome (address bar) is shown or hidden.

### Why no portal is needed

A common failure mode for centered overlays is an ancestor with `transform`, `filter`, `perspective`, or `will-change` — that turns the ancestor into the containing block for `position: fixed`, and the overlay gets clipped or offset.

I checked the chain from the avatar up to `<body>`:

- `ProfileSideCard` → `<section className="... overflow-hidden ...">` — has `overflow-hidden` but no `transform`. `overflow` does **not** affect `position: fixed` containment, so this is safe.
- `ProfileHero` → `<section>` with only layout utilities.
- `ProfileShell` → layout divs only.
- `ProfileScreen` → layout divs only.

No ancestor establishes a containing block for `fixed`. Therefore the overlay is reliably viewport-anchored without a `createPortal` call. If a future refactor adds `transform` to any of those wrappers, the fallback is to render the lightbox through `createPortal(..., document.body)` inside `ExpandableAvatar` — a change confined to that one file.

### Animation mechanics

The open/close animation uses framer-motion's shared-layout feature:

- The trigger and the expanded image share the same `layoutId` (derived from `useId()`, so multiple avatars on one page never collide).
- When the avatar is clicked, the trigger unmounts and the lightbox image mounts in the same render. Framer Motion sees the same `layoutId` disappearing from one place and appearing in another, and animates between their measured rects automatically.
- When the lightbox closes, the reverse happens: the image unmounts, the trigger remounts, and motion animates back.
- The spring transition is applied to both the trigger and the image, so both directions look symmetric.

The backdrop is a plain opacity fade driven by `AnimatePresence` with a `200 ms` tween, independent of the spring. This keeps the "darken" feeling immediate while the image does the spatial travel.

---

## Edge cases and guarantees

| Case | Behavior |
|---|---|
| `avatarUrl` is `null` | Placeholder renders; not clickable; no lightbox. |
| Very small viewport (320 × 480) | Image is `288px` — 90% of width. Fully centered and visible. |
| Very large viewport (4K) | Image is capped at `480px`. Centered. |
| Landscape phone (667 × 375) | Image is `337.5px` — 90% of height. Fits. |
| Browser chrome shows/hides during scroll on mobile | `dvh` keeps the image centered and fully visible. |
| User opens viewer, then the route changes | Body scroll is restored via the effect cleanup; no leak. |
| User opens viewer, then the avatar unmounts (tab switch) | Framer Motion animates the close to the center rather than throwing. Focus restoration is a no-op. |
| Rapid double-click | `setOpen(true)` is idempotent; no double-mount, no animation glitch. |
| `prefers-reduced-motion: reduce` | All durations are `0`; state still changes. |
| Multiple profiles on one page | Each `ExpandableAvatar` has its own `layoutId` via `useId()`; no cross-talk. |
| Backdrop is `z-[100]` | Above mobile tab bar (`z-50`-ish) and desktop top nav. |
| Body scroll | Locked while open; restored to its exact prior value on close. |

---

## Testing checklist

Manual checks on both `/profile` and `/u/[username]`:

- [ ] Mobile: tap the hero avatar → expands to center, backdrop fades in.
- [ ] Desktop: click the side-card avatar → expands to center, backdrop fades in.
- [ ] Press `Escape` → closes, returns to the avatar.
- [ ] Click the backdrop → closes.
- [ ] Click the expanded image → closes.
- [ ] Tap the follow `+` badge on someone else's side card → toggles follow; the lightbox does **not** open.
- [ ] Tab to the avatar and press `Enter` → opens.
- [ ] While open, try to scroll the page behind → nothing moves.
- [ ] After close, scroll the page → scroll position is where it was.
- [ ] Member with no avatar → placeholder shows; clicking does nothing.
- [ ] Enable "Reduce motion" in OS settings → open/close are instant but still correct.
- [ ] Rotate the device while open → image stays centered and fully visible.
- [ ] Open on a 320px-wide viewport → image fits with margins on all sides.
- [ ] Open on a 1920px-wide viewport → image is capped at `480px` and centered.

Automated (Vitest + Testing Library) — recommended additions:

- [ ] `ExpandableAvatar` renders nothing when `src` is `null`.
- [ ] Clicking the trigger opens a `role="dialog"`.
- [ ] `Escape` closes the dialog.
- [ ] Clicking the backdrop closes the dialog.
- [ ] `document.body.style.overflow` is `"hidden"` while open and restored on close.
- [ ] With a mocked `useReducedMotion` returning `true`, the transition duration is `0`.

---

## Out of scope

- Expanding the **cover photo** — separate decision; the same pattern would apply but the aspect ratio is different.
- Expanding **avatars in lists** (`PeopleTab`, `SuggestedFriends`, `MediaTab`, `EditHub`, `EditPhotos`, `ProfileTopNav`). The primitive `AvatarCircle` is intentionally left untouched so a 30–36px row avatar does not open a fullscreen viewer when tapped in a scrolling list.
- Expanding avatars inside **edit** screens (the camera preview in `EditHub` / `EditPhotos`). Those are edit affordances; a click there should open the file picker, not a viewer.
- **Pinch-to-zoom** or panning the expanded image. The image is fixed at `object-cover` inside the circle.
- **Gallery navigation** (swipe between photos). This is a single-avatar viewer; the Media tab already has its own lightbox with delete affordances.
- **Download / share / report** actions on the expanded image.

---

## Future work

1. **Extend to `AvatarCircle`.** Add an optional `expandable?: boolean` prop to `components/app/AvatarCircle.tsx` that delegates to `ExpandableAvatar` when `true`. This gives the top-nav "My Account" avatar, the `EditHub` identity preview, and the `EditPhotos` avatar preview the same behavior with one small change and zero call-site churn. Row avatars in `PeopleTab` / `SuggestedFriends` would stay `expandable={false}` because a fullscreen viewer from a 48px list row is hostile.
2. **Full focus trap.** Replace the ad-hoc `Escape` handler with a proper trap (e.g. `focus-trap-react`, or a small `useFocusTrap` hook) so `Tab` cycles strictly between the close button and the image and never reaches the page behind.
3. **Cover photo variant.** A sibling `ExpandableCover` component for the cover image, reusing the same layout-id mechanism with a `2:1` (or native aspect) expanded shape instead of a circle.
4. **Portal fallback.** If any ancestor of the avatar ever gains a `transform`/`filter`, switch `ExpandableAvatar` to render the lightbox through `createPortal(..., document.body)`. The change is contained to that one file; no call site needs to change.
5. **Preload.** For very large avatars, add `<link rel="preload" as="image">` or an off-screen `<img>` with `loading="eager"` on hover/focus so the expanded image is decoded before the animation starts. Current presigned S3 URLs are already small enough that this is optional.
6. **Analytics.** If product wants it, fire an event on open (`profile_avatar_expand`) with the member's `userId` and viewport class. Not currently wired.