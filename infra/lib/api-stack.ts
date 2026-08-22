import * as cdk from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface ApiBaseStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

/**
 * Long-lived IAM + networking for the API. Separate from the service stack so
 * roles persist across service rollbacks and age past IAM propagation delays.
 */
export class ApiBaseStack extends cdk.Stack {
  readonly accessRole: iam.Role;
  readonly instanceRole: iam.Role;
  readonly connector: apprunner.CfnVpcConnector;

  constructor(scope: Construct, id: string, props: ApiBaseStackProps) {
    super(scope, id, props);

    const account = this.account;
    const region = this.region;

    const connectorSg = new ec2.SecurityGroup(this, "ConnectorSg", {
      vpc: props.vpc,
      securityGroupName: "kinkord-apprunner-connector",
      description: "App Runner VPC connector; egress to RDS and internet via NAT",
    });
    props.dbSecurityGroup.addIngressRule(
      connectorSg,
      ec2.Port.tcp(5432),
      "API (App Runner) to Postgres",
    );

    const connector = new apprunner.CfnVpcConnector(this, "VpcConnector", {
      vpcConnectorName: "kinkord-api",
      subnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS })
        .subnetIds,
      securityGroups: [connectorSg.securityGroupId],
    });

    // Pulls the image from ECR.
    const accessRole = new iam.Role(this, "AccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSAppRunnerServicePolicyForECRAccess",
        ),
      ],
    });

    // Runtime permissions: media bucket I/O.
    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
    });
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        resources: [`arn:aws:s3:::kinkord-media-${account}/*`],
      }),
    );

    // Matches both the suffixed physical ARN (…name-AbC123) and the
    // suffix-less name ARN App Runner uses in its GetSecretValue calls.
    const secretArn = (name: string) =>
      `arn:aws:secretsmanager:${region}:${account}:secret:${name}*`;
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          secretArn("kinkord/database-url"),
          secretArn("kinkord/auth-secret"),
          secretArn("kinkord/resend"),
          secretArn("kinkord/termii"),
        ],
      }),
    );

    this.accessRole = accessRole;
    this.instanceRole = instanceRole;
    this.connector = connector;
  }
}

interface ApiStackProps extends cdk.StackProps {
  base: ApiBaseStack;
}

/** The App Runner service itself; safe to fail/roll back without losing IAM. */
export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const account = this.account;
    const region = this.region;
    const imageUri = `${account}.dkr.ecr.${region}.amazonaws.com/kinkord-api:latest`;
    const { accessRole, instanceRole, connector } = props.base;

    const service = new apprunner.CfnService(this, "Service", {
      serviceName: "kinkord-api",
      sourceConfiguration: {
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        autoDeploymentsEnabled: true,
        imageRepository: {
          imageIdentifier: imageUri,
          imageRepositoryType: "ECR",
          imageConfiguration: {
            port: "4000",
            runtimeEnvironmentVariables: [
              { name: "AWS_REGION", value: region },
              { name: "MEDIA_BUCKET", value: `kinkord-media-${account}` },
              { name: "WEB_ORIGINS", value: "https://kinkord.com,https://www.kinkord.com" },
              { name: "AUTH_BASE_URL", value: "https://api.kinkord.com" },
              { name: "COOKIE_DOMAIN", value: ".kinkord.com" },
              { name: "EMAIL_FROM", value: "Kinkord <no-reply@kinkord.com>" },
              { name: "TERMII_SENDER_ID", value: "KINKORD" },
              { name: "TERMII_CHANNEL", value: "generic" },
              { name: "RUN_MIGRATIONS", value: "true" },
            ],
            // Full suffixed ARNs, resolved by the deploy script; falls back
            // to name-based ARNs which Secrets Manager also accepts.
            runtimeEnvironmentSecrets: [
              {
                name: "DATABASE_URL",
                value:
                  process.env.ARN_DATABASE_URL ??
                  `arn:aws:secretsmanager:${region}:${account}:secret:kinkord/database-url`,
              },
              {
                name: "AUTH_SECRET",
                value:
                  process.env.ARN_AUTH_SECRET ??
                  `arn:aws:secretsmanager:${region}:${account}:secret:kinkord/auth-secret`,
              },
              {
                name: "RESEND_API_KEY",
                value:
                  process.env.ARN_RESEND ??
                  `arn:aws:secretsmanager:${region}:${account}:secret:kinkord/resend`,
              },
              {
                name: "TERMII_API_KEY",
                value:
                  process.env.ARN_TERMII ??
                  `arn:aws:secretsmanager:${region}:${account}:secret:kinkord/termii`,
              },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: "0.5 vCPU",
        memory: "1 GB",
        instanceRoleArn: instanceRole.roleArn,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: "VPC",
          vpcConnectorArn: connector.attrVpcConnectorArn,
        },
      },
      healthCheckConfiguration: {
        protocol: "HTTP",
        path: "/health",
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
    });

    new cdk.CfnOutput(this, "ServiceUrl", { value: `https://${service.attrServiceUrl}` });
    new cdk.CfnOutput(this, "ServiceArn", { value: service.attrServiceArn });
  }
}
