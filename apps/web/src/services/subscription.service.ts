/** Silver by bank transfer: the member's checkout and proof, and the admins' queue. */
import type {
  AdminPaymentPM,
  HeldCheckPM,
  MemberCheckPM,
  PaymentPM,
  PaymentSettingsInputPM,
  PaymentSettingsPM,
  PaymentStatus,
  PlanPeriod,
  SubmitPaymentPM,
  SubscriptionStatusPM,
} from "@/domain/subscription";
import { compressImage, IMAGE_UPLOAD_PRESETS } from "@/util/image";
import { api, uploadToPresignedUrl } from "./apiClient";

interface ReceiptUploadSlot {
  key: string;
  uploadUrl: string;
}

const payment = (id: string) => `/subscription/payments/${encodeURIComponent(id)}`;
const adminPayment = (id: string) => `/admin/payments/${encodeURIComponent(id)}`;
const adminCheck = (userId: string) => `/admin/silver-checks/${encodeURIComponent(userId)}`;

export const subscriptionService = {
  status: () => api.get<SubscriptionStatusPM>("/subscription"),

  /** Starts paying for a plan, or picks up the checkout already running for it. */
  checkout: (period: PlanPeriod) => api.post<PaymentPM>("/subscription/checkout", { period }),

  payment: (id: string) => api.get<PaymentPM>(payment(id)),

  /** Shrinks the photo for a phone connection, uploads it, and returns its key. */
  uploadReceipt: async (id: string, raw: File): Promise<string> => {
    const file = await compressImage(raw, IMAGE_UPLOAD_PRESETS.receipt);
    const slot = await api.post<ReceiptUploadSlot>(`${payment(id)}/receipt-upload-url`, {
      contentType: file.type,
      contentLength: file.size,
    });
    await uploadToPresignedUrl(slot.uploadUrl, file);
    return slot.key;
  },

  submit: (id: string, input: SubmitPaymentPM) =>
    api.post<PaymentPM>(`${payment(id)}/submit`, input),
};

export const paymentsAdminService = {
  list: (status: PaymentStatus, q = "") => {
    const query = new URLSearchParams({ status });
    if (q.trim()) query.set("q", q.trim());
    return api.get<AdminPaymentPM[]>(`/admin/payments?${query.toString()}`);
  },

  verify: (id: string) =>
    api.post<{ id: string; silverUntil: string }>(`${adminPayment(id)}/verify`, {}),

  reject: (id: string, reason: string) =>
    api.post<{ id: string }>(`${adminPayment(id)}/reject`, { reason }),

  settings: () => api.get<PaymentSettingsPM>("/admin/payments/settings"),

  saveSettings: (input: PaymentSettingsInputPM) =>
    api.put<PaymentSettingsPM>("/admin/payments/settings", input),
};

/** Silver checks hidden after a member changed their name, username or photo. */
export const silverChecksAdminService = {
  held: () => api.get<HeldCheckPM[]>("/admin/silver-checks"),

  /** Null when the member isn't on Silver. */
  forMember: async (userId: string) =>
    (await api.get<{ check: MemberCheckPM | null }>(adminCheck(userId))).check,

  approve: (userId: string) => api.post<{ userId: string }>(`${adminCheck(userId)}/approve`, {}),

  remove: (userId: string, reason: string) =>
    api.post<{ userId: string }>(`${adminCheck(userId)}/remove`, { reason }),
};
