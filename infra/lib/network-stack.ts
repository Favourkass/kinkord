import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // One NAT gateway: the API's VPC connector routes all its egress through
    // the VPC, and it needs both RDS (inside) and Resend/S3 (internet).
    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: "kinkord",
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        // Order matters: CIDRs are allocated sequentially, so the new "app"
        // group must come AFTER the original two to leave their CIDRs alone.
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
        { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // Keep S3 traffic off the NAT bill.
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
