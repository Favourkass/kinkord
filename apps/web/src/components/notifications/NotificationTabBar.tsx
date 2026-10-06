import MobileTabBar, { type MobileTabBarProps } from "../app/MobileTabBar";

export type NotificationTabBarProps = Omit<MobileTabBarProps, "active">;

/** Notifications use the same navigation as every other member screen. */
export default function NotificationTabBar(props: NotificationTabBarProps) {
  return <MobileTabBar {...props} active="notifications" />;
}
