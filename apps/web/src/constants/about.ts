import { Routes } from "./Routes";
import { COPYRIGHT_LINE, ALL_RIGHTS_RESERVED, POLICY_LINKS, PolicyLink } from "./landing";

export interface TeamMemberData {
  id: string;
  name: string;
  handle: string;
  verified: boolean;
  role: string;
  age: number;
  location: string;
  gender: string;
  avatarUrl: string;
  bio: readonly string[];
  email: string;
  communityHandle: string;
  responseNote: string;
}

export type FounderTopicId =
  | "my-kink-identity"
  | "what-i-believe"
  | "the-journey-so-far"
  | "lesson-setback-growth"
  | "my-mission"
  | "my-vision"
  | "what-im-building"
  | "founders-journey"
  | "contact-the-founder"
  | "work-with-me"
  | "my-message-to-the-community"
  | "founders-principle";

export interface ContactChannel {
  icon: string;
  name: string;
  handle: string;
  description: string;
  href: string;
}

export interface JournalEntry {
  date: string;
  title: string;
  paragraphs: readonly string[];
  quote?: string;
  closing?: string;
  whatsappUrl?: string;
  whatsappLabel?: string;
}

export interface PrincipleItem {
  number?: number;
  icon: string;
  title: string;
  description: string;
}

export interface FounderTopic {
  id: FounderTopicId;
  title: string;
  badge: string;
  paragraphs: readonly string[];
  role?: string;
  interests?: readonly string[];
  whatsappUrl?: string;
  whatsappLabel?: string;
  contactChannels?: readonly ContactChannel[];
  closingNote?: string;
  journalEntries?: readonly JournalEntry[];
  principles?: readonly PrincipleItem[];
}

