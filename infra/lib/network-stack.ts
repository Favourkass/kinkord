import { createHash } from "node:crypto";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

/**
 * Boot script that turns the NAT instance into a NAT. CDK's default finds the
 * interface with `route`, which Amazon Linux 2023 doesn't ship; `ip route` is
 * always there. A t4g.nano has 512 MB, and dnf loading the package index needs
 * more: the first instance had dnf killed for memory, never got its NAT rule,
 * and the API silently lost the internet. So swap goes on first, dnf retries,
 * and the rule is saved with iptables-save (`service iptables save` isn't a
 * systemd action). The last line prints the rule to the boot log
 * (EC2 → Instance → Get system log) as proof the setup finished.
 */
const NAT_SETUP = [
  "dd if=/dev/zero of=/swapfile bs=1M count=1024",
  "chmod 600 /swapfile",
  "mkswap /swapfile",
  "swapon /swapfile",
  "for i in 1 2 3; do dnf install -y iptables-services && break; sleep 10; done",
  "systemctl enable --now iptables",
  'echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/custom-ip-forwarding.conf',
  "sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf",
  "IFACE=$(ip route show default | awk '/default/ {print $5; exit}')",
  'iptables -t nat -A POSTROUTING -o "$IFACE" -j MASQUERADE',
  "iptables -F FORWARD",
  "iptables-save > /etc/sysconfig/iptables",
  'echo "nat setup: $(iptables -t nat -S POSTROUTING | grep MASQUERADE)"',
];

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
      userData: (() => {
        const ud = ec2.UserData.forLinux();
        ud.addCommands(...NAT_SETUP);
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

    // The setup script only runs on an instance's first boot, and CDK's NAT
    // provider updates a running instance in place, so a changed script would
    // never take effect. Tie the instance's identity to the script instead:
    // any change to NAT_SETUP launches a fresh instance that runs it.
    const setupHash = createHash("sha256").update(NAT_SETUP.join("\n")).digest("hex").slice(0, 8);
    for (const gateway of nat.gatewayInstances) {
      gateway.instance.overrideLogicalId(
        `${cdk.Stack.of(this).getLogicalId(gateway.instance)}${setupHash}`,
      );
    }

    // Keep S3 traffic off the NAT.
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
