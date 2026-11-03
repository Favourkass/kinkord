# Country check

Kinkord checks that members are in the country they choose. The country
decides real rules (in Nigeria there is no sexuality field and gender is
Male or Female only), and members need to trust where others say they are.
This is the CTO's country verification (2026-11-02): GPS, IP, VPN and device
signals, one coordinated check, decided on the server only.

It makes faking a country much harder. It can't make it impossible, and
nothing here claims to.

## When a check runs

| Moment | What happens |
| --- | --- |
| Joining | Right after step 1 (country), the app explains why, then asks for the location. The account can only be created with an approved check for the chosen country from the last 30 minutes, and each check is spent once (`claimForSignup`). Sign-up's checks are marked `joining`, so a browser still signed in to another account can't turn them into that account's. |
| Signing in | A new session more than 12 hours after the member's last check needs a new one. (Changing the password or two-factor mints a session too, which is why there's a grace period.) |
| Every 30 days | Asked the day before; held from day 30. |
| Connection moves country | When the connection (not a VPN) is in a country that is neither the profile's nor the one their last check accepted, they're asked again, at most once a day. Never held for this alone. |
| Changing country | Edit Profile can only save a new country with an approved check for it (`LOCATION_CHECK_NEEDED`). The app sends the member to the check, which saves the country and state once it passes. The check is spent only once nothing else in the save can refuse it. |

**Asked or held.** The app asks a member whose check is due when they open a page (`GET /location-check/due`, checked at most every two minutes). It never interrupts a page they're in. Only while enforcing does the API also hold them (`LOCATION_CHECK_REQUIRED` on every other route), and only when their check is missing, failed, from before a new sign-in, or over 30 days old. While watching, nobody is ever held.

Founders' and organisation accounts are never checked.

## The four checks

1. **GPS.** The browser's position, asked fresh. Our own server turns it into a
   country with an offline map of borders (`@rapideditor/country-coder`), so no
   map company sees it. Every country within the reading's accuracy counts, so
   border towns match. The coordinates are never stored.
