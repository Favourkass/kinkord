"use client";
import GroupsScreen from "@/components/groups/GroupsScreen";
import { useGroupsPresenter } from "@/presenters/useGroupsPresenter";
import { useParams } from "next/navigation";
export default function GroupsPage() {
  const { id } = useParams<{ id: string }>();
  const page = useGroupsPresenter(id);
  return <GroupsScreen {...page} />;
}
