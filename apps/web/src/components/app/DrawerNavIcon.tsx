import {
  BookOpenText,
  Bookmark,
  CircleHelp,
  Coins,
  Database,
  Gem,
  Info,
  Lock,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { DrawerIcon } from "./nav";

const icons: Record<DrawerIcon, LucideIcon> = {
  members: UsersRound,
  saved: Bookmark,
  kinkopedia: BookOpenText,
  verification: ShieldCheck,
  coins: Coins,
  subscription: Gem,
  marketplace: Store,
  account: UserRound,
  data: Database,
  privacy: Shield,
  security: Lock,
  content: SlidersHorizontal,
  safety: ShieldCheck,
  support: CircleHelp,
  about: Info,
};

export default function DrawerNavIcon({
  icon,
  size = 17,
  className,
}: {
  icon: DrawerIcon;
  size?: number;
  className?: string;
}) {
  const Icon = icons[icon];
  return <Icon aria-hidden="true" size={size} className={className} />;
}
