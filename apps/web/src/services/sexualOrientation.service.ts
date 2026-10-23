/** Carry a previously saved single choice into the unified picker. */
export function sexualOrientationSelections(profile: {
  orientation?: string | null;
  orientationSelections?: readonly string[];
}): string[] {
  return profile.orientationSelections?.length
    ? [...profile.orientationSelections]
    : profile.orientation
      ? [profile.orientation]
      : [];
}
