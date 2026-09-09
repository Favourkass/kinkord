"use client";

import TeamPage from "@/components/pages/TeamPage";
import { useTeamPresenter } from "@/presenters/useTeamPresenter";

export default function TeamRoute() {
  const vm = useTeamPresenter();
  return <TeamPage {...vm} />;
}
