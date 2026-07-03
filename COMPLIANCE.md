# Australian Compliance

Launchpad deploys AI voice agents (Mia) and SMS/email follow-up workflows for
Australian small businesses, via agencies. There's no standalone AI Act in
Australia — compliance means existing law:

- **ACL s18** — misleading or deceptive conduct
- **State call-recording / surveillance laws**
- **Do Not Call Register Act 2006 + ACMA Telemarketing Standard**
- **Spam Act 2003**
- **Privacy Act (Australian Privacy Principles)**, including the
  automated-decision-making transparency obligations commencing
  10 December 2026

## What Launchpad handles automatically, on every deployment

1. **AI disclosure in every greeting.** Mia's opening line always identifies
   her as an AI assistant and discloses that the call may be recorded. This
   is enforced in code after the interview, so it can't be edited away.
2. **Non-negotiable guardrails.** Mia will always tell a caller truthfully if
   asked whether she's AI, never claim to be human, offer to transfer to a
   real person on request, and never collect sensitive details (health,
   financial account numbers) beyond what booking requires.
3. **SMS opt-out.** Every client gets a generated SMS footer with sender
   identification and "Reply STOP to opt out" — append it to outbound SMS
   templates in the snapshot.
4. **A ready-to-paste privacy policy paragraph**, generated per client,
   disclosing that an AI handles calls/messages, what it collects, that
   calls may be recorded, and that automated systems are used — written to
   satisfy the Privacy Act's automated-decision-making transparency
   requirement from 10 December 2026.
5. **Outbound calling warning.** If a client says Mia will make outbound
   calls, the interview tells them outbound telemarketing must be washed
   against the Do Not Call Register and is restricted to 9am–8pm weekdays /
   9am–5pm Saturdays, never Sundays or public holidays.
6. **Sign-off gate.** The review screen requires the person deploying to
   confirm they're authorised to set this up for the business before Deploy
   is enabled.

## What YOU (the agency) must still do

- **DNC washing.** Before switching on outbound calling for any client,
  confirm their number list has been checked against the Do Not Call
  Register. Launchpad doesn't do this for you.
- **Privacy policy update.** Add the generated privacy policy snippet to the
  client's actual privacy policy before go-live — Launchpad hands you the
  text, it doesn't publish it.
- **Client agreement / terms.** Make sure your services agreement with the
  client covers their responsibility for the accuracy of information given
  to Mia, and their consent to AI handling of their customers' calls.
- **State recording laws.** Some states require all-party consent to record
  calls — confirm with legal that the greeting disclosure is sufficient for
  your client's state.

## Bottom line

This is general information, not legal advice — have your client agreement
and scripts reviewed by a lawyer.
