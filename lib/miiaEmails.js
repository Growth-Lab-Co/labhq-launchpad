// Miia transactional emails. Plain-text feel per spec: wordmark at top only,
// no marketing chrome, no colour blocks, reads like an actual email from a
// person - matches the "Bec here, founder of Miia" voice of the welcome
// email itself.

import { SITE_URL } from "@/components/miia/site";

const WORDMARK_URL = `${SITE_URL}/miia-wordmark-ink.png`;

function wrapPlain(bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 20px;background:#F4EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#16141A;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;">
      <tr><td style="padding-bottom:28px;">
        <img src="${WORDMARK_URL}" alt="Miia" height="28" style="height:28px;width:auto;display:block;" />
      </td></tr>
      <tr><td style="font-size:15px;line-height:1.7;">
        ${bodyHtml}
      </td></tr>
    </table>
  </body>
</html>`;
}

// Verbatim copy as given - the final line ("Reply to this email") is
// intentionally left exactly as provided, not completed/edited.
export function buildWelcomeEmail({ firstName, intakeLink }) {
  const name = firstName || "there";
  const subject = "You're in. Here's what happens next.";

  const text = `Hi ${name},

Bec here, founder of Miia. Thanks for trusting us with your front desk.

Here's your next 48 hours:

Your chat with Miia trains her on your business, so if you haven't finished it, pick it up any time at ${intakeLink}.

Your website chat can go live today: the embed snippet is waiting in your dashboard.

Facebook and Instagram go live the moment you click connect.

Your text number takes 1 to 2 days: we handle the registration paperwork and email you when it clears.

Reply to this email`;

  const html = wrapPlain(`
    <p style="margin:0 0 16px;">Hi ${name},</p>
    <p style="margin:0 0 16px;">Bec here, founder of Miia. Thanks for trusting us with your front desk.</p>
    <p style="margin:0 0 16px;">Here's your next 48 hours:</p>
    <p style="margin:0 0 16px;">Your chat with Miia trains her on your business, so if you haven't finished it, pick it up any time at <a href="${intakeLink}" style="color:#A070F8;">${intakeLink}</a>.</p>
    <p style="margin:0 0 16px;">Your website chat can go live today: the embed snippet is waiting in your dashboard.</p>
    <p style="margin:0 0 16px;">Facebook and Instagram go live the moment you click connect.</p>
    <p style="margin:0 0 16px;">Your text number takes 1 to 2 days: we handle the registration paperwork and email you when it clears.</p>
    <p style="margin:0;">Reply to this email</p>
  `);

  return { subject, html, text };
}

// Internal alert - fires to the ops address when provisioning fails after
// payment, so a paid customer never just silently sits broken.
export function buildProvisioningFailedEmail({ businessName, email, phone, plan, signupId, error }) {
  const subject = `[Miia] Provisioning failed - ${businessName || "unnamed business"}`;
  const text = `A paid Miia signup failed to auto-provision.

Business: ${businessName || "-"}
Email: ${email || "-"}
Phone: ${phone || "-"}
Plan: ${plan || "-"}
Signup id: ${signupId}
Error: ${error}

The customer is seeing "Miia's getting your space ready" until this is retried from /admin/miia-signups.`;
  return { subject, html: `<pre style="font-family:monospace;white-space:pre-wrap;">${text}</pre>`, text };
}
