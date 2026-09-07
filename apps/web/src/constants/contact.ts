export interface ContactChannel {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  href: string;
  icon: "email" | "whatsapp" | "phone" | "twitter";
}

export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  {
    id: "email",
    title: "Email Support",
    subtitle: "Reach us anytime",
    value: "support@kinkord.com",
    href: "mailto:support@kinkord.com",
    icon: "email",
  },
  {
    id: "whatsapp",
    title: "Whatsapp Support",
    subtitle: "Chat with us on WhatsApp",
    value: "09127883266",
    href: "https://wa.me/2349127883266",
    icon: "whatsapp",
  },
  {
    id: "phone",
    title: "Call Support",
    subtitle: "Call us directly",
    value: "09127883266",
    href: "tel:09127883266",
    icon: "phone",
  },
  {
    id: "twitter",
    title: "Twitter (X)",
    subtitle: "Follow and DM us on Twitter",
    value: "@kinkordlimited",
    href: "https://x.com/kinkordlimited",
    icon: "twitter",
  },
];

export interface OfficeInfo {
  title: string;
  company: string;
  addressLines: readonly string[];
}

export const OFFICE_INFO: OfficeInfo = {
  title: "OUR OFFICE",
  company: "Kinkord Limited",
  addressLines: ["13 Obire Street, Sapele, Delta State, Nigeria"],
};

export interface NoticeCard {
  title: string;
  body: string;
}

export const SAFETY_NOTICE: NoticeCard = {
  title: "SAFETY NOTICE",
  body: "If you are in immediate danger, please contact your local emergency services or law enforcement right away. Do not wait for a response from Kinkord Support.",
};

export const IMPORTANT_NOTICE: NoticeCard = {
  title: "IMPORTANT NOTICE",
  body: "Please do not share your password, OTP, bank PIN, or any other sensitive information. Our team will never ask for it.",
};

export interface SupportTopic {
  id: string;
  title: string;
  subtitle: string;
  icon: "headset" | "alert" | "creditCard" | "user" | "briefcase" | "ticket";
  isAlert?: boolean;
  subject: string;
}

export const SUPPORT_TOPICS: readonly SupportTopic[] = [
  {
    id: "general",
    title: "General Support",
    subtitle: "Questions or general inquiries",
    icon: "headset",
    subject: "General Support Inquiry",
  },
  {
    id: "problem",
    title: "Report a Problem",
    subtitle: "Something not working as expected",
    icon: "alert",
    isAlert: true,
    subject: "Report a Problem",
  },
  {
    id: "billing",
    title: "Payment/Billing Support",
    subtitle: "Payments, refunds, credits",
    icon: "creditCard",
    subject: "Payment/Billing Support",
  },
  {
    id: "user",
    title: "Report a User",
    subtitle: "Report inappropriate behaviour or content",
    icon: "user",
    subject: "Report a User",
  },
  {
    id: "business",
    title: "Business/ Partnerships",
    subtitle: "Partner or sponsor with us",
    icon: "briefcase",
    subject: "Business/ Partnerships Inquiry",
  },
  {
    id: "tickets",
    title: "View My Tickets",
    subtitle: "Track your previous support requests",
    icon: "ticket",
    subject: "View My Tickets - Status Request",
  },
];
