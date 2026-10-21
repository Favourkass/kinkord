"use client";

import { useEffect, useSyncExternalStore } from "react";
import { noOrganizations, organizationsStore } from "@/services/organizations.service";

/**
 * The organizations' accounts, for a presenter to mark their names with:
 * read on first use and shared, and re-rendering whoever asked once they're in.
 */
export function useOrganizations(): ReadonlySet<string> {
  const known = useSyncExternalStore(
    organizationsStore.subscribe,
    organizationsStore.snapshot,
    noOrganizations,
  );
  useEffect(() => {
    void organizationsStore.load();
  }, []);
  return known;
}
