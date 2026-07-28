// Single source of truth for the six "who she's for" industries — the
// home page cards, the /miia-for-x pages and their chat demos, and the
// sitemap all read from this list so none of it can drift out of sync.
export const INDUSTRIES = [
  {
    slug: "tradies",
    path: "/miia-for-tradies",
    name: "Tradies",
    audienceSingular: "trade",
    cardBody:
      "The 7pm burst pipe or the Sunday call out. Miia qualifies the job and locks in a time while you're still under the house.",
    heroSub:
      "Burst pipes don't wait for business hours and neither does Miia. She answers every call and message, quotes the callout, and locks in a time, day or night.",
    painPoints: [
      {
        heading: "Emergency jobs come in at the worst times",
        body: "The 9pm hot water outage or the Saturday morning no-power call. Miss it and they've already rung the next name on Google.",
      },
      {
        heading: "Quoting takes you off the tools",
        body: "Every enquiry Miia handles is a call you didn't have to stop mid-job to take.",
      },
      {
        heading: "Good leads go cold fast",
        body: "Tradies who reply first win the job. Miia replies in under a minute, every time.",
      },
    ],
    chat: {
      customer: {
        text: "hi, got water coming through the ceiling near a light, can anyone come today? we're in Stafford Heights. how much roughly?",
        time: "2:14 pm",
      },
      reply: {
        text: "That needs someone today. We can have a plumber out this afternoon, emergency call out is $250 for the first hour and we service Stafford Heights. Want me to lock in a time between 2 and 4pm?",
        time: "2:15 pm",
      },
    },
    faq: [
      {
        q: "Can Miia quote a job on the spot?",
        a: "Yes. Once she's trained on your price list and callout fees, she gives real numbers, not a vague we'll call you back.",
      },
      {
        q: "What if the job needs a real assessment first?",
        a: "She'll capture the details and photos if the customer has them, then hand straight to you or your team for anything that needs an in-person look.",
      },
      {
        q: "Does she work nights and weekends?",
        a: "24/7. Trade enquiries don't stick to business hours, and neither does Miia.",
      },
    ],
    seoTitle: "Miia for tradies: AI answering for plumbers, electricians and builders",
    seoDescription:
      "Miia is the AI front desk for trade businesses. She answers calls and messages, quotes callouts and books jobs in your calendar, day and night.",
  },
  {
    // Beachhead vertical - hand-written page at /allied-health, not the
    // shared IndustryPage template. Kept here only for cross-linking: the
    // home page's "who's this for" grid and the other five vertical pages'
    // "Miia for other industries" grid both read name/path/cardBody for
    // every industry uniformly.
    slug: "allied-health",
    path: "/allied-health",
    name: "Allied Health & Clinics",
    cardBody:
      "New patient enquiries answered the moment they land, booked straight into the gaps in your calendar, no receptionist required after hours.",
  },
  {
    slug: "salons",
    path: "/miia-for-salons",
    name: "Salons",
    audienceSingular: "salon",
    cardBody:
      "Every DM and website enquiry about availability gets a real answer in seconds, so bookings fill while you're with a client.",
    heroSub:
      "Every DM, text and website enquiry about availability gets a real answer in seconds, so your book fills up while your hands are full with a client.",
    painPoints: [
      {
        heading: "You can't answer your phone mid-cut",
        body: "Miia takes the enquiry, checks what's actually free, and books it in. No missed calls between clients.",
      },
      {
        heading: "Instagram DMs are a second inbox",
        body: "Every how much for a balayage question gets answered on the spot, not whenever you next check your phone.",
      },
      {
        heading: "Last-minute cancellations leave gaps",
        body: "Miia can offer that freed-up slot to the next enquiry before it ever shows as empty.",
      },
    ],
    chat: {
      customer: {
        text: "hey do you have a balayage appointment free this saturday arvo? how much roughly",
        time: "11:20 am",
      },
      reply: {
        text: "We do, 1:30pm or 3pm this Saturday with Jess. A full balayage starts at $220 depending on length. Want me to pop you in for 1:30?",
        time: "11:21 am",
      },
    },
    faq: [
      {
        q: "Can she quote different services and stylists?",
        a: "Yes. Once she knows your price list and who does what, she gives real quotes instead of a generic prices vary.",
      },
      {
        q: "What about walk-in availability?",
        a: "She can check today's actual gaps, not just a general we're usually busy Saturdays.",
      },
      {
        q: "Does she handle Instagram and Facebook DMs?",
        a: "Website chat, Facebook and Instagram all answer through the same Miia, trained once.",
      },
    ],
    seoTitle: "Miia for salons: AI booking assistant for hair and beauty",
    seoDescription:
      "Miia answers DMs, texts and website enquiries for salons, quoting real prices and booking straight into your calendar.",
  },
  {
    slug: "gyms",
    path: "/miia-for-gyms",
    name: "Gym & Fitness",
    audienceSingular: "gym",
    cardBody:
      "Casual pass, class timetable, membership pricing. Miia answers every question the moment it lands and gets new members through the door.",
    heroSub:
      "Casual pass questions, class timetables, membership pricing. Miia answers every enquiry the moment it lands and gets new members through the door.",
    painPoints: [
      {
        heading: "Front desk can't be everywhere",
        body: "Between classes and check-ins, phone and DM enquiries wait. Miia answers them the second they arrive.",
      },
      {
        heading: "Trial and casual enquiries go cold",
        body: "Someone asking about a week pass at 9pm is ready to join now. Miia gets back to them in under a minute.",
      },
      {
        heading: "Class timetables change constantly",
        body: "She's trained on your current schedule, not last month's PDF someone forgot to update.",
      },
    ],
    chat: {
      customer: {
        text: "hi how much is a casual visit and do you run any HIIT classes on the weekend?",
        time: "6:05 pm",
      },
      reply: {
        text: "Casual visits are $25, or $89 for a 2 week trial with full access. We run HIIT Saturday 8am and Sunday 9am. Want me to save you a spot in Saturday's class?",
        time: "6:06 pm",
      },
    },
    faq: [
      {
        q: "Can Miia sign someone up on the spot?",
        a: "She can capture their details and get them booked into a trial or class, then your team handles the actual membership paperwork.",
      },
      {
        q: "Does she know our class timetable?",
        a: "Yes, trained on your real schedule, and updated whenever it changes.",
      },
      {
        q: "What about membership pricing questions?",
        a: "She answers with your actual pricing, not a vague check our website.",
      },
    ],
    seoTitle: "Miia for gyms and fitness studios: AI front desk for enquiries",
    seoDescription:
      "Miia answers class, membership and casual visit questions for gyms and fitness studios the moment they land, day or night.",
  },
  {
    slug: "law-firms",
    path: "/miia-for-law-firms",
    name: "Law Firms",
    audienceSingular: "law firm",
    cardBody:
      "Every new enquiry qualified and booked into a consult, so your team spends time on clients, not screening calls.",
    heroSub:
      "Every new enquiry qualified and booked into a consult, so your team spends time on clients, not on the phone screening leads.",
    painPoints: [
      {
        heading: "New enquiries need screening before anyone's time is booked",
        body: "Miia asks the right first questions and captures the basics, so a consult only gets booked once it's a real fit.",
      },
      {
        heading: "After-hours enquiries are common",
        body: "People searching for a lawyer at 8pm want an answer now, not a callback tomorrow.",
      },
      {
        heading: "Reception time is expensive to spend on screening",
        body: "Free up your front desk for clients already in the building, not the initial phone triage.",
      },
    ],
    chat: {
      customer: {
        text: "hi I need some advice about a bond dispute with my landlord, do you offer a free first consult?",
        time: "8:12 pm",
      },
      reply: {
        text: "We do, a free 15 minute initial consult for tenancy matters. Can I grab your name and a few details about the dispute, then get you booked in with one of our solicitors this week?",
        time: "8:13 pm",
      },
    },
    faq: [
      {
        q: "Can Miia give legal advice?",
        a: "No, and she's built not to. She qualifies the enquiry and books the right person in. She never gives advice herself.",
      },
      {
        q: "Does she know what areas of law we practise?",
        a: "Yes, trained on your actual practice areas, so she can point the right enquiry to the right person from the start.",
      },
      {
        q: "What about confidentiality?",
        a: "Miia discloses she's an AI and what she collects, in line with your privacy obligations. Sensitive detail collection is kept to what's needed to book the consult.",
      },
    ],
    seoTitle: "Miia for law firms: AI intake for new client enquiries",
    seoDescription:
      "Miia qualifies new enquiries and books consults for law firms, day and night, so your team's time goes to clients, not phone screening.",
  },
  {
    slug: "real-estate",
    path: "/miia-for-real-estate",
    name: "Real Estate",
    audienceSingular: "real estate",
    cardBody:
      "Every listing enquiry answered instantly, inspections booked and buyers qualified while you're at another open home.",
    heroSub:
      "Every listing enquiry answered instantly, inspections booked and buyers qualified while you're standing at another open home.",
    painPoints: [
      {
        heading: "You can't answer the phone at an open home",
        body: "Miia takes the enquiry, answers the obvious questions and books the next inspection.",
      },
      {
        heading: "Portal enquiries flood in after hours",
        body: "Most property enquiries land at night. Miia replies in under a minute, not next business day.",
      },
      {
        heading: "Unqualified enquiries waste inspection slots",
        body: "She asks the basics, budget, timeline, finance, so you know who's walking through the door.",
      },
    ],
    chat: {
      customer: {
        text: "hi is 12 bay street still available for inspection this weekend?",
        time: "7:48 pm",
      },
      reply: {
        text: "It is. Open home is Saturday 10 to 10:30am, or I can arrange a private inspection if that doesn't suit. Would you like me to send the full listing details?",
        time: "7:49 pm",
      },
    },
    faq: [
      {
        q: "Can Miia answer questions about a specific listing?",
        a: "Yes, trained on your current listings, so she can answer price, inspection times and property details accurately.",
      },
      {
        q: "Does she qualify buyers or just book inspections?",
        a: "Both. She'll ask the basics that matter, timeline and finance, and flag serious buyers to your team.",
      },
      {
        q: "What about after-hours enquiries?",
        a: "She's answering the moment an enquiry lands, portal, website or SMS, any hour.",
      },
    ],
    seoTitle: "Miia for real estate: AI answering for agents and agencies",
    seoDescription:
      "Miia answers listing enquiries, books inspections and qualifies buyers for real estate agents, day and night, on every channel.",
  },
];

export function getIndustry(slug) {
  return INDUSTRIES.find((i) => i.slug === slug);
}
