// Client-safe: no @netlify/blobs import, so pages can import this directly.
export const NOTIFICATION_TOGGLES = [
  { id: "client_deployed", label: "New client deployed", help: "When a new client system is deployed", default: true },
  { id: "needs_attention", label: "Client needs attention", help: "When a client's data sync needs authorisation", default: true },
  { id: "checklist_ticked", label: "Checklist item ticked", help: "Every time a go-live checklist item is completed", default: false },
  { id: "marked_live", label: "Client marked live", help: "When a client's status is set to Live", default: true },
];
