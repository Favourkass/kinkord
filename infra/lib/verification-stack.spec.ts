import assert from "node:assert/strict";
import test from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { BACKUP_COPY_REGION } from "./backup-stack";
import {
  VERIFICATION_BINDING_SECRET_NAME,
  VERIFICATION_SECRET_NAME,
  VerificationStack,
} from "./verification-stack";

const app = new cdk.App();
const stack = new VerificationStack(app, "VerificationTest", {
  env: { account: "111111111111", region: "eu-west-1" },
  apiInstanceRoleName: "api-role",
});
const template = Template.fromStack(stack);
const resources = template.findResources("AWS::SecretsManager::Secret");
// CDK renders retention on the resource itself, not inside Properties.
const resource = (name: string) =>
  Object.values(resources).find((secret) => secret.Properties.Name === name);
const settingsResource = resource(VERIFICATION_SECRET_NAME);
const bindingResource = resource(VERIFICATION_BINDING_SECRET_NAME);

test("keeps the durable fingerprint key separate from editable verification settings", () => {
  const settings = settingsResource?.Properties;
  const binding = bindingResource?.Properties;
  assert.ok(settings);
  assert.ok(binding);
  assert.equal(settings.GenerateSecretString.GenerateStringKey, "initialNonce");
  assert.equal(
    Object.hasOwn(JSON.parse(settings.GenerateSecretString.SecretStringTemplate), "bindingSecret"),
    false,
  );
  assert.equal(binding.GenerateSecretString.GenerateStringKey, "bindingSecret");

  assert.equal(bindingResource?.DeletionPolicy, "Retain");
  assert.equal(bindingResource?.UpdateReplacePolicy, "Retain");
  // Backups of the database are copied to Frankfurt; so is the key their fingerprints need.
  assert.deepEqual(binding.ReplicaRegions, [{ Region: BACKUP_COPY_REGION }]);

  const policies = template.findResources("AWS::IAM::Policy");
  const policyJson = JSON.stringify(policies);
  assert.match(policyJson, /Settings/);
  assert.match(policyJson, /BindingSecret/);
});

test("never changes either secret's generator", () => {
  // CloudFormation regenerates a secret's whole value whenever its
  // GenerateSecretString changes: an edit would wipe the Didit keys pasted
  // into the settings, or replace the key every fingerprint was made with.
  // If this fails, undo the change to the stack; don't update this test.
  assert.deepEqual(settingsResource?.Properties.GenerateSecretString, {
    ExcludePunctuation: true,
    GenerateStringKey: "initialNonce",
    PasswordLength: 32,
    SecretStringTemplate:
      '{"enabled":false,"policyUrl":"https://kinkord.com/privacy/verification","returnUrl":"https://kinkord.com/settings/verification","diditApiKey":"","diditWebhookSecret":"","diditWorkflowId":"","diditMode":"sandbox","profileMatchEnabled":false,"profileMatchThreshold":90,"testers":""}',
  });
  assert.deepEqual(bindingResource?.Properties.GenerateSecretString, {
    ExcludePunctuation: true,
    GenerateStringKey: "bindingSecret",
    PasswordLength: 64,
    SecretStringTemplate: "{}",
  });
});
