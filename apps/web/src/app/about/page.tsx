"use client";

import AboutPage from "@/components/pages/AboutPage";
import { useAboutPresenter } from "@/presenters/useAboutPresenter";

export default function AboutRoute() {
  const vm = useAboutPresenter();
  return <AboutPage {...vm} />;
}
