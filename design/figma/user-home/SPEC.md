# Post-login app — design spec (pulled 2026-08-31)

File `BIcp5EnoAPjkOBHZ6MNCXo`, page `0:1`. Frames: home mobile light `344:138` /
dark `370:28`; sidebar drawer open light `570:1822` / dark `570:1855`; edit
profile mobile light `396:345` / dark `396:215`; home desktop light `373:25` /
dark `374:69`; edit desktop light `402:813` / dark `411:157` (dark = same layout
+ dark tokens). Mobile ref 440×874, desktop ref 1280×832. Font: Inter everywhere.

## Theme tokens (light / dark)

- page bg (desktop, behind panels): #f5f5f5 / #090908
- panel & mobile bg: white / black
- text: black / white
- subtle text (subcopy): #616161 / #b4b4b4
- input bg: #f6f6f6 / black; input border: #616161 both; value text #090909 / white
- divider hairline: #E9E9E9 / #464242
- drawer bg: white / #1c1b18; drawer border: #eae6dc / #322f28
- members row bg: #fff6e4 / #26221a; members count: #b8850f / #ffba1f
- drawer name: black / #f2efe8; handle: black(Light 13 tr 2px) / #8c8778
- logout text: #1f1f1d / #d08464; logout icon stroke: #B8850F / #D08464
- people icon: #B8850F / #FFBA1F; drawer chevron: #B8850F both
- gold: #ffba1f (headline COMING SOON 36 Bold, shadow rgba(255,148,13,.25) light /
  .5 dark); wordmark text #faab14; save button #faab14, black text
- tab bar avatar ring: #464242 (46px circle behind 44px photo)

## Home (mobile, 440w)

Header: hamburger 40px @ (15,29); KINKORD Inter EB 48 tracking 4.8 #faab14
centered top 23; subtitle "THE WORLD'S KINK COMMUNITY" SB 10 tracking 2 under it
(top 75); greeting "Hi {name}, Welcome 🤗" Reg 12 @ (15,98); divider @ y124.
Body: COMING SOON Bold 36 centered top 168; illustration ~314×373 top 251;
"Kinkord is under construction" SB 22 (construction in gold) top 640; subcopy
Bold 13 top 681 w263. Tab bar: divider @760.5; icons 43px message(60,783) /
settings(334,781); avatar 44 rounded + ring 46 center (197,784); labels Med 14
@ y829-836 (Messages, Profile, Settings).

## Sidebar drawer (mobile, over home)

Panel 348w × ~769h left, bg/border per tokens. Gold banner 311×84 r16 @ (18,29)
(gold-metallic.png, object-cover). Avatar ring 123 gold #FFBA1F + photo 117 @
(112,49) overlapping banner. Name Bold 32 centered @178; handle Light 13 tr2
@217. Members row 311×52 r16 @ (18,261): people 24 @ (36,274), "Members" Med 18
@ (84,276), count Med 14 @ right 255, chevron 21 @ (291,277). Log Out row (no
bg): icon 24 @ (33,332), label Med 18 @ (84,332). Rest of screen dimmed.

## Home (desktop, 1280w)

Page bg token; left sidebar 385w (page-bg colored, or #f5f5f5 block on light):
wordmark raster 315×83 @ (49,23-30), subtitle SB 12 tr2 @ (78,98), divider @126
(x33 w348), nav rows: icon 67 @ x53 + label Med 36 @ x154 — Profile y~162/173,
Settings y~265/275. Main panel rounded-40 white/black from x398 w881 full-h:
avatar ring 84 + photo 80 @ panel (21,17); "Hi {name}, Welcome" Reg 24 @
(526,36) abs; COMING SOON Bold 36 center x835 top 149(light)/173(dark);
illustration ~350×416 @ (670,220); construction line SB 22 @ y649; subcopy y690.
(Desktop edit frame's sidebar shows Edit Profile + Log Out — we unify: Profile,
Settings, Log Out with active state.)

## Edit profile (mobile)

Cover: gold-metallic full-width band 0..~121+ (image, object-cover); back
chevron 40 @ (29,44); cover pencil badge (circle 26 black/white-stroke + white
pencil 14) top-right (395,18). Sheet bg (white/black) rounded-t-40 from y121.
Avatar ring 123 + photo 117 @ (161,96) overlapping; avatar pencil badge @
(210,203). "Edit Profile" Med 24 @ left 28 y158. Labels Bold 14; inputs h41 r10
(bg/border per tokens), value Light 15. Rows: [Display Name | Username] 156w ×2
@ y247/268; Gender y316/337; Relationship Status y381/402; Role y450/471;
Looking for y528/549; Interests y606/627; Address y680/701 (full 382w).
SAVE CHANGES: #faab14 382×64 r10 @ y766, label Bold 20 black.

## Edit profile (desktop)

Sidebar as home. Main: gold cover band across main area (~235h, dimmed
rgba(0,0,0,.26) in light), sheet rounded-40 from y235; avatar ring 139 + photo
133 @ (454,91) with black pencil/camera badge; fields 2-col: [Display Name |
Username] @ y267/288 (318w), [Gender | Relationship Status] @ y341/362 (317w),
then full-width 737w: Role y410/431, Looking for y488/509, Interests y566/587,
Address y640/661. SAVE 382×64 @ (645,735).

## Data / API

Fields: displayName, username(@), gender, relationshipStatus (NEW),
role (existing roles[] shown joined), lookingFor (NEW, comma list),
interests (NEW, comma list), address/location (NEW single line, e.g.
"Sapele, Delta State, Nigeria"). Members count in drawer (128) → GET
/community/stats { members } (count of user rows). Greeting name + avatar from
existing /me + profile VM.

## Assets staged

`apps/web/public/app/`: wordmark-light.png (704×1490 source, crop object-cover
to 315×83 box), wordmark-dark.png (1280×427), construction-light.png
(1122×1402), construction-dark.png (2298×1368), gold-metallic.png (580×580,
shared by banner + covers). Icons inlined as components (see
`assets/svg/*` here): hamburger, message, settings(43 filled), user, people,
logout, chevron 21, back chevron 40, pencil + badge circle. Emoji 🤗 rendered
natively (design used raster Apple emoji).
