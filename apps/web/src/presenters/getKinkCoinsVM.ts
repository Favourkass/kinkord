import { kinkcoinsService } from "@/services/kinkcoins.service";

export function getKinkCoinsVM() {
  return kinkcoinsService.preview();
}
