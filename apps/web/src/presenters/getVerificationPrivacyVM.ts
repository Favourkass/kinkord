import { Routes } from "@/constants/Routes";

export interface VerificationPrivacySectionVM {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface VerificationPrivacyVM {
  homeHref: string;
  contactHref: string;
  effectiveDate: string;
  sections: VerificationPrivacySectionVM[];
  diditNoticeHref: string;
}

/** Display-ready copy for the public Kinkord KYC privacy notice. */
export function getVerificationPrivacyVM(): VerificationPrivacyVM {
  return {
    homeHref: Routes.home,
    contactHref: Routes.contact,
    effectiveDate: "22 September 2026",
    diditNoticeHref: "https://didit.me/terms/verification-privacy-notice/",
    sections: [
      {
        id: "controller",
        title: "Who is responsible",
        paragraphs: [
          "Kinkord Limited, Sapele, Delta State, Nigeria, is the data controller for Kinkord KYC. This notice covers the currently enabled identity and live-biometric stage of Kinkord KYC and supplements the privacy information provided elsewhere on Kinkord.",
          "Didit provides the identity-verification technology and normally acts as Kinkord's processor for the configured checks. Didit may act independently for limited security, abuse-prevention, audit, legal-compliance and legal-claims purposes described in its own notice.",
          "Questions and privacy requests can be sent to support@kinkord.com or through the Contact page. Do not attach an ID document, ID number, selfie or verification video to a support message.",
        ],
      },
      {
        id: "information",
        title: "Information we process",
        paragraphs: [
          "Kinkord uses your account identifier, date of birth, gender, country, current profile photo, consent record, verification status and provider session reference.",
          "In Didit's hosted flow you are asked to provide a supported government ID and a live camera capture. Didit processes the document image and extracted ID details, selfie or short liveness video, facial and liveness signals, device and network security information, and the results of the configured checks. For a Nigerian check, supported identity details are validated against the configured Nigerian identity source.",
          "Facial measurements and liveness signals used to distinguish or confirm you are sensitive biometric personal data. When enabled after your explicit consent, Kinkord sends the profile-photo snapshot and the live selfie from the completed verification session to Didit for a one-to-one facial comparison. Kinkord does not copy the raw government-ID image, ID number, selfie or liveness video into its own verification database.",
          "If the optional financial stage is enabled, Mono presents its own secure bank-connection page. Mono may process account identity information, including the account holder name, date of birth, gender, contact details and BVN, to provide the requested connection. Kinkord does not ask for or store your bank password, BVN, account number, balance, statements or transaction history. It uses the provider response in memory only to record a derived pass, review or failure outcome.",
        ],
      },
      {
        id: "purpose-basis",
        title: "Purpose and legal basis",
        paragraphs: [
          "We process this information to confirm that a Kinkord KYC applicant is an adult real person, validate a government identity, detect impersonation or tampering, compare the live face with the ID and current profile photo, prevent fraud, decide the outcome of the identity stage, and review an inconclusive or disputed result. If you separately opt in to the financial stage, we also use the connection to confirm control of a linked account and compare available identity attributes with the identity stage.",
          "Kinkord KYC is optional. Kinkord relies on your explicit consent for the identity and biometric processing described here, and separately requests consent before your device location or financial-account information is used. You may refuse without losing your ordinary Kinkord account, but you will not receive Kinkord KYC verified status. You may withdraw consent for future processing by contacting us; withdrawal does not invalidate processing already carried out and may require us to remove or stop assessing the verification.",
          "Kinkord may retain a limited audit record where necessary for security, fraud prevention, legal claims or compliance with applicable law. Any such processing is limited to what is necessary and does not permit Kinkord to reuse your biometric material for advertising or to sell it.",
        ],
      },
      {
        id: "decision",
        title: "Decision and human review",
        paragraphs: [
          "Didit performs automated document, liveness, database-validation and facial-comparison checks. Mono may return whether the requested financial identity data was available and whether its available date-of-birth and gender attributes match the already verified KYC information. A provider approval alone does not complete Kinkord KYC: the profile-photo comparison and every required KYC stage must also pass. A clear result may be recorded automatically. An uncertain, unavailable or changed-photo comparison is routed to a specifically authorised Kinkord staff reviewer, who can approve or reject the case and must record a reason and evidence reference.",
          "You may make up to three automated identity-stage attempts. An inconclusive result, a provider review outcome or exhausted attempts may require human review. You can contact Kinkord to request human reconsideration of a decision. Kinkord KYC is an identity-assurance signal, not a guarantee about a member's conduct or safety.",
        ],
      },
      {
        id: "retention",
        title: "Retention and deletion",
        paragraphs: [
          "Didit and Mono retain operational provider data under the retention settings configured for Kinkord's provider applications. Kinkord does not separately retain a biometric template from the profile-photo comparison, bank login credential, BVN, account number, balance or transaction data. Kinkord retains only the derived outcome, similarity score where applicable, threshold, provider request reference and audit time. A shorter period may apply if you make a valid erasure request and the information is no longer required.",
          "Kinkord keeps the consent version and time, provider and attempt references, derived pass/fail check flags, verification status, reviewer decision, reviewer identity, reason and audit timestamps while the verification or related account is active, and for no more than 24 months after the verification is removed or the account is closed, unless a longer period is required for an active dispute, security investigation or legal obligation.",
          "Your Kinkord profile photo is managed separately as profile content. Changing it hides any identity-stage status until the new photo has been reviewed or you complete any required re-verification.",
        ],
      },
      {
        id: "sharing",
        title: "Recipients and international transfer",
        paragraphs: [
          "Didit, and Mono where you choose to use the financial stage, and their authorised infrastructure providers receive the information needed to run the requested verification. Access inside Kinkord is restricted to authorised staff who need it for review, support, security or compliance. Information may also be disclosed to advisers, regulators, courts or law-enforcement bodies where a valid legal requirement applies.",
          "Didit processes verification data in the European Union by default, including on infrastructure in Ireland. Kinkord uses Didit's contractual data-protection terms and applicable transfer safeguards for this processing outside Nigeria. Didit's current notice and subprocessor information explain its locations and safeguards in more detail.",
        ],
      },
      {
        id: "visibility",
        title: "What other members see",
        paragraphs: [
          "Other members can see only that Kinkord KYC has been completed. They cannot see your government ID, ID number, verification selfie or video, provider report, consent record or private review notes. We do not use verification submissions to populate your public profile.",
        ],
      },
      {
        id: "future-stages",
        title: "Future KYC stages",
        paragraphs: [
          "Kinkord KYC is designed to include location, residence and financial-account checks in addition to identity verification. Financial verification is available only after Kinkord has configured and approved Mono; it is always optional and uses a separate consent and hosted provider page. Location and residence verification remain unavailable until their provider and privacy controls are enabled. Before a later stage begins, Kinkord will present a clear explanation of the data required, the purpose, provider and retention period, and will request the appropriate separate consent where required.",
        ],
      },
      {
        id: "rights",
        title: "Your rights and complaints",
        paragraphs: [
          "Subject to applicable law, you may ask to be informed about or access your personal data, correct inaccurate information, object to or restrict processing, obtain portable information you provided, withdraw consent, request deletion, and obtain human intervention in a decision. We may need to verify your identity before fulfilling a request and will explain any lawful limitation.",
          "Send a request to support@kinkord.com or use the Contact page. You may also lodge a complaint with the Nigeria Data Protection Commission. Didit and Mono will normally refer requests about a Kinkord verification back to Kinkord as the controller.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this notice",
        paragraphs: [
          "We will update the date on this page when this notice changes. If a material change affects an existing consent, Kinkord will request a new consent before starting another verification or carrying out the materially changed processing.",
        ],
      },
    ],
  };
}