2. **IP.** The address that reached AWS (`clientIpFrom`: the rightmost public
   hop, so a forged `X-Forwarded-For` doesn't count). It is looked up in DB-IP's
   free IP-to-country data, on our own server.
3. **VPN, proxy, Tor and hosting.** Tor's exit list (refreshed hourly) and a
   list of hosting networks (clouds, rented servers, the networks VPNs rent),
   matched by network number and owner name (`hosting-networks.ts`).
   Cloudflare, Akamai and Fastly are deliberately not on the list: Apple's
   Private Relay and Cloudflare's WARP keep the member's real country.
4. **Device signals.** Automation (`navigator.webdriver`), a geolocation
   function that isn't the browser's own (a script or extension answering),
   software or virtual-machine graphics, and the device clock's time zone.

**What a web app can't see.** A PWA can't tell whether a phone is rooted or
jailbroken, or whether a fake-GPS app runs underneath the browser. Only a
store app can (Play Integrity, App Attest), and the app stores don't take
adult apps. Anyone determined can also send the app's signals as they like.
These checks catch the everyday tools; none of them is proof on its own.

## How it decides

`apps/api/src/location-check/country-check-rules.ts`, with a test for every
case:

- The GPS and the connection must both be read. If either can't be, the
  member retries; a failed read never counts as a match.
- **The GPS matching is enough, and so is the connection matching**, even when
  the other disagrees.
- **Neither matching blocks**, with the CTO's message: "⚠️ Your selected
  country does not match your current location. Please select the country
  where you are physically located and try again."
- A connection through a VPN, proxy, Tor or hosting network **never counts as
  a match**, or any VPN would get through. **A VPN on its own never blocks
  someone whose GPS matches.**
- A network-estimated position (worse than 5 km) on such a connection may only
  echo the VPN's location, so it is no match either.
- When the GPS and the device clock agree on one other country, they outweigh
  a connection that alone points at the chosen one. When the connection and
  the clock agree on one other country, they outweigh a GPS that alone does.
- **Clear signs of faking refuse the attempt** (founder, 2026-11-02):
  automation, geolocation answered by a script, a reading no device gives
  (off the globe, zero accuracy, 0,0), or impossible travel (faster than
  1,000 km/h over more than 500 km). The member may try again.
- **Repeated tries pause** for the rest of the day: 5 failures, or more than 3
  different countries, for one member or device. A network address gets 40
  failures, because mobile networks put thousands of people behind one; this
  and the 120-checks-an-hour cap apply to people joining only, never to
  members, who are limited by their own tries.
- **Travellers.** A member away from home keeps their home country, and its
  rules, for 30 days after a check there, wherever they are, so a weekend away
  never forces a country switch (which would drop fields the other country
  doesn't offer). The GPS must be real and the connection must agree with it,
  or be their home network roaming. Nobody joins as a traveller.
- **What the app is told.** Only the decision and a hint for what to do (turn
  off a VPN, allow location, try again). The signals behind it stay on the
  server, so the answer can't be used to tune a fake.

## Modes

Founders switch these on **Moderation → Location**. Other admins can see the
page but not the switch.

- **Off.** No checks. This is how it ships, so the release can't hold
  members whose open app predates it.
- **Watch.** Checks run and are recorded, but nobody is stopped; members can
  choose "Not now". The page shows who would have been stopped.
- **Enforce.** The decisions apply. Members whose last check was only watched
  are asked again.

The plan (founder, 2026-11-02): switch to Watch once the release is live, then
to Enforce after about a week of figures. A switch reaches every server
within 30 seconds.

## What is kept

- `location_check`: each check, for 90 days, then deleted daily. It holds the
  chosen country, the GPS country and accuracy, the connection's country,
  network number and owner, whether it was Tor or hosting, the clock's zone,
  the reasons, and the decision. The address is kept only as a keyed hash
  (for the daily limits), like sign-in failures, plus the app's random
  device id.
- `location_status`: each member's standing. It holds when they last passed
  and for which country, the connection's country on that check, and their
  last precise GPS reading rounded to 0.1° (about 11 km, for impossible
  travel). It is replaced by every check that passes; a refused reading is
  never kept.
- Never stored: coordinates, IP addresses.

The member-facing notice is `/privacy/location`. It also credits DB-IP, as the
data's licence (CC BY 4.0) asks. Like `/privacy/verification`, it is kept out
of search results until legal has read it.

## Data upkeep

`apps/api/src/location-check/ip-data.ts` downloads DB-IP's IP to Country Lite
and IP to ASN Lite (about 18 MB), falling back to last month's early in a
month, three tries each. The API image fetches them at build
(`scripts/fetch-ip-data.mjs`). That is best effort: if DB-IP can't be
reached, the build goes on, and the API fetches the data itself when it
starts, then checks every 6 hours and fetches afresh once it's 40 days old.
Without the data every check asks members to retry; without the network
file, VPN detection is off. The founders' page shows both files' dates and
the Tor list's age.

## Trying it locally

```bash
pnpm --filter api build && node apps/api/scripts/fetch-ip-data.mjs
```

Then start the API with `LOCATION_CHECK_DEV_IP` set to an address in the
country to pretend to be in, e.g. `102.89.32.1` (MTN Nigeria) or
`41.90.64.1` (Safaricom). Production ignores it. Switch the mode by writing
`app_setting` (`location_check_mode`) in the local database.

To test the browser side with a real location, use headless Chrome's
geolocation override (`page.setGeolocation`) rather than replacing
`navigator.geolocation` in the page; the check refuses the latter as a
script answering geolocation. Automation must be hidden too
(`--disable-blink-features=AutomationControlled`).

## Not done, and why

- **A paid VPN detection service** (IPQualityScore, proxycheck.io and the
  like). The founder chose built-in data (2026-11-02), so no other company
  sees members' addresses. Residential proxies get past the hosting list. If
  the Watch figures show VPNs getting through, add a service behind
  `NetworkIntelService`.
- **A manual review queue.** Clear faking refuses the attempt instead
  (founder, 2026-11-02). Moderators see every attempt on the founders' page.
- **Device attestation**, for the reason above.
