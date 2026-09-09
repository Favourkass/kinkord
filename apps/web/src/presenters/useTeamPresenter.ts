"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { POLICY_LINKS } from "@/constants/landing";
import { ABOUT_PAGE_DATA, TeamMemberData, FounderTopic, FounderTopicId } from "@/constants/about";
import { authClient } from "@/services/authClient";
import { api } from "@/services/apiClient";
import type { PolicyItem } from "@/components/landing/SplashScreen";
import type { NavLinkVM, BottomNavVM } from "./useAboutPresenter";

export interface TeamVM {
  brand: string;
  teamTitle: string;
  teamTitleAccent: string;
  memberProfileTitle: string;
  joinTeamCta: string;
  joinTeamSubtitle: string;
  founderMessage: typeof ABOUT_PAGE_DATA.founderMessage;
  ceo: TeamMemberData;
  founderTopics: readonly FounderTopic[];
  selectedTopicId: FounderTopicId | null;
  selectedTopic: FounderTopic | null;
  selectTopic: (id: FounderTopicId) => void;
  clearTopic: () => void;
  policyLinks: PolicyItem[];
  copyright: string;
  allRightsReserved: string;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  onLogout: () => Promise<void>;
  navLinks: NavLinkVM[];
  bottomNav: BottomNavVM;
  showProfile: boolean;
  openProfile: () => void;
  closeProfile: () => void;
  isLoggedIn: boolean;
  loginHref: string;
  signupHref: string;
}

export function useTeamPresenter(): TeamVM {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<FounderTopicId | null>(null);
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
            const profile = await api.get<{ avatarUrl?: string | null }>("/profile");
            if (!cancelled && profile?.avatarUrl) {
              setAvatarUrl(profile.avatarUrl);
            }
          } catch {
            // Unauthenticated or network error — fallback avatar is safe
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

  const openProfile = useCallback(() => setShowProfile(true), []);
  const closeProfile = useCallback(() => {
    setSelectedTopicId(null);
    setShowProfile(false);
  }, []);

  const selectTopic = useCallback((id: FounderTopicId) => {
    setSelectedTopicId(id);
  }, []);

  const clearTopic = useCallback(() => {
    setSelectedTopicId(null);
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      // Proceed even on failure
    }
    router.push(Routes.login);
  }, [router]);

  const baseNavLinks: NavLinkVM[] = [
    { label: "Home", href: Routes.home },
    { label: "Kinkopedia", href: Routes.kinkopedia },
    { label: "About Kinkord", href: Routes.about },
    { label: "Meet the Team", href: Routes.team },
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

  const bottomNav: BottomNavVM = {
    homeHref: isLoggedIn ? Routes.appHome : Routes.home,
    messagesHref: Routes.messages,
    settingsHref: Routes.settings,
    profileHref: Routes.profile,
    activeTab: null,
    avatarUrl,
  };

  const selectedTopic = selectedTopicId
    ? ABOUT_PAGE_DATA.founderTopics.find((t) => t.id === selectedTopicId) ?? null
    : null;

  return {
    brand: ABOUT_PAGE_DATA.brand,
    teamTitle: ABOUT_PAGE_DATA.teamTitle,
    teamTitleAccent: ABOUT_PAGE_DATA.teamTitleAccent,
    memberProfileTitle: ABOUT_PAGE_DATA.memberProfileTitle,
    joinTeamCta: ABOUT_PAGE_DATA.joinTeamCta,
    joinTeamSubtitle: ABOUT_PAGE_DATA.joinTeamSubtitle,
    founderMessage: ABOUT_PAGE_DATA.founderMessage,
    ceo: ABOUT_PAGE_DATA.ceo,
    founderTopics: ABOUT_PAGE_DATA.founderTopics,
    selectedTopicId,
    selectedTopic,
    selectTopic,
    clearTopic,
    policyLinks: POLICY_LINKS.map((p) => ({ ...p })),
    copyright: ABOUT_PAGE_DATA.copyright,
    allRightsReserved: ABOUT_PAGE_DATA.allRightsReserved,
    drawerOpen,
    openDrawer,
    closeDrawer,
    onLogout,
    navLinks,
    bottomNav,
    showProfile,
    openProfile,
    closeProfile,
    isLoggedIn,
    loginHref: Routes.login,
    signupHref: Routes.signup,
  };
}
