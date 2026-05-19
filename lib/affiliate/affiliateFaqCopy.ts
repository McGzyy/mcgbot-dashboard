/** FAQ content for the public affiliate marketing site. */

export type AffiliateFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type AffiliateFaqSection = {
  title: string;
  items: AffiliateFaqItem[];
};

export const AFFILIATE_FAQ_SECTIONS: AffiliateFaqSection[] = [
  {
    title: "Program basics",
    items: [
      {
        id: "what-is",
        question: "What is the McGBot affiliate program?",
        answer:
          "You promote McGBot Terminal (our member trading dashboard) with a personal tracking link. When someone subscribes through your link, you earn commission on their payments plus eligible bonuses. This portal is separate from the member Discord login.",
      },
      {
        id: "who",
        question: "Who can apply?",
        answer:
          "Creators, community leaders, and promoters with a real audience. We review every application manually. You must be 18+ and able to promote responsibly (disclosures, no spam, no guaranteed-profit claims).",
      },
      {
        id: "member-vs-affiliate",
        question: "Is this the same as the McGBot member dashboard?",
        answer:
          "No. Members sign in with Discord to use the terminal. Affiliates use this site with email, password, and mandatory authenticator 2FA. You do not need a member subscription to be an affiliate.",
      },
    ],
  },
  {
    title: "Commissions & bonuses",
    items: [
      {
        id: "payment-timeline",
        question: "What does “1st payment, 2nd payment” mean?",
        answer:
          "Each referred member has their own timeline — not calendar months on your schedule. Monthly subscribers: 20% on payments 1–12, then 10% on payments 13–36. Annual subscribers: 20% on their first annual payment, 10% on their 2nd and 3rd annual renewals. See the program page for full tables and the first-annual signup bonus.",
      },
      {
        id: "milestones",
        question: "What are milestone bonuses?",
        answer:
          "One-time cash bonuses when you reach qualified active referral counts (10, 25, and 50). These are separate from the recurring % on each member’s payments. See the earnings breakdown on the program page for qualification rules.",
      },
      {
        id: "annual",
        question: "Do annual subscribers count?",
        answer:
          "Yes. Annual plans still advance that member’s payment index once per year, and you may receive a one-time signup bonus on their first annual invoice ($5 Basic / $10 Pro).",
      },
    ],
  },
  {
    title: "Applying & account",
    items: [
      {
        id: "how-long",
        question: "How long does approval take?",
        answer:
          "We review applications manually. Timing varies. While pending, you can sign in and complete 2FA setup, but dashboard access unlocks after approval and signing the affiliate agreement.",
      },
      {
        id: "rejected",
        question: "Can I reapply if denied?",
        answer:
          "It depends on our review decision. Some denials are final; others allow you to sign in and submit an updated application after a waiting period. Check your application status page after signing in.",
      },
    ],
  },
  {
    title: "Tracking & payouts",
    items: [
      {
        id: "links",
        question: "How do tracking links work?",
        answer:
          "After approval you receive a main tracking link and can create campaign sub-links in your dashboard. Clicks are attributed for a limited window before signup; use the link we provide for accurate tracking.",
      },
      {
        id: "hold",
        question: "Why are some commissions still pending?",
        answer:
          "Rev-share and annual signup bonuses stay pending for about 30 days (monthly subscribers) or 90 days (annual) after the member pays. They auto-approve if the member is still subscribed when the hold ends. Refunds void pending or approved commissions tied to that invoice.",
      },
      {
        id: "payouts",
        question: "When do I get paid?",
        answer:
          "Commissions move through pending → approved → paid in your ledger. You can request payouts from the dashboard when you have an available balance above the minimum. Ops reviews payout requests manually.",
      },
    ],
  },
];
