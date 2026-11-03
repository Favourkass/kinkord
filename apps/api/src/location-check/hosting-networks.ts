/**
 * Networks people don't browse from at home: clouds, rented servers and the
 * companies VPNs run on. A connection from one says where that service sits,
 * not where the person is.
 *
 * Each network is listed by number with the name its owner registers. A
 * number is only trusted when the IP data's owner name matches too, so a
 * wrong or reassigned number can't mark a home or mobile network.
 *
 * Deliberately left out: Cloudflare, Akamai and Fastly. Apple's Private Relay
 * and Cloudflare's WARP leave through them and keep the member's real
 * country. Transit carriers (Cogent, Zayo, Hurricane Electric) are left out
 * as well, because they also sell home and office lines.
 */
const HOSTING_NETWORKS: ReadonlyArray<readonly [number, RegExp]> = [
  [16509, /amazon/i],
  [14618, /amazon/i],
  [8987, /amazon/i],
  [396982, /google/i],
  [8075, /microsoft/i],
  [31898, /oracle/i],
  [45102, /alibaba/i],
  [37963, /alibaba|aliyun/i],
  [45090, /tencent/i],
  [132203, /tencent/i],
  [136907, /huawei/i],
  [14061, /digitalocean/i],
  [63949, /linode|akamai/i],
  [20473, /vultr|choopa|constant company/i],
  [16276, /ovh/i],
  [24940, /hetzner/i],
  [51167, /contabo/i],
  [12876, /scaleway|online s\.?a\.?s/i],
  [197540, /netcup/i],
  [47583, /hostinger/i],
  [9370, /sakura/i],
  [36352, /colocrossing|hostpapa/i],
  [8100, /quadranet/i],
  [40676, /psychz/i],
  [21859, /zenlayer/i],
  [3223, /voxility/i],
  [53667, /frantech|buyvm|ponynet/i],
  [49981, /worldstream/i],
  [19318, /interserver/i],
  [55286, /b2 net|servermania/i],
  [51852, /private layer/i],
  [44477, /stark industries/i],
  [60781, /leaseweb/i],
  [28753, /leaseweb/i],
  [16265, /leaseweb/i],
  [30633, /leaseweb/i],
  // The networks most commercial VPNs rent their exits from.
  [9009, /m247/i],
  [60068, /datacamp|cdn77/i],
  [212238, /datacamp|cdn77/i],
  [62240, /clouvider/i],
  [39351, /31173|mullvad/i],
  [136787, /tefincom/i],
  [207137, /packethub/i],
  [62371, /proton/i],
];

/** Owner names only rented servers and anonymizing services use. */
const HOSTING_NAME =
  /\b(hosting|vps|virtual private servers?|data ?cent(?:er|re)s?|colocation|dedicated servers?|cloud servers?|vpn|proxy)\b/i;

/** Whether a connection from this network says nothing about where its user is. */
export function isHostingNetwork(asn: number | null, owner: string | null): boolean {
  if (!owner) return false;
  if (HOSTING_NAME.test(owner)) return true;
  if (asn === null) return false;
  return HOSTING_NETWORKS.some(([number, name]) => number === asn && name.test(owner));
}
