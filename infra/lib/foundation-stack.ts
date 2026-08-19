import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

const GITHUB_REPO = "Favourkass/kinkord";

export class FoundationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- Media storage -----------------------------------------------------
    const media = new s3.Bucket(this, "MediaBucket", {
      bucketName: `kinkord-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
          allowedOrigins: [
            "https://kinkord.com",
            "https://www.kinkord.com",
            "http://localhost:3000",
          ],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(7) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---- Container registry ------------------------------------------------
    const apiRepo = new ecr.Repository(this, "ApiRepo", {
      repositoryName: "kinkord-api",
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 20 }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---- Third-party API keys (values pasted by the owner in the console) --
    const resendSecret = new secretsmanager.Secret(this, "ResendSecret", {
      secretName: "kinkord/resend",
      description: "Resend API key — set the value in the console, never in code",
    });
    const termiiSecret = new secretsmanager.Secret(this, "TermiiSecret", {
      secretName: "kinkord/termii",
      description: "Termii API key — set the value in the console, never in code",
    });

    // ---- DNS (nameserver switch at Namecheap happens at cutover) -----------
    const zone = new route53.PublicHostedZone(this, "Zone", {
      zoneName: "kinkord.com",
    });

    // ---- GitHub Actions deploys via OIDC (no long-lived keys in CI) --------
    const github = new iam.OpenIdConnectProvider(this, "GitHubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const deployRole = new iam.Role(this, "GithubDeployRole", {
      roleName: "kinkord-github-deploy",
      assumedBy: new iam.OpenIdConnectPrincipal(github, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
        StringLike: {
          "token.actions.githubusercontent.com:sub": `repo:${GITHUB_REPO}:*`,
        },
      }),
      description: "Assumed by GitHub Actions to push images and run CDK deploys",
      maxSessionDuration: cdk.Duration.hours(1),
    });

    apiRepo.grantPullPush(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );
    // CDK deploys from CI assume the bootstrap roles rather than acting directly.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );
    // App Runner service updates triggered from CI.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["apprunner:StartDeployment", "apprunner:ListServices", "apprunner:DescribeService"],
        resources: ["*"],
      }),
    );

    new cdk.CfnOutput(this, "MediaBucketName", { value: media.bucketName });
    new cdk.CfnOutput(this, "ApiRepoUri", { value: apiRepo.repositoryUri });
    new cdk.CfnOutput(this, "DeployRoleArn", { value: deployRole.roleArn });
    new cdk.CfnOutput(this, "ResendSecretArn", { value: resendSecret.secretArn });
    new cdk.CfnOutput(this, "TermiiSecretArn", { value: termiiSecret.secretArn });
    new cdk.CfnOutput(this, "ZoneNameServers", {
      value: cdk.Fn.join(" ", zone.hostedZoneNameServers ?? []),
      description: "Set these at Namecheap at cutover time",
    });
  }
}
