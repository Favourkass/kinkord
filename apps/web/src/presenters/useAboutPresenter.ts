"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { POLICY_LINKS } from "@/constants/landing";
import { ABOUT_PAGE_DATA } from "@/constants/about";
import { authClient } from "@/services/authClient";
import { api } from "@/services/apiClient";
import type { PolicyItem } from "@/components/landing/SplashScreen";

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

export interface AboutVM {
  brand: string;
  aboutTitle: string;
  aboutTitleAccent: string;
  meetTeamCta: string;
  meetTeamSubtitle: string;
  teamHref: string;
  policyLinks: PolicyItem[];
  copyright: string;
  allRightsReserved: string;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  onLogout: () => Promise<void>;
  navLinks: NavLinkVM[];
  bottomNav: BottomNavVM;
  isLoggedIn: boolean;
  loginHref: string;
  signupHref: string;
}

export function useAboutPresenter(): AboutVM {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  return {
    brand: ABOUT_PAGE_DATA.brand,
    aboutTitle: ABOUT_PAGE_DATA.aboutTitle,
    aboutTitleAccent: ABOUT_PAGE_DATA.aboutTitleAccent,
    meetTeamCta: ABOUT_PAGE_DATA.meetTeamCta,
    meetTeamSubtitle: ABOUT_PAGE_DATA.meetTeamSubtitle,
    teamHref: Routes.team,
    policyLinks: POLICY_LINKS.map((p) => ({ ...p })),
    copyright: ABOUT_PAGE_DATA.copyright,
    allRightsReserved: ABOUT_PAGE_DATA.allRightsReserved,
    drawerOpen,
    openDrawer,
    closeDrawer,
    onLogout,
    navLinks,
    bottomNav,
    isLoggedIn,
    loginHref: Routes.login,
    signupHref: Routes.signup,
  };
}
