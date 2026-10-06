import { Routes } from "@/constants/Routes";

export interface VerificationPrivacySectionVM {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface VerificationPrivacyVM {
  homeHref: string;
  contactHref: string;
  brand: string;
  contactLabel: string;
  eyebrow: string;
  headline: { lead: string; accent: string };
  lead: string;
  effectiveDate: string;
  choice: { title: string; body: string };
  onThisPage: string;
  sections: VerificationPrivacySectionVM[];
  provider: { id: string; title: string; body: string; linkLabel: string; href: string };
  help: { title: string; body: string; cta: string };
  footer: string;
}

/** Display-ready copy for the public identity verification privacy notice. */
export function getVerificationPrivacyVM(): VerificationPrivacyVM {
  return {
    homeHref: Routes.home,
    contactHref: Routes.contact,
    brand: "KINKORD",
    contactLabel: "Contact us",
    eyebrow: "Trust & safety / Identity verification",
    headline: { lead: "Your ID is not", accent: "your profile." },
    lead: "What identity verification uses, who handles it, what other members see, and how to stop it.",
    effectiveDate: "Effective date: 3 October 2026",
    choice: {
      title: "Your choice",
      body: "Verification is optional and involves sensitive ID and facial information. Read this notice before you consent. Saying no doesn't affect your Kinkord account; you just won't get the verified badge.",
    },
    onThisPage: "On this page",
    sections: [
      {
        id: "controller",
        title: "Who is responsible",
        paragraphs: [
          "Kinkord Limited, Sapele, Delta State, Nigeria, is the data controller for identity verification on Kinkord. This notice adds to the privacy information given elsewhere on Kinkord.",
          "Didit provides the verification technology and acts as Kinkord's processor. Didit may also act on its own account for limited security, abuse-prevention, audit and legal purposes described in its own notice.",
          "Send questions and privacy requests to support@kinkord.com or through the Contact page. Please don't attach an ID document, ID number, selfie or video to a support message.",
        ],
      },
      {
        id: "information",
        title: "Information we use",
        paragraphs: [
          "From your Kinkord account: your account ID, date of birth, gender, country, nationality, current profile photo, your consent, your verification status and the reference of your Didit session.",
          "In Didit's hosted check you're asked for a supported government ID and a live selfie. Didit processes the ID image and the details on it, the selfie or short video, face and liveness signals, device and network security information, and the results of each check. For Nigerian members, the ID details are also checked against NIMC or bank verification (BVN) records through Didit.",
          "Face measurements used to recognise or confirm you are sensitive biometric data. With your explicit consent, Kinkord sends your current profile photo and the selfie from your Didit session to Didit for a one-to-one face comparison.",
          "Kinkord doesn't copy your ID image, ID number, selfie or video into its own systems. It keeps the pass or fail result of each check, reason codes, the face-comparison score and the threshold used, and a keyed fingerprint made from the name, birth date and gender on your ID. The fingerprint doesn't contain those details; it only lets us notice when one identity is used to verify more than one account.",
        ],
      },
      {
        id: "purpose-basis",
        title: "Why we use it, and on what basis",
        paragraphs: [
          "To confirm that you're a real adult, that your ID is genuine and yours, and that the person in your profile photo is you; to stop impersonation, fake and duplicate accounts; and to decide and review the result.",
          "Kinkord relies on your explicit consent, which you give on the Verification page before anything starts. You can withdraw it at any time on the same page.",
          "Kinkord never uses your verification data for advertising and never sells it.",
        ],
      },
      {
        id: "decision",
        title: "How the decision is made",
        paragraphs: [
          "Didit runs automated document, liveness, database and face checks. When every check is clear, the result is recorded automatically.",
          "If the match with your profile photo or the country of your ID is unclear, or the same identity is already verified on another account, a Kinkord admin reviews the case. Admins sign in with two-factor authentication, must record a reason and an evidence reference, and can't approve anything your ID itself failed. An admin can never decide their own verification.",
          "You have three attempts. You can ask for a person to reconsider any decision by contacting support. The badge shows that an identity was checked; it isn't a guarantee of anyone's conduct or safety.",
        ],
      },
      {
        id: "visibility",
        title: "What other members see",
        paragraphs: [
          'A gold "Identity verified" badge on your profile, and "ID and selfie checked by Kinkord" in your About tab. Nobody sees your ID, ID number, selfie, scores or review notes.',
          "The badge only shows while your profile photo, date of birth and gender are the ones that were verified. Change any of them and it disappears until you verify again.",
          "You can hide the badge in Edit profile → Privacy. If your profile is friends-only, only your friends see it.",
        ],
      },
      {
        id: "withdrawal",
        title: "Withdrawing your consent",
        paragraphs: [
          "Go to Settings → Verification and choose Withdraw consent. This stops any check in progress, removes your badge, deletes the identity fingerprint and asks Didit to delete your verification sessions, including face data.",
          "Withdrawing doesn't undo processing that already happened. Kinkord keeps the record that you consented and withdrew, and the results described below, as an audit trail.",
        ],
      },
      {
        id: "retention",
        title: "How long we keep it",
        paragraphs: [
          "Didit keeps session data under the retention settings Kinkord has configured with Didit, and deletes it sooner when you withdraw consent or your account is deleted.",
          "Kinkord keeps your consent record, attempts, check results, reason codes, face-comparison scores and review decisions (who decided, why, and when) for as long as your account exists. When your account is deleted, they're deleted with it, and Kinkord asks Didit to delete your sessions.",
        ],
      },
      {
        id: "sharing",
        title: "Who receives it, and where",
        paragraphs: [
          "Didit and its approved infrastructure providers receive what's needed to run the check. Inside Kinkord, only admins can see your verification results. Information may be disclosed to regulators, courts or law enforcement where the law requires it.",
          "Didit processes verification data in the European Union by default, including in Ireland. Kinkord relies on Didit's data-protection terms and the transfer safeguards required by Nigerian law for this processing outside Nigeria.",
        ],
      },
      {
        id: "rights",
        title: "Your rights and complaints",
        paragraphs: [
          "Subject to the law, you can ask to access or correct your information, object to or restrict its use, receive a copy of what you gave us, withdraw consent, ask us to delete it, and ask for a person to review a decision. We may need to confirm it's you first, and we'll explain any legal limit.",
          "Send a request to support@kinkord.com or use the Contact page. You can also complain to the Nigeria Data Protection Commission. Didit will usually pass requests about a Kinkord verification back to Kinkord.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this notice",
        paragraphs: [
          "We'll update the date at the top when this notice changes. If a change affects what you agreed to, Kinkord asks for your consent again before your next check.",
        ],
      },
    ],
    provider: {
      id: "provider-notice",
      title: "Didit's notice",
      body: "How Didit handles information in its verification service. Didit's hosted check may show further notices and choices.",
      linkLabel: "Didit verification privacy notice ↗",
      href: "https://didit.me/terms/verification-privacy-notice/",
    },
    help: {
      title: "Questions about your verification data?",
      body: "Get in touch through Kinkord support. Please don't attach identity documents to your message.",
      cta: "Contact Kinkord",
    },
    footer: "© Kinkord Limited · Identity verification privacy notice",
  };
}
