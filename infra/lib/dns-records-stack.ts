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
      values: ["google-site-verification=2UIOUMvhuYPsRbVCoc5hPHTi_6foL_h_Q-vxQKf_VKs"],
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
