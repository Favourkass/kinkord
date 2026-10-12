import * as cdk from "aws-cdk-lib";
import * as backup from "aws-cdk-lib/aws-backup";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

/** Where every backup is copied: another EU region, so one outage can't take both. */
export const BACKUP_COPY_REGION = "eu-central-1";
export const BACKUP_COPY_VAULT_NAME = "kinkord-backup-copies";
const BACKUP_VAULT_NAME = "kinkord-backups";

/**
 * Nobody but the account's root user may delete a backup or cut its retention
 * short, so a stolen admin login can't wipe the backups along with the data.
 * AWS Backup still removes each one when its retention ends.
 */
function protectRecoveryPoints(vault: backup.BackupVault, account: string) {
  vault.addToAccessPolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ["backup:DeleteRecoveryPoint", "backup:UpdateRecoveryPointLifecycle"],
      resources: ["*"],
      conditions: { StringNotLike: { "aws:PrincipalArn": `arn:aws:iam::${account}:root` } },
    }),
  );
}

/** The vault in Frankfurt that holds a copy of every backup. */
export class BackupCopiesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    const vault = new backup.BackupVault(this, "Vault", {
      backupVaultName: BACKUP_COPY_VAULT_NAME,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    protectRecoveryPoints(vault, this.account);
  }
}

export interface BackupStackProps extends cdk.StackProps {
  /** The Postgres instance, by ARN: it lives in KinkordData. */
  databaseArn: string;
  /** The members' photos, by ARN: the bucket lives in KinkordFoundation, which has drifted. */
  mediaBucketArn: string;
}

/**
 * Backups with AWS Backup, on top of RDS's own nightly backups (7 days, restorable
 * to any minute). Everything is copied to Frankfurt as it's made. It attaches to
 * the database and the bucket by ARN, so it deploys without touching their stacks.
 *
 * - The database: daily (kept 14 days), weekly (8 weeks) and monthly (a year).
 * - Photos: daily (14 days) and weekly (5 weeks), no longer. A deleted photo (an
 *   account closed, illegal content removed) must not outlive that by much.
 *
 * The photo backups need versioning on the bucket, turned on with a 30-day expiry
 * for replaced and deleted photos (see FoundationStack's MediaBucket).
 */
export class BackupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BackupStackProps) {
    super(scope, id, props);

    const vault = new backup.BackupVault(this, "Vault", {
      backupVaultName: BACKUP_VAULT_NAME,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    protectRecoveryPoints(vault, this.account);
    const copies = backup.BackupVault.fromBackupVaultArn(
      this,
      "CopyVault",
      `arn:aws:backup:${BACKUP_COPY_REGION}:${this.account}:backup-vault:${BACKUP_COPY_VAULT_NAME}`,
    );

    const role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("backup.amazonaws.com"),
      description: "Lets AWS Backup back up and restore the database and photos",
      managedPolicies: [
        "service-role/AWSBackupServiceRolePolicyForBackup",
        "service-role/AWSBackupServiceRolePolicyForRestores",
        "AWSBackupServiceRolePolicyForS3Backup",
        "AWSBackupServiceRolePolicyForS3Restore",
      ].map((name) => iam.ManagedPolicy.fromAwsManagedPolicyName(name)),
    });

    // Times are UTC, after RDS's own backup window (00:20-00:50).
    const rule = (name: string, cron: events.CronOptions, keepDays: number) =>
      new backup.BackupPlanRule({
        ruleName: name,
        scheduleExpression: events.Schedule.cron(cron),
        startWindow: cdk.Duration.hours(1),
        completionWindow: cdk.Duration.hours(4),
        deleteAfter: cdk.Duration.days(keepDays),
        copyActions: [{ destinationBackupVault: copies, deleteAfter: cdk.Duration.days(keepDays) }],
      });

    const database = new backup.BackupPlan(this, "DatabasePlan", {
      backupPlanName: "kinkord-database",
      backupVault: vault,
      backupPlanRules: [
        rule("daily", { hour: "1", minute: "0" }, 14),
        rule("weekly", { weekDay: "SUN", hour: "2", minute: "0" }, 56),
        rule("monthly", { day: "1", hour: "3", minute: "0" }, 365),
      ],
    });
    database.addSelection("Database", {
      backupSelectionName: "postgres",
      resources: [backup.BackupResource.fromArn(props.databaseArn)],
      role,
    });

    const photos = new backup.BackupPlan(this, "PhotosPlan", {
      backupPlanName: "kinkord-photos",
      backupVault: vault,
      backupPlanRules: [
        rule("daily", { hour: "1", minute: "30" }, 14),
        rule("weekly", { weekDay: "SUN", hour: "2", minute: "30" }, 35),
      ],
    });
    photos.addSelection("Photos", {
      backupSelectionName: "media-bucket",
      resources: [backup.BackupResource.fromArn(props.mediaBucketArn)],
      role,
    });

    new cdk.CfnOutput(this, "VaultName", { value: vault.backupVaultName });
  }
}