export const FOUNDER_TOPICS: readonly FounderTopic[] = [
  {
    id: "my-kink-identity",
    title: "My Kink Identity",
    badge: "Identity & Expression",
    role: "Dominant",
    interests: [
      "⛓️ BDSM",
      "🎭 Roleplay",
      "🗯️ Dirty Talk",
      "⚡ Sensory Play",
      "👂 Ear Stimulation Kink",
      "🪶 Tickling & Sensory Teasing",
      "🙏 Body Worship",
    ],
    paragraphs: [
      "My kink identity is rooted in BDSM, roleplay, and sensory exploration. I identify as a Dominant and enjoy exploring different forms of consensual kink and power dynamics.",
      "Beyond participating in kink, I’m also a Kink Educator, sharing knowledge and helping fellow kinksters better understand kink, BDSM, dynamics, terminology, communication, and responsible exploration.",
    ],
  },
  {
    id: "what-i-believe",
    title: "What I Believe",
    badge: "Core Beliefs",
    paragraphs: [
      "I believe people should be free to explore their interests and live their lives, provided no one is harmed, consent is respected, and the law is followed. Everyone deserves the freedom to explore without unnecessary judgement.",
      "Safety, privacy, consent, and personal boundaries must remain fundamental. Trust requires strong verification, education, accountability, and honesty.",
      "An open mind should always be balanced with responsibility, respect, and understanding.",
      "Kinkord should never sacrifice safety for growth, engagement, popularity, or profit. It should remain focused on solving problems, creating possibilities, encouraging responsible exploration, and providing meaningful value to the kink community while putting people first.",
    ],
  },
  {
    id: "the-journey-so-far",
    title: "The Journey So Far",
    badge: "Milestones",
    paragraphs: [
      "As a kinkster, I realized that the kink community needed a platform it could trust.",
      "A place for education, events, entertainment, and matchmaking — but also a platform where someone was willing to stand behind the community and be held responsible for what was being built.",
      "I decided to step up.",
      "My first step was simple: I created a WhatsApp group for Nigerian kinksters.",
      "At that point, there was no app. No sophisticated platform. Just a group, a community, and an idea that was beginning to take shape.",
      "As the group developed, I started seeing something bigger.",
      "What began as a Nigerian community started expanding beyond Nigeria. We were creating WhatsApp communities for kinksters in South Africa, America, Canada, and other parts of the world.",
      "That changed the way I looked at what I was building.",
      "I began thinking beyond a WhatsApp group.",
      "What if I could build the Facebook of sexual kinks?",
      "That was the point where the idea started becoming much bigger than its original form.",
      "But expanding internationally came with a challenge I hadn't fully anticipated: trust.",
      "People questioned whether they could trust someone from Nigeria to build and manage communities for people in other countries.",
      "The stereotype was always there:\n\"You're Nigerian. You're from the scam capital of the world. Why should we trust you?\"",
      "Hearing that repeatedly hurt. At times, it genuinely broke me. But I kept going.",
      "There wasn't some famous mentor behind the journey. There wasn't one person who came along and showed me exactly how to do it. For much of the journey, I had to figure things out as I went — making decisions, trying things, changing direction, and learning what the next step required.",
      "The project itself changed along the way too:\n• It started as BKCN — BDSM and Kinks Club Nigeria.\n• Then it became Kinkstone.\n• Eventually, it became Kinkord.",
      "The name changed because the idea was changing. What started as a WhatsApp group for Nigerian kinksters had become the foundation for something I believed could exist on a much larger scale.",
      "And that's where the journey stands today: From a WhatsApp group to an app.",
      "I'm not going to call the journey complete. It isn't. The biggest chapter hasn't happened yet. I'm still building.",
    ],
  },
  {
    id: "lesson-setback-growth",
    title: "Lesson, Setback & Growth",
    badge: "Lessons, Setbacks & Growth",
    paragraphs: [
      "Building something ambitious has taught me that progress rarely happens in a straight line. Some decisions worked. Others did not. Some plans required more resources, experience or preparation than I initially understood. Those experiences have shaped the way I lead today.",
      "One of my most important lessons has been that conviction must be matched by execution. Having a strong idea is only the beginning. Turning it into something valuable requires discipline, planning, accountability and the ability to adjust when reality does not match the original plan.",
      "I have also learned to take responsibility for my commitments. There have been times when I underestimated what something would require or committed before fully understanding the challenges involved. Those experiences taught me to be more deliberate, communicate more clearly and consider the consequences before making decisions.",
      "Another important shift was learning not to make progress dependent on perfect circumstances. I once believed I needed the right people, sufficient resources and ideal conditions before I could move forward. I eventually realized that waiting for everything to align can become a barrier of its own.",
      "So I changed my approach. I started working with what I had. That meant becoming more resourceful, learning what I did not know, solving problems directly and focusing on meaningful progress rather than waiting for perfect conditions.",
      "I have also become more comfortable challenging my own assumptions. When something does not work, I want to understand why, take the lesson from it and improve the process rather than simply repeat the same approach.",
      "These experiences have made me more disciplined, more realistic and more conscious of the responsibility that comes with leadership.",
      "I don't believe growth means getting everything right. I believe it means becoming better at recognizing what needs to change—and having the discipline to change it.",
      "That is the mindset I bring to everything I build.",
    ],
  },
  {
    id: "my-mission",
    title: "My Mission",
    badge: "Purpose",
    paragraphs: [
      "My mission is to create a global space where kinksters can learn, connect, discover, and enjoy—through education, entertainment, events, and meaningful matchmaking. I want to help build a community where people can participate with greater confidence because trust, authenticity, and verification matter.",
      "At the heart of my mission is innovation: continuously finding better ways to serve a community that deserves modern, purpose-built experiences.",
      "My ultimate goal is to build something that reaches 100 million users worldwide, while never allowing money or growth to become more important than creating a safe and trustworthy space for the people who use it.",
    ],
  },
  {
    id: "my-vision",
    title: "My Vision",
    badge: "Future Horizon",
    paragraphs: [
      "My vision is to build the world's largest and most influential kink community—the world’s leading kink platform, matchmaking destination, and gallery for sexual kinks.",
      "But I don't want Kinkord to be just an app. I envision it becoming a global ecosystem that helps shape the future of the kink community.",
      "I want to contribute to a kink world built around safety, consent, respect, and acceptance—where kink can be explored with greater responsibility, understanding, and dignity.",
      "Ultimately, I want to leave the kink community better than I found it.",
    ],
  },
  {
    id: "what-im-building",
    title: "What I'm Building",
    badge: "Platform & Community",
    paragraphs: [
      "I’m building Kinkord—a purpose-built global platform for the kink community, bringing together the things kinksters need in one place.",
      "Kinkord combines community, matchmaking, education, entertainment, events, a marketplace, creator opportunities, and verified profiles into one ecosystem. At its heart is Kinkopedia, a free educational library designed to make reliable kink knowledge accessible to everyone.",
      "I’m building a platform where people can meet, connect, learn, discover, share, participate, create, and find opportunities within a community designed specifically for kinksters.",
      "Rather than building another platform that simply accommodates kink, I’m building an ecosystem made for it from the ground up.",
    ],
  },
  {
    id: "founders-journey",
    title: "Founder's Journal",
    badge: "Journal Entries",
    paragraphs: [
      "Welcome to my personal founder's journal. Here I share real-time updates, milestones, reflections, and the journey of building Kinkord one piece at a time.",
    ],
    journalEntries: [
      {
        date: "9 September 2026",
        title: "Building Kinkord’s Profile & Posting Features",
        paragraphs: [
          "This week, we started building Kinkord’s profile and posting features.",
          "I chose the profile as one of the first things to build because I want people to understand each other better — from kinks, interests and roles to relationship status, occupation, limits, monogamy or polyamory, and more.",
          "We’re still building it, but the vision is simple:",
        ],
        quote: "“I understand all I need to know about this person.”",
        closing: "One piece at a time.",
      },
      {
        date: "9 September 2026",
        title: "Building the People Behind Kinkord — Founding Team",
        paragraphs: [
          "🚀 Today, my focus is simple: building the people behind Kinkord.",
          "We are looking for our founding team across 10 areas:\n\n1. 💻 Software Engineers & Developers\n2. 🎨 UI/UX & Product Designers\n3. ⚖️ Legal & Compliance\n4. 📣 Marketing, Publicity & Growth\n5. 🎓 Lecturers & Education Team\n6. 📸 Photography & Videography\n7. 🎭 Models, Creators & Brand Ambassadors\n8. 🛡️ Trust, Safety & Community\n9. 🤝 Business, Partnerships & Investor Relations\n10. 📊 Research, Strategy & Operations",
          "You don't have to be an expert. If you have skills, knowledge, experience, creativity, connections, or something valuable to contribute, I want to hear from you. 🌍",
          "This is still the beginning, and I'm looking for people who want to help build Kinkord from the ground up. 🦁",
          "Years from now, I want our founding members to be able to say:\n\n«“I was there when Kinkord was just getting started.”»\n\n🚀 This is the beginning. Let's build.",
        ],
        whatsappUrl: "https://wa.me/2349127883266",
        whatsappLabel: "Join the Founding Team on WhatsApp",
      },
    ],
  },
  {
    id: "contact-the-founder",
    title: "Contact the Founder",
    badge: "Direct Communication",
    paragraphs: [
      "I believe great ideas, meaningful conversations, partnerships, and opportunities can come from anywhere.",
      "Whether you want to share an idea, discuss Kinkord, explore a business opportunity, collaborate, offer feedback, or simply reach out, you can connect with me through any of the channels below.",
      "Choose the option that works best for you:",
    ],
    contactChannels: [
      {
        icon: "🌐",
        name: "Kinkord App",
        handle: "@tegamaxwell",
        description: "Connect with me directly on Kinkord.",
        href: "/profile",
      },
      {
        icon: "💬",
        name: "WhatsApp",
        handle: "09127883266",
        description: "For direct messages and conversations.",
        href: "https://wa.me/2349127883266",
      },
      {
        icon: "📧",
        name: "Email",
        handle: "maxihandsome@gmail.com",
        description: "For formal enquiries, proposals, partnerships, and business matters.",
        href: "mailto:maxihandsome@gmail.com?subject=Enquiry%20for%20Tega%20Maxwell",
      },
      {
        icon: "📱",
        name: "Phone Call",
        handle: "+234 (0) 9032462810",
        description: "For matters that are better discussed directly.",
        href: "tel:+2349032462810",
      },
      {
        icon: "📘",
        name: "Facebook",
        handle: "Sirtegamaxwell",
        description: "Follow or connect with me on Facebook.",
        href: "https://facebook.com/Sirtegamaxwell",
      },
      {
        icon: "📸",
        name: "Instagram",
        handle: "Sirtegamaxwell",
        description: "Follow my journey and connect with me on Instagram.",
        href: "https://instagram.com/Sirtegamaxwell",
      },
      {
        icon: "🎵",
        name: "TikTok",
        handle: "Sirtegamaxwell",
        description: "Follow my content, updates, and founder journey.",
        href: "https://tiktok.com/@Sirtegamaxwell",
      },
      {
        icon: "✈️",
        name: "Telegram",
        handle: "Sirtegamaxwell",
        description: "Connect with me on Telegram.",
        href: "https://t.me/Sirtegamaxwell",
      },
      {
        icon: "📅",
        name: "Book a Meeting",
        handle: "Schedule a Session",
        description: "Have something important to discuss? Schedule a meeting for business, partnerships, or collaboration.",
        href: "mailto:maxihandsome@gmail.com?subject=Meeting%20Request%20-%20Tega%20Maxwell",
      },
      {
        icon: "▶️",
        name: "YouTube",
        handle: "Sirtegamaxwell",
        description: "Follow my YouTube channel for videos, updates, conversations, and more.",
        href: "https://youtube.com/@Sirtegamaxwell",
      },
    ],
    closingNote: "🤝 Let's Connect\n\nI may not be able to respond immediately to every message, but I value genuine conversations and meaningful opportunities.\n\nThank you for taking the time to reach out.",
  },
  {
    id: "work-with-me",
    title: "Work with Me",
    badge: "Collaboration & Careers",
    paragraphs: [
      "Content for Work with Me will be provided here.",
    ],
  },
  {
    id: "my-message-to-the-community",
    title: "My Message to the Community",
    badge: "To the Kinkord Community",
    paragraphs: [
      "To every kinkster who finds their way to Kinkord:",
      "I built Kinkord because I believe our community deserves a trusted, safer and better space to learn, connect, express themselves, discover events and meet like-minded people.",
      "Kinkord is more than an app to me. It is a commitment to our community.",
      "I want you to question us, share your ideas, challenge us and hold me accountable. I don't have every answer, but I am committed to listening, learning and building with you.",
      "Together, let's build more than a social platform.\n\nLet's build a home for the kink community.",
    ],
  },
  {
    id: "founders-principle",
    title: "Founder's Principles",
    badge: "Core Principles",
    paragraphs: [
      "These are the principles I will carry with me as I build Kinkord.",
    ],
    principles: [
      {
        number: 1,
        icon: "🛡️",
        title: "Safety Before Growth",
        description:
          "No amount of growth is more important than the safety and wellbeing of our community.",
      },
      {
        number: 2,
        icon: "🤝",
        title: "Consent Is Non-Negotiable",
        description:
          "Every interaction must be grounded in informed, enthusiastic and respected consent.",
      },
      {
        number: 3,
        icon: "❤️",
        title: "Community Before Ego",
        description:
          "Kinkord exists to serve its community, not the ego of its Founder.",
      },
      {
        number: 4,
        icon: "🔐",
        title: "Trust Must Be Earned",
        description:
          "We will build trust through transparency, consistency, accountability and action.",
      },
      {
        number: 5,
        icon: "📚",
        title: "Education Over Misinformation",
        description:
          "We will promote knowledge, responsible kink practices and informed decision-making.",
      },
      {
        number: 6,
        icon: "⚖️",
        title: "Accountability Over Excuses",
        description:
          "When we get something wrong, we acknowledge it, learn from it and do better.",
      },
      {
        number: 7,
        icon: "🚀",
        title: "Build for the Future",
        description:
          "We are not building merely for today. We are building something that can serve generations of kinksters to come.",
      },
    ],
  },
] as const;

