// Full FAQ set lives on /pricing. Home reuses the most objection-heavy six
// (see HOME_FAQ_IDS) so the two pages never fall out of sync on wording.
export const FAQ_ITEMS = [
  {
    id: "robot",
    q: "Will Miia sound like a robot?",
    a: "No. She's trained on your actual business in a 10 minute conversation, not a script someone else wrote. She replies the way you'd want your best staff member to.",
  },
  {
    id: "setup",
    q: "What do I need to set up?",
    a: "Nothing technical. Have the 10 minute chat, connect the channels you want with a few clicks, and Miia goes live. No developers, no forms, no waiting on an agency.",
  },
  {
    id: "speed",
    q: "How fast is she actually live?",
    a: "Web chat and social channels can be live the same day. A dedicated phone number needs carrier registration, which usually clears within 48 hours. Either way, Miia is trained and ready the moment you finish the chat.",
  },
  {
    id: "handoff",
    q: "What happens when someone needs a real person?",
    a: "Miia hands over immediately, any time a customer asks for a human or she can't help. You're never locked out of your own conversations.",
  },
  {
    id: "lockin",
    q: "Is there a lock-in contract?",
    a: "None. Cancel any time from your dashboard. No calls, no forms, no hard feelings.",
  },
  {
    id: "payAI",
    q: "Who pays for the AI?",
    a: "It's included. Every plan has AI usage built into the price, with a generous monthly cap so you're never metered per message.",
  },
  {
    id: "legal",
    q: "Is this legal in Australia?",
    a: "Yes. AI disclosure, recording notices and opt-outs are built into every deployment by default. Miia always says she's an AI when asked, and your Privacy Act obligations are covered from day one.",
  },
  {
    id: "cost",
    q: "What does it cost to run?",
    a: "Nothing extra within your plan's cap. If you're ever close to going over, we'll tell you before anything changes. Never a surprise bill.",
  },
];

export const HOME_FAQ_IDS = ["robot", "speed", "handoff", "lockin", "payAI", "legal"];

export function faqByIds(ids) {
  return ids.map((id) => FAQ_ITEMS.find((f) => f.id === id)).filter(Boolean);
}
