"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CONTACT_CHANNELS,
  IMPORTANT_NOTICE,
  OFFICE_INFO,
  SAFETY_NOTICE,
  SUPPORT_TOPICS,
  type ContactChannel,
  type NoticeCard,
  type OfficeInfo,
  type SupportTopic,
} from "@/constants/contact";
import { Routes } from "@/constants/Routes";
import { authClient } from "@/services/authClient";
import { api } from "@/services/apiClient";
import type { ProfileVM } from "./useProfilePresenter";

export interface ContactChannelVM extends ContactChannel {}

export interface OfficeVM extends OfficeInfo {}

export interface NoticeVM extends NoticeCard {}

export interface SupportTopicVM extends SupportTopic {
  href: string;
}

export interface NavLinkVM {
  label: string;
  href: string;
}

export interface BottomNavVM {
  homeHref: string;
  messagesHref: string;
  settingsHref: string;
  profileHref: string;
  activeTab: "home" | "messages" | "settings" | "profile" | null;
  avatarUrl: string | null;
}

export interface ContactVM {
  brand: string;
  headline: string;
  lead: string;
  subcopy: string;
  getInTouchHeading: string;
  channels: ContactChannelVM[];
  office: OfficeVM;
  safetyNotice: NoticeVM;
  importantNotice: NoticeVM;
  chooseTopicHeading: string;
  chooseTopicSubcopy: string;
  topics: SupportTopicVM[];
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  navLinks: NavLinkVM[];
  bottomNav: BottomNavVM;
  selectedTopic: SupportTopicVM | null;
  selectTopic: (topic: SupportTopicVM | null) => void;
  handleTopicClick: (topic: SupportTopicVM) => void;
  onLogout: () => void;
}

export function useContactPresenter(): ContactVM {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SupportTopicVM | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const prof = await api.get<ProfileVM>("/profile");
        if (!cancelled && prof?.avatarUrl) {
          setAvatarUrl(prof.avatarUrl);
        }
      } catch {
        // Guest user or unauthenticated
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const onLogout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Continue to login even if signOut network fails
    }
    router.push(Routes.login);
  }, [router]);

  const topics: SupportTopicVM[] = SUPPORT_TOPICS.map((topic) => ({
    ...topic,
    href: `mailto:support@kinkord.com?subject=${encodeURIComponent(topic.subject)}`,
  }));

  const handleTopicClick = useCallback((topic: SupportTopicVM) => {
    setSelectedTopic(topic);
    if (typeof window !== "undefined" && topic.href) {
      window.location.href = topic.href;
    }
  }, []);

  const navLinks: NavLinkVM[] = [
    { label: "Home", href: Routes.home },
    { label: "Kinkopedia", href: Routes.kinkopedia },
    { label: "About Kinkord", href: Routes.about },
    { label: "Contact Us", href: Routes.contact },
    { label: "Invest in Kinkord", href: Routes.invest },
    { label: "Settings", href: Routes.settings },
    { label: "My Profile", href: Routes.profile },
  ];

  const bottomNav: BottomNavVM = {
    homeHref: Routes.appHome,
    messagesHref: Routes.messages,
    settingsHref: Routes.settings,
    profileHref: Routes.profile,
    activeTab: null,
    avatarUrl,
  };

  return {
    brand: "KINKORD",
    headline: "CONTACT US",
    lead: "We're here to help.",
    subcopy: "Reach out to us for support, inquiries, or to report any issues.",
    getInTouchHeading: "GET IN TOUCH",
    channels: [...CONTACT_CHANNELS],
    office: { ...OFFICE_INFO },
    safetyNotice: { ...SAFETY_NOTICE },
    importantNotice: { ...IMPORTANT_NOTICE },
    chooseTopicHeading: "CHOOSE A TOPIC",
    chooseTopicSubcopy: "Choose a topic below to get the right help faster.",
    topics,
    drawerOpen,
    openDrawer,
    closeDrawer,
    navLinks,
    bottomNav,
    selectedTopic,
    selectTopic: setSelectedTopic,
    handleTopicClick,
    onLogout,
  };
}