export const ABOUT_PAGE_DATA = {
  brand: "KINKORD",
  aboutTitle: "ABOUT",
  aboutTitleAccent: "KINKORD",
  teamTitle: "MEET THE",
  teamTitleAccent: "TEAM",
  memberProfileTitle: "MEMBER PROFILE",
  meetTeamCta: "MEET THE TEAM",
  meetTeamSubtitle: "Discover the innovators behind our vision",
  joinTeamCta: "JOIN KINKORD TEAM",
  joinTeamSubtitle: "Be part of the community",
  founderMessage: {
    badge: "A message from the Founder",
    paragraphs: [
      "Behind Kinkord is a growing team of people who believe that building a great community takes more than technology; it takes people who care about the experience, the culture, and the people we serve.",
      "Every member of our team contributes differently. From technology and product design to operations, community, growth, and leadership, we each have a responsibility to help shape Kinkord into a platform that is thoughtful, innovative, welcoming, and built to last. This page gives you the opportunity to meet some of the people working behind the scenes and understand the roles they play in bringing our vision to life.",
      "Kinkord is still growing, and so is our team. We are always open to meeting talented, passionate, and driven people who believe in what we are building and want to contribute to the journey. There is room at the table for people who want to build, create, solve problems, and make an impact.",
      "Thank you for taking the time to meet the people behind Kinkord.",
    ],
    founderName: "Tega Maxwell",
    founderRole: "Founder & CEO, Kinkord",
  },
  ceo: {
    id: "tega-maxwell",
    name: "Tega Maxwell",
    handle: "SirT_M",
    verified: true,
    role: "CEO & Founder",
    age: 28,
    location: "Delta State, NG",
    gender: "Male",
    avatarUrl: "/brand/founder-tega-maxwell.jpg",
    bio: [
      "I am Tega Maxwell, a Nigerian from Delta State, born on 26 March 1998.",
      "I’m a professional athlete, business executive, entrepreneur, and Founder and CEO of Temaxiro Limited, the parent company of Kinkord.",
      "I have a strong passion for business and innovation. I’m fascinated by new ideas, emerging possibilities and creating businesses that introduce something different to the market. Innovation is something I look for in every business I start.",
      "Outside work, I enjoy watching football and movies, playing games, reading and researching. I’m naturally curious and enjoy discovering information, exploring new subjects and learning about things that interest me.",
    ],
    email: "maxihandsome@gmail.com",
    communityHandle: "@tegamaxwell / Kinkord",
    responseNote: "Usually responds within 24 hours",
  } as TeamMemberData,
  founderTopics: FOUNDER_TOPICS,
  copyright: COPYRIGHT_LINE,
  allRightsReserved: ALL_RIGHTS_RESERVED,
} as const;

export type { PolicyLink };
