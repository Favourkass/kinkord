import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/** Read by the API at runtime and by the authorizer; holds the endpoints and the signing key. */
export const REALTIME_SECRET_NAME = "kinkord/realtime";

interface RealtimeStackProps extends cdk.StackProps {
  /**
   * The API's App Runner instance role, by name. This stack attaches the API's
   * permissions to it so live chat needs no change to the API stacks; their
   * deployed config has drifted from the code (see the PR).
   */
  apiInstanceRoleName: string;
}

/**
 * Live chat delivery. App Runner can't hold WebSockets open, so AppSync Events
 * does it for us. When a message is sent, the API (IAM-signed) publishes a
 * small "this thread changed" event to each member's own channel, `/chat/<id>`.
 * Their open app then fetches the change from the API, so message text never
 * passes through here.
 *
 * Members connect with a ten-minute token the API signs. The authorizer
 * Lambda checks it and allows subscribing to their own channel only.
 * Priced per use: about $1 per million events.
 */
export class RealtimeStack extends cdk.Stack {
  readonly api: appsync.EventApi;

  constructor(scope: Construct, id: string, props: RealtimeStackProps) {
    super(scope, id, props);

    // Referred to by name, not by ARN: the secret holds the API's endpoints,
    // the API needs the authorizer, and an ARN reference would make a cycle.
    const secretArnPattern = `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${REALTIME_SECRET_NAME}*`;

    const authorizer = new lambda.Function(this, "Authorizer", {
      functionName: "kinkord-realtime-authorizer",
      description: "Checks members' live-chat tokens for AppSync Events",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "index.handler",
      // Plain JS with no bundled dependencies, kept next to the code that
      // signs the tokens so their tests can hold the two together.
      code: lambda.Code.fromAsset(path.join(__dirname, "../../apps/api/src/realtime/authorizer"), {
        exclude: ["*.d.mts"],
      }),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: { TOKEN_SECRET_ID: REALTIME_SECRET_NAME },
      logGroup: new logs.LogGroup(this, "AuthorizerLogs", {
        logGroupName: "/aws/lambda/kinkord-realtime-authorizer",
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    authorizer.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [secretArnPattern],
      }),
    );

    const IAM = appsync.AppSyncAuthorizationType.IAM;
    const LAMBDA = appsync.AppSyncAuthorizationType.LAMBDA;
    this.api = new appsync.EventApi(this, "Events", {
      apiName: "kinkord-realtime",
      authorizationConfig: {
        authProviders: [
          { authorizationType: IAM },
          {
            authorizationType: LAMBDA,
            lambdaAuthorizerConfig: {
              handler: authorizer,
              resultsCacheTtl: cdk.Duration.minutes(5),
              // Malformed tokens are turned away before the Lambda runs.
              validationRegex: "^v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$",
            },
          },
        ],
        connectionAuthModeTypes: [LAMBDA],
        defaultPublishAuthModeTypes: [IAM],
        defaultSubscribeAuthModeTypes: [LAMBDA],
      },
    });
    this.api.addChannelNamespace("chat", {
      authorizationConfig: {
        publishAuthModeTypes: [IAM],
        subscribeAuthModeTypes: [LAMBDA],
      },
    });

    // Generated here and read only by the API and the authorizer: no person
    // ever needs to see it.
    new secretsmanager.Secret(this, "Settings", {
      secretName: REALTIME_SECRET_NAME,
      description: "Live chat: AppSync Events endpoints and the token-signing key",
      generateSecretString: {
        secretStringTemplate: this.toJsonString({
          httpDomain: this.api.httpDns,
          wsDomain: this.api.realtimeDns,
        }),
        generateStringKey: "key",
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    // The API publishes events and reads the settings above.
    const apiRole = iam.Role.fromRoleName(this, "ApiInstanceRole", props.apiInstanceRoleName, {
      mutable: true,
    });
    new iam.Policy(this, "ApiRealtimeAccess", {
      roles: [apiRole],
      statements: [
        new iam.PolicyStatement({
          actions: ["appsync:EventPublish"],
          resources: [`${this.api.apiArn}/channelNamespace/chat`],
        }),
        new iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [secretArnPattern],
        }),
      ],
    });

    new cdk.CfnOutput(this, "HttpDomain", { value: this.api.httpDns });
    new cdk.CfnOutput(this, "RealtimeDomain", { value: this.api.realtimeDns });
  }
}
