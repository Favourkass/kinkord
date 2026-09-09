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

export type ContactChannelVM = ContactChannel;

export type OfficeVM = OfficeInfo;

export type NoticeVM = NoticeCard;

export interface SupportTopicVM extends SupportTopic {
  href: string;
}

export interface NavLinkVM {
  label: string;
  href: string;
}

/** Desktop sidebar links + avatar (signed-in only). The contact page deliberately has no mobile bottom bar (Favour, 2026-09-08). */
export interface SidebarNavVM {
  homeHref: string;
  messagesHref: string;
  settingsHref: string;
  profileHref: string;
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
  sidebarNav: SidebarNavVM;
  selectedTopic: SupportTopicVM | null;
  selectTopic: (topic: SupportTopicVM | null) => void;
  handleTopicClick: (topic: SupportTopicVM) => void;
  onLogout: () => void;
  isLoggedIn: boolean;
  loginHref: string;
  signupHref: string;
}

export function useContactPresenter(): ContactVM {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<SupportTopicVM | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await authClient.getSession();
        if (cancelled) return;
        const loggedIn = Boolean(data?.session);
        setIsLoggedIn(loggedIn);
        if (loggedIn) {
          try {
            const prof = await api.get<ProfileVM>("/profile");
            if (!cancelled && prof?.avatarUrl) {
              setAvatarUrl(prof.avatarUrl);
            }
          } catch {
            // Guest user or unauthenticated
          }
        }
      } catch {
        if (!cancelled) setIsLoggedIn(false);
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

  const baseNavLinks: NavLinkVM[] = [
    { label: "Home", href: Routes.home },
    { label: "Kinkopedia", href: Routes.kinkopedia },
    { label: "About Kinkord", href: Routes.about },
    { label: "Contact Us", href: Routes.contact },
    { label: "Invest in Kinkord", href: Routes.invest },
  ];

  const navLinks: NavLinkVM[] = isLoggedIn
    ? [
        ...baseNavLinks,
        { label: "Settings", href: Routes.settings },
        { label: "My Profile", href: Routes.profile },
      ]
    : [
        ...baseNavLinks,
        { label: "Log In", href: Routes.login },
        { label: "Sign Up", href: Routes.signup },
      ];

  const sidebarNav: SidebarNavVM = {
    homeHref: isLoggedIn ? Routes.appHome : Routes.home,
    messagesHref: Routes.messages,
    settingsHref: Routes.settings,
    profileHref: Routes.profile,
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
    sidebarNav,
    selectedTopic,
    selectTopic: setSelectedTopic,
    handleTopicClick,
    onLogout,
    isLoggedIn,
    loginHref: Routes.login,
    signupHref: Routes.signup,
  };
}
