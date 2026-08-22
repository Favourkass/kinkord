import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

interface DataStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  /** CIDR allowed to reach Postgres directly (laptop, for migrations). Temporary. */
  adminCidr?: string;
}

export class DataStack extends cdk.Stack {
  readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSg", {
      vpc: props.vpc,
      securityGroupName: "kinkord-db",
      description: "Postgres access: API (via VPC connector SG later) + temporary admin IP",
      allowAllOutbound: false,
    });

    if (props.adminCidr) {
      this.dbSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(props.adminCidr),
        ec2.Port.tcp(5432),
        "TEMPORARY: owner laptop for migrations - remove once API handles migrations in-VPC",
      );
    }

    const db = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.of("17.10", "17"),
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO,
      ),
      vpc: props.vpc,
      // Public subnet + publiclyAccessible is a deliberate week-1 tradeoff so
      // migrations can run before the API exists in-VPC; the SG only admits the
      // admin IP. Flip to PRIVATE_ISOLATED + publiclyAccessible:false at cutover.
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      publiclyAccessible: true,
      securityGroups: [this.dbSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret("kinkord_admin", {
        secretName: "kinkord/database",
      }),
      databaseName: "kinkord",
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      multiAz: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      cloudwatchLogsExports: ["postgresql"],
    });

    new cdk.CfnOutput(this, "DbEndpoint", { value: db.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, "DbSecretArn", { value: db.secret?.secretArn ?? "" });
    new cdk.CfnOutput(this, "DbSecurityGroupId", { value: this.dbSecurityGroup.securityGroupId });
  }
}
