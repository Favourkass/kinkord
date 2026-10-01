import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The API's VPC connector routes all its egress through the VPC, and it
    // needs both RDS (inside) and Resend/Robase (internet). A t4g.nano NAT
    // instance does that for about $7/month; a NAT gateway was about $38.
    const nat = ec2.NatProvider.instanceV2({
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      // Pinned in cdk.context.json, so a deploy only replaces the instance
      // when we refresh it on purpose (`cdk context --reset` on this key).
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        cachedInContext: true,
      }),
      // Throttles instead of billing for burst; NAT for this API needs little CPU.
      creditSpecification: ec2.CpuCredits.STANDARD,
      // The default lets the whole internet in. Outbound only, and the VPC is
      // let in below.
      defaultAllowedTraffic: ec2.NatTrafficDirection.OUTBOUND_ONLY,
      // CDK's default script finds the interface with `route`, which Amazon
      // Linux 2023 doesn't ship; without NAT rules the API would lose the
      // internet silently. `ip route` is always there.
      userData: (() => {
        const ud = ec2.UserData.forLinux();
        ud.addCommands(
          "dnf install -y iptables-services",
          "systemctl enable --now iptables",
          'echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/custom-ip-forwarding.conf',
          "sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf",
          "IFACE=$(ip route show default | awk '/default/ {print $5; exit}')",
          'iptables -t nat -A POSTROUTING -o "$IFACE" -j MASQUERADE',
          "iptables -F FORWARD",
          "service iptables save",
        );
        return ud;
      })(),
    });

    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: "kinkord",
      maxAzs: 2,
      natGateways: 1,
      natGatewayProvider: nat,
      subnetConfiguration: [
        // Order matters: CIDRs are allocated sequentially, so the new "app"
        // group must come AFTER the original two to leave their CIDRs alone.
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
        { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // Only our own subnets may route through the NAT instance.
    nat.connections.allowFrom(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.allTraffic());

    // Keep S3 traffic off the NAT.
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
