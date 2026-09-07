"use client";

import ContactPage from "@/components/pages/ContactPage";
import { useContactPresenter } from "@/presenters/useContactPresenter";

export default function ContactRoute() {
  const vm = useContactPresenter();
  return <ContactPage {...vm} />;
}
