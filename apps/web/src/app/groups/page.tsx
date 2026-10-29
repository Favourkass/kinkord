"use client";
import GroupsScreen from "@/components/groups/GroupsScreen";
import { useGroupsPresenter } from "@/presenters/useGroupsPresenter";
export default function GroupsPage() {
  const page = useGroupsPresenter();
  return <GroupsScreen {...page} />;
}
