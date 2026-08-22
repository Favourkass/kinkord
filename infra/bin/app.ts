import * as cdk from "aws-cdk-lib";
import { FoundationStack } from "../lib/foundation-stack";
import { BillingStack } from "../lib/billing-stack";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";

const app = new cdk.App();

const account = "989624288003";
const primary = { account, region: "eu-west-1" };

// Budgets must live in us-east-1.
new BillingStack(app, "KinkordBilling", {
  env: { account, region: "us-east-1" },
  alertEmail: "maxihandsome@gmail.com",
  monthlyLimitUsd: 50,
});

const foundation = new FoundationStack(app, "KinkordFoundation", { env: primary });

const network = new NetworkStack(app, "KinkordNetwork", { env: primary });

new DataStack(app, "KinkordData", {
  env: primary,
  vpc: network.vpc,
  // Temporary: laptop IP allowed for migrations until the API runs in-VPC.
  adminCidr: process.env.ADMIN_IP ? `${process.env.ADMIN_IP}/32` : undefined,
});
