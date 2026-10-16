import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DnsRecordsStackProps extends cdk.StackProps {
  /** The kinkord.com zone, created in KinkordFoundation. */
  hostedZoneId: string;
}

/**
 * DNS records that attach to the kinkord.com zone by id. The zone itself lives
 * in KinkordFoundation, which has drifted from the code (production still has
 * the Termii secret the code replaced with Robase): deploying it for a record
 * would delete that secret. Records go here instead, so they deploy alone.
 */
export class DnsRecordsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DnsRecordsStackProps) {
    super(scope, id, props);

    const zone = route53.PublicHostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: "kinkord.com",
    });

    // Proves to Google Search Console that we own kinkord.com (a Domain
    // property: every subdomain, http and https). Public by design; removing
    // it loses Search Console access. Route 53 keeps one TXT set per name, so
    // any other apex TXT value (SPF, say) belongs in this same list.
    new route53.TxtRecord(this, "ApexTxt", {
      zone,
      values: [
        "google-site-verification=2UIOUMvhuYPsRbVCoc5hPHTi_6foL_h_Q-vxQKf_VKs",
        // SPF: the @kinkord.com mailboxes send through Namecheap Private Email.
        // The app's own emails (Resend) go out as send.kinkord.com, which has its
        // own SPF, so they aren't listed here. One SPF policy only: add to this one.
        "v=spf1 include:spf.privateemail.com ~all",
      ],
    });

    // The @kinkord.com mailboxes (Namecheap Private Email). Without an MX, mail
    // sent to the domain bounces.
    new route53.MxRecord(this, "ApexMx", {
      zone,
      values: [
        { priority: 10, hostName: "mx1.privateemail.com" },
        { priority: 10, hostName: "mx2.privateemail.com" },
      ],
      ttl: cdk.Duration.minutes(5),
    });

    // DKIM for those mailboxes: Namecheap signs what they send with the private
    // half of this key (Private Email -> Manage -> Show DKIM). A public key, there
    // for any mail server to check. Longer than a TXT string's 255 characters, so
    // CDK splits it into two strings in the one record.
    new route53.TxtRecord(this, "PrivateEmailDkim", {
      zone,
      recordName: "privateemail._domainkey",
      values: [
        "v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0iinZxXGRaXfIdsQEWUXmWesr6AIvFNGcMcOD8SsxjfhNLEPPMKNZUXK//M/84A0DCvIYRSsSA77ZrFm/5E/SvVsV4moPp1Kh/ILR0igAzrxJFau7yzXXZsjYTLIzG/RBUcnh+Xdw3sdvofpK/u0Dnea3cSS4eIPr9n4RofXbol7MZOWUgTl7zXdclPfKs3JLRIpZyP9KNq1EqmZ5lCWgMj398HU9npUn0Ho++31jU0uihPZ9u9gmtzO9I3Mg2QV10RH6JWRLViNE8QakVjjx/1aDnnZYgGd0ldVkUHIM3lt7J1utl1Cykh3DapMCtjBGhrtkTUjpybhu2VksVsTLwIDAQAB",
      ],
      ttl: cdk.Duration.minutes(5),
    });

    // DMARC: tells Gmail, Yahoo and Outlook what to do with mail claiming to be
    // from kinkord.com that fails its checks. Without one they trust our mail
    // (sign-up codes above all) less and file more of it as spam. `p=none` only
    // monitors: nothing is rejected. Add `rua=mailto:…` once a mailbox exists to
    // receive the reports, then tighten to quarantine.
    new route53.TxtRecord(this, "Dmarc", {
      zone,
      recordName: "_dmarc",
      values: ["v=DMARC1; p=none"],
    });
  }
}
