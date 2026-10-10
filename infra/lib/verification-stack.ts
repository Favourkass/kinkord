import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/** Read by the API at runtime (apps/api/src/verification/verification-config.ts). */
export const VERIFICATION_SECRET_NAME = "kinkord/verification";

interface VerificationStackProps extends cdk.StackProps {
  /** The API's App Runner instance role, by name, as for live chat. */
  apiInstanceRoleName: string;
}

/**
 * Identity verification's settings. The API reads this secret every few
 * minutes, so verification is switched on (or off) from the console with no
 * deploy and no change to the API stacks, whose deployed config has drifted.
 *
 * It's created switched off: `enabled` stays false, and the Didit fields
 * empty, until the privacy notice is approved and the keys are pasted in.
 * The fingerprint key is generated here and never needs to be seen.
 */
export class VerificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VerificationStackProps) {
    super(scope, id, props);

    const secret = new secretsmanager.Secret(this, "Settings", {
      secretName: VERIFICATION_SECRET_NAME,
      description: "Identity verification (Didit): the on switch, provider keys and settings",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          enabled: false,
          policyUrl: "https://kinkord.com/privacy/verification",
          returnUrl: "https://kinkord.com/settings/verification",
          diditApiKey: "",
          diditWebhookSecret: "",
          diditWorkflowId: "",
          diditMode: "sandbox",
          profileMatchEnabled: false,
          profileMatchThreshold: 90,
        }),
        generateStringKey: "bindingSecret",
        passwordLength: 64,
        excludePunctuation: true,
      },
      // Holds the fingerprint key; losing it breaks every stored fingerprint.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const apiRole = iam.Role.fromRoleName(this, "ApiInstanceRole", props.apiInstanceRoleName, {
      mutable: true,
    });
    new iam.Policy(this, "ApiVerificationAccess", {
      roles: [apiRole],
      statements: [
        new iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [secret.secretArn],
        }),
      ],
    });
  }
}
