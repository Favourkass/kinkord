import * as cdk from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

/**
 * Next.js frontend on App Runner. No VPC and no secrets: the standalone
 * server only renders pages; all data flows through the public API.
 */
export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const account = this.account;
    const region = this.region;
    const imageUri = `${account}.dkr.ecr.${region}.amazonaws.com/kinkord-web:latest`;

    const accessRole = new iam.Role(this, "AccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSAppRunnerServicePolicyForECRAccess",
        ),
      ],
    });

    const service = new apprunner.CfnService(this, "Service", {
      serviceName: "kinkord-web",
      sourceConfiguration: {
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        autoDeploymentsEnabled: true,
        imageRepository: {
          imageIdentifier: imageUri,
          imageRepositoryType: "ECR",
          imageConfiguration: { port: "3000" },
        },
      },
      instanceConfiguration: {
        cpu: "0.5 vCPU",
        memory: "1 GB",
      },
      healthCheckConfiguration: {
        protocol: "HTTP",
        path: "/",
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
