// The interview. One field at a time, in this order.
// "field" keys become the structured answers object; Claude drives the
// conversation but this list is the source of truth for what must be captured.

export const INTERVIEW_FIELDS = [
  { field: "contact_name",  ask: "the name of the person we're talking to" },
  { field: "business_name", ask: "the business name" },
  { field: "services",      ask: "what the business does - services offered, in their words" },
  { field: "service_area",  ask: "the area they serve (suburbs, city, statewide, online)" },
  { field: "opening_hours", ask: "opening/operating hours" },
  { field: "ideal_lead",    ask: "what a great lead looks like - the one or two questions that tell them a caller is worth booking" },
  { field: "booking_rules", ask: "how appointments work - length, buffers, who takes them, anything Mia must know before booking" },
  { field: "faqs",          ask: "the 3 questions customers ask most, with the answers they give" },
  { field: "tone",          ask: "how Mia should sound: professional, friendly, casual - plus phrases they love or hate" },
  { field: "escalation",    ask: "who Mia should hand a call to when a human is needed - name and best contact" },
  { field: "outbound_calls", ask: "will Mia make OUTBOUND calls to leads, or answer inbound only?" },
  { field: "website",       ask: "their website URL (or 'none')" },
  { field: "guardrails",    ask: "anything Mia must NEVER say or do - pricing promises, guarantees, competitors, whatever is off-limits" },
];

// Custom value keys pushed into GHL. These MUST match the custom values
// referenced inside the Lab HQ snapshot (Mia's prompt, workflows, templates)
// as {{ custom_values.key_name }}.
export const CUSTOM_VALUE_KEYS = [
  "business_name",
  "services_summary",
  "service_area",
  "opening_hours",
  "qualification_questions",
  "booking_rules",
  "faq_block",
  "tone_style",
  "greeting_line",
  "escalation_name",
  "escalation_contact",
  "website_url",
  "mia_guardrails",
  "nurture_hook",
  "sms_compliance_footer",
  "privacy_policy_snippet",
];
