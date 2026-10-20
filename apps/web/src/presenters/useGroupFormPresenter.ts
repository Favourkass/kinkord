"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GROUP_CATEGORY_LABELS, GROUPS_COPY } from "@/constants/groups";
import { Routes } from "@/constants/Routes";
import {
  groupFormErrors,
  type GroupCategory,
  type GroupOptionsPM,
  type GroupPM,
  type GroupPrivacy,
} from "@/domain/group";
import { ApiError } from "@/services/apiClient";
import { groupsService } from "@/services/groups.service";
import { statesForCountry } from "@/services/location.service";
import { countryName } from "@/util/format";

/** The countries the app has state lists for. */
const COUNTRIES = ["NG", "KE"];

interface Fields {
  name: string;
  description: string;
  rules: string;
  category: GroupCategory;
  privacy: GroupPrivacy;
  country: string;
  state: string;
}

const EMPTY: Fields = {
  name: "",
  description: "",
  rules: "",
  category: "local",
  privacy: "open",
  country: "",
  state: "",
};

const copy = GROUPS_COPY.form;

/**
 * Create a group (Silver members), or edit one (its moderators; only the owner
 * renames it). Who can join is chosen once, at creation.
 */
export function useGroupFormPresenter(slug?: string | null) {
  const router = useRouter();
  const editing = Boolean(slug);
  const [options, setOptions] = useState<GroupOptionsPM | null>(null);
  const [group, setGroup] = useState<GroupPM | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const done = () => live && setLoading(false);
    const fail = (e: unknown) => {
      if (!live) return;
      if (e instanceof ApiError && e.status === 401) return router.replace(Routes.login);
      setLoadError(
        e instanceof ApiError && e.status === 404
          ? GROUPS_COPY.group.notFound
          : GROUPS_COPY.group.error,
      );
    };
    void Promise.all([
      groupsService.options(),
      slug ? groupsService.detail(slug) : Promise.resolve(null),
    ])
      .then(([o, g]) => {
        if (!live) return;
        setOptions(o);
        if (g) {
          setGroup(g);
          setFields({
            name: g.name,
            description: g.description,
            rules: g.rules ?? "",
            category: g.category,
            privacy: g.privacy,
            country: g.country ?? "",
            state: g.state ?? "",
          });
        }
      }, fail)
      .finally(done);
    return () => {
      live = false;
    };
  }, [slug, router]);

  const errors = useMemo(() => groupFormErrors(fields), [fields]);
  const set =
    <K extends keyof Fields>(key: K) =>
    (value: Fields[K]) =>
      setFields((f) => ({
        ...f,
        [key]: value,
        // A new country resets a state that belonged to the old one.
        ...(key === "country" ? { state: "" } : {}),
      }));

  const canEdit = !editing || Boolean(group?.access.canModerate);
  const blocked = !editing && options && !options.canCreate ? options : null;
  const nameLocked = editing && !group?.access.isOwner;

  const submit = async () => {
    if (saving) return;
    if (Object.keys(errors).length) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setError(null);
    const common = {
      description: fields.description.trim(),
      rules: fields.rules.trim() || null,
      category: fields.category,
      country: fields.country || null,
      state: fields.country && fields.state ? fields.state : null,
    };
    try {
      if (editing && slug) {
        await groupsService.update(slug, {
          ...common,
          ...(nameLocked ? {} : { name: fields.name.trim() }),
        });
        router.push(Routes.group(slug));
      } else {
        const created = await groupsService.create({
          ...common,
          name: fields.name.trim(),
          privacy: fields.privacy,
        });
        router.push(Routes.group(created.slug));
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : copy.error);
      setSaving(false);
    }
  };

  const categoryKeys =
    options?.categories ?? (Object.keys(GROUP_CATEGORY_LABELS) as GroupCategory[]);

  return {
    title: editing ? copy.editTitle : copy.createTitle,
    loading,
    loadError: loadError ?? (editing && group && !canEdit ? GROUPS_COPY.group.error : null),
    /** Not a Silver member, a new account, or at the cap: why, and the way to Silver. */
    blocked: blocked
      ? {
          message: blocked.refusalMessage ?? copy.silverOnly,
          action:
            blocked.refusal === "silver"
              ? { label: copy.getSilver, href: Routes.subscription }
              : null,
        }
      : null,
    name: {
      label: copy.name,
      placeholder: copy.namePlaceholder,
      value: fields.name,
      onChange: set("name"),
      disabled: nameLocked,
      note: nameLocked ? copy.nameLocked : null,
      error: showErrors ? (errors.name ?? null) : null,
    },
    description: {
      label: copy.description,
      placeholder: copy.descriptionPlaceholder,
      value: fields.description,
      onChange: set("description"),
      error: showErrors ? (errors.description ?? null) : null,
    },
    rules: {
      label: copy.rules,
      placeholder: copy.rulesPlaceholder,
      value: fields.rules,
      onChange: set("rules"),
      error: showErrors ? (errors.rules ?? null) : null,
    },
    category: {
      label: copy.category,
      value: fields.category,
      onChange: (v: string) => set("category")(v as GroupCategory),
      options: categoryKeys.map((key) => ({ value: key, label: GROUP_CATEGORY_LABELS[key] })),
    },
    privacy: {
      label: copy.privacy,
      value: fields.privacy,
      onChange: (v: string) => set("privacy")(v as GroupPrivacy),
      locked: editing ? copy.privacyLocked : null,
      options: (["open", "closed"] as const).map((key) => ({
        value: key,
        label: GROUPS_COPY.privacy[key],
        hint: GROUPS_COPY.privacyHint[key],
      })),
    },
    location: {
      label: copy.location,
      country: {
        label: copy.country,
        value: fields.country,
        onChange: set("country"),
        options: [
          { value: "", label: copy.anyCountry },
          ...COUNTRIES.map((code) => ({ value: code, label: countryName(code) ?? code })),
        ],
      },
      state: fields.country
        ? {
            label: copy.state,
            value: fields.state,
            onChange: set("state"),
            options: [
              { value: "", label: copy.anyState },
              ...statesForCountry(fields.country).map((name) => ({ value: name, label: name })),
            ],
          }
        : null,
    },
    submit: {
      label: saving ? copy.saving : editing ? copy.save : copy.create,
      busy: saving,
      onClick: () => void submit(),
    },
    cancel: { label: copy.cancel, href: editing && slug ? Routes.group(slug) : Routes.groups },
    error,
  };
}
