import type { PushGroup } from "@/domain/pushPreferences";
import { pushPreferencesRepository } from "@/repositories/pushPreferencesRepository";

export const loadPushPreferences = () => pushPreferencesRepository.read();

/** Turns one kind on or off; the others stay as they are. */
export const savePushPreference = (group: PushGroup, on: boolean) =>
  pushPreferencesRepository.update({ [group]: on });
