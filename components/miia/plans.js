// Shared plan data — pricing cards, the home founding strip, and the
// get-started plan picker all read from this one list so the numbers can
// never drift between pages.
export const PLANS = [
  {
    id: "chat",
    name: "Miia Chat",
    tagline: "One channel of your choice",
    price: 99,
    foundingPrice: 79,
    replies: "500 replies a month",
    features: ["One channel of your choice", "500 replies a month", "Trained in one 10 minute chat", "Live in minutes"],
    popular: false,
  },
  {
    id: "everywhere",
    name: "Miia Everywhere",
    tagline: "Web, Facebook, Instagram and SMS",
    price: 249,
    foundingPrice: 199,
    replies: "1,500 replies a month",
    features: [
      "Web chat, Facebook, Instagram and SMS",
      "Your own local SMS number",
      "1,500 replies a month",
      "Live in 48 hours",
    ],
    popular: true,
  },
  {
    id: "complete",
    name: "Miia Complete",
    tagline: "Everything, plus she answers your phone",
    price: 399,
    foundingPrice: 319,
    replies: "300 call minutes a month",
    features: [
      "Everything in Miia Everywhere",
      "Miia answers your phone",
      "300 call minutes a month",
      "Live in 48 hours",
    ],
    popular: false,
  },
];

export const WHITE_GLOVE = {
  name: "White glove setup",
  price: 990,
  tagline: "Want it all done for you? We set up everything and hand your team a training video.",
};

export const FOUNDING_SPOTS = 20;
export const FOUNDING_DISCOUNT = "20% off for life";

export function yearlyPerMonth(price) {
  return Math.round((price * 10) / 12);
}

export function yearlyTotal(price) {
  return price * 10;
}

export function getPlan(id) {
  return PLANS.find((p) => p.id === id);
}
