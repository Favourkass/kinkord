import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/** Read by the API at runtime (apps/api/src/verification/verification-config.ts). */
export const VERIFICATION_SECRET_NAME = "kinkord/verification";
export const VERIFICATION_BINDING_SECRET_NAME = "kinkord/verification-binding";

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
 * The fingerprint key is generated in its own retained secret. Settings can
 * change without rotating the key that existing duplicate-ID fingerprints use.
 */
export class VerificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VerificationStackProps) {
    super(scope, id, props);

    const settingsSecret = new secretsmanager.Secret(this, "Settings", {
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
        // Secrets Manager requires one generated field. It is deliberately
        // disposable; the durable identity-fingerprint key lives below.
        generateStringKey: "initialNonce",
        passwordLength: 32,
        excludePunctuation: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const bindingSecret = new secretsmanager.Secret(this, "BindingSecret", {
      secretName: VERIFICATION_BINDING_SECRET_NAME,
      description:
        "Stable HMAC key for identity fingerprints; never rotate without a fingerprint migration",
      generateSecretString: {
        secretStringTemplate: "{}",
        generateStringKey: "bindingSecret",
        passwordLength: 64,
        excludePunctuation: true,
      },
      // Losing or replacing this key silently disables duplicate-ID matching
      // against every fingerprint that was written with the old value.
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
          resources: [settingsSecret.secretArn, bindingSecret.secretArn],
        }),
      ],
    });
  }
}
