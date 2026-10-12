import assert from "node:assert/strict";
import test from "node:test";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import {
  VERIFICATION_BINDING_SECRET_NAME,
  VERIFICATION_SECRET_NAME,
  VerificationStack,
} from "./verification-stack";

test("keeps the durable fingerprint key separate from editable verification settings", () => {
  const app = new cdk.App();
  const stack = new VerificationStack(app, "VerificationTest", {
    env: { account: "111111111111", region: "eu-west-1" },
    apiInstanceRoleName: "api-role",
  });
  const template = Template.fromStack(stack);
  const resources = template.findResources("AWS::SecretsManager::Secret");
  const secrets = Object.values(resources).map((resource) => resource.Properties);
  const settings = secrets.find((secret) => secret.Name === VERIFICATION_SECRET_NAME);
  const binding = secrets.find((secret) => secret.Name === VERIFICATION_BINDING_SECRET_NAME);

  assert.ok(settings);
  assert.ok(binding);
  assert.equal(settings.GenerateSecretString.GenerateStringKey, "initialNonce");
  assert.equal(
    Object.hasOwn(JSON.parse(settings.GenerateSecretString.SecretStringTemplate), "bindingSecret"),
    false,
  );
  assert.equal(binding.GenerateSecretString.GenerateStringKey, "bindingSecret");

  // CDK renders retention on the resource itself, not inside Properties.
  const bindingResource = Object.values(resources).find(
    (resource) => resource.Properties.Name === VERIFICATION_BINDING_SECRET_NAME,
  );
  assert.equal(bindingResource?.DeletionPolicy, "Retain");
  assert.equal(bindingResource?.UpdateReplacePolicy, "Retain");

  const policies = template.findResources("AWS::IAM::Policy");
  const policyJson = JSON.stringify(policies);
  assert.match(policyJson, /Settings/);
  assert.match(policyJson, /BindingSecret/);
});
