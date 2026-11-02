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
| Joining | Right after step 1 (country), the app explains why, then asks for the location. The account can only be created with an approved check for the chosen country from the last 30 minutes, and each check is spent once (`claimForSignup`). |
| Signing in | Each new session needs a check made after it started. The auth guard holds the member (`LOCATION_CHECK_REQUIRED`), and the app takes them to `/location-check` and back. |
| Every 30 days | The same hold. |
| Connection moves country | When the member's connection (not a VPN) is in another country, they're asked again, at most once a day. |
| Changing country | Edit Profile can only save a new country with an approved check for it (`LOCATION_CHECK_NEEDED`). The app sends the member to the check, which saves the country and state once it passes. |

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
  failures, because mobile networks put thousands of people behind one.
  Separately, a connection sending more than 120 checks an hour is refused.
- **Travellers.** A member abroad outside Kinkord's countries keeps their home
  country, and its rules, for 30 days after a check at home. In another of
  Kinkord's countries, they switch to it. Nobody joins as a traveller.

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
  and for which country, and their last precise GPS reading rounded to 0.1°
  (about 11 km, for impossible travel), replaced at every check.
- Never stored: coordinates, IP addresses.

The member-facing notice is `/privacy/location`. It also credits DB-IP, as the
data's licence (CC BY 4.0) asks. Like `/privacy/verification`, it is kept out
of search results until legal has read it.

## Data upkeep

`apps/api/scripts/fetch-ip-data.mjs` downloads DB-IP's IP to Country Lite and
IP to ASN Lite (about 18 MB). The API image runs it at build time, so each
deploy carries the current month's data, falling back to last month's early
in a month. The build fails rather than ship without the data, which would
make every check ask members to retry.

The founders' page shows when the data was built and the Tor list's age.
Without an API deploy for a month or two, the data goes stale; any API
deploy refreshes it.

## Trying it locally

```bash
cd apps/api && node scripts/fetch-ip-data.mjs
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
