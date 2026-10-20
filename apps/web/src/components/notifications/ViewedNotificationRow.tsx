"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ViewedNotificationRowProps {
  id: string;
  createdAt: string;
  activityCount: number;
  unread: boolean;
  onViewed?: (id: string, createdAt: string, count: number) => Promise<void>;
  className: string;
  children: ReactNode;
}

/** Report a row only after at least half is visible in a foreground page. */
export default function ViewedNotificationRow(p: ViewedNotificationRowProps) {
  const element = useRef<HTMLLIElement>(null);
  const { id, createdAt, activityCount, unread, onViewed } = p;
  useEffect(() => {
    if (!unread || !onViewed || !element.current) return;
    let active = true;
    let pending = false;
    let completed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visible = () => {
      if (document.visibilityState === "hidden" || !element.current) return false;
      const r = element.current.getBoundingClientRect();
      const area =
        Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(0, r.top)) *
        Math.max(0, Math.min(r.right, innerWidth) - Math.max(0, r.left));
      if (!(r.width > 0 && r.height > 0 && area >= (r.width * r.height) / 2)) return false;
      // A drawer/modal covering the row does not count as viewing it.
      if (typeof document.elementFromPoint === "function") {
        const x = (Math.max(0, r.left) + Math.min(innerWidth - 1, r.right)) / 2;
        const y = (Math.max(0, r.top) + Math.min(innerHeight - 1, r.bottom)) / 2;
        const top = document.elementFromPoint(x, y);
        return top !== null && element.current.contains(top);
      }
      return true;
    };
    const check = () => {
      clearTimeout(timer);
      if (!active || pending || completed || !visible()) return;
      timer = setTimeout(() => {
        if (!active || !visible()) return;
        pending = true;
        void onViewed(id, createdAt, activityCount)
          .then(
            () => {
              completed = true;
            },
            () => {
              if (active) timer = setTimeout(check, 1000);
            },
          )
          .finally(() => {
            pending = false;
          });
      }, 250);
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(check, { threshold: [0, 0.5, 1] });
    observer?.observe(element.current);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    document.addEventListener("click", check);
    check();
    return () => {
      active = false;
      clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
      document.removeEventListener("click", check);
    };
  }, [id, createdAt, activityCount, unread, onViewed]);
  return (
    <li ref={element} className={p.className}>
      {p.children}
    </li>
  );
}
