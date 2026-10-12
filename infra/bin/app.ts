import * as cdk from "aws-cdk-lib";
import { FoundationStack } from "../lib/foundation-stack";
import { BillingStack } from "../lib/billing-stack";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { ApiBaseStack, ApiStack } from "../lib/api-stack";
import { BACKUP_COPY_REGION, BackupCopiesStack, BackupStack } from "../lib/backup-stack";
import { DnsRecordsStack } from "../lib/dns-records-stack";
import { RealtimeStack } from "../lib/realtime-stack";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

const account = "989624288003";
const primary = { account, region: "eu-west-1" };

// Budgets must live in us-east-1.
new BillingStack(app, "KinkordBilling", {
  env: { account, region: "us-east-1" },
  alertEmail: "maxihandsome@gmail.com",
  monthlyLimitUsd: 50,
});

const foundation = new FoundationStack(app, "KinkordFoundation", { env: primary });

const network = new NetworkStack(app, "KinkordNetwork", { env: primary });

const data = new DataStack(app, "KinkordData", {
  env: primary,
  vpc: network.vpc,
  // Temporary: laptop IP allowed for migrations until the API runs in-VPC.
  adminCidr: process.env.ADMIN_IP ? `${process.env.ADMIN_IP}/32` : undefined,
});

const apiBase = new ApiBaseStack(app, "KinkordApiBase", {
  env: primary,
  vpc: network.vpc,
  dbSecurityGroup: data.dbSecurityGroup,
});

new ApiStack(app, "KinkordApi", { env: primary, base: apiBase });

// Live chat. Attaches its permissions to the API's existing instance role by
// name, so it deploys without touching the API stacks.
new RealtimeStack(app, "KinkordRealtime", {
  env: primary,
  apiInstanceRoleName: "KinkordApiBase-InstanceRole3CCE2F1D-oljaS88t9vMg",
});

new WebStack(app, "KinkordWeb", { env: primary });

// Backups of the database and members' photos, copied to Frankfurt. They attach
// by ARN, so they deploy without KinkordData or KinkordFoundation.
new BackupCopiesStack(app, "KinkordBackupCopies", {
  env: { account, region: BACKUP_COPY_REGION },
});
new BackupStack(app, "KinkordBackup", {
  env: primary,
  databaseArn: `arn:aws:rds:eu-west-1:${account}:db:kinkorddata-postgres9dc8bb04-1d7wx6y6fzq6`,
  mediaBucketArn: `arn:aws:s3:::kinkord-media-${account}`,
});

// Records in the kinkord.com zone, attached by id so they deploy without
// KinkordFoundation (which has drifted from the code).
new DnsRecordsStack(app, "KinkordDnsRecords", {
  env: primary,
  hostedZoneId: "Z1029069WMDN1XV54QJU",
});
