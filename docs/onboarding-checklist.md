# Client Onboarding Checklist — Done-for-You Intake System

Full delivery process for the **$1,500 setup + $297/mo** managed package.
Target setup time: **5–7 business days**. Owner tags: **(You)** = Alignment Automations, **(Client)** = the customer.
Duplicate this list per client in the CRM.

---

## Phase 0 — Sale & Agreement (Day 0)
- [ ] (You) Discovery call completed; confirmed it's a fit
- [ ] (You) Scope/proposal sent and accepted
- [ ] (Client) Service agreement signed — month-to-month, cancel anytime, ownership-handover-on-exit, scope of what's included
- [ ] (Client) First payment collected — **$1,797** ($1,500 setup + first $297/mo) via Stripe
- [ ] (You) Recurring **$297/mo** subscription created & confirmed active
- [ ] (You) Client record created in CRM; this checklist attached

## Phase 1 — Kickoff & Intake (Day 1)
Send the client ONE intake form to collect all of this:
- [ ] (Client) Business basics: legal name, brand name, service area, trades/services, business hours
- [ ] (Client) Logo, brand colors, 6–12 photos of real work
- [ ] (Client) Services list + pricing notes, top FAQs, short "about us"
- [ ] (Client) Google/Facebook reviews or testimonials to feature
- [ ] (Client) Business phone number (the line that gets missed calls)
- [ ] (Client) Where leads go (their cell # / email for instant notifications)
- [ ] (Client) Calendar to sync (Google or Outlook) + availability rules, estimate duration, travel buffer
- [ ] (Client) Existing website? Domain owner + registrar login (or authorization to register new)
- [ ] (Client) Existing Google Business Profile? Access/ownership transfer (or confirm none exists)
- [ ] (Client) Business email address for sending follow-ups
- [ ] (You) Kickoff confirmation sent: timeline, what's needed, what's next

## Phase 2 — Accounts & Infrastructure (Day 1–2, on accounts you manage)
- [ ] (You) Domain registered or access delegated; DNS configured
- [ ] (You) Google Business Profile claimed & verified — or created new if none exists
- [ ] (You) GBP corrected: categories, service area, hours, phone, website link, photos uploaded
- [ ] (You) Hosting set up (Cloudflare / GitHub Pages)
- [ ] (You) Email deliverability: **SPF, DKIM, DMARC** records (so follow-ups don't hit spam)
- [ ] (You) SMS/telephony provider set up for missed-call text-back
- [ ] (You) ⚠️ **A2P 10DLC brand + campaign registered** (required for US business SMS — start Day 1, approval can lag days)
- [ ] (You) STOP/opt-out handling enabled on the text-back number (compliance)
- [ ] (You) Automation platform connected (Make.com)
- [ ] (You) Booking tool (Cal.com) connected to client's calendar
- [ ] (You) Lead-logging destination set up + internal notification channel

## Phase 3 — Build & Configure (Day 2–4)
- [ ] (You) Website built: home, services, about, contact/quote pages
- [ ] (You) Quote/intake form wired to webhook → lead log + instant notification + auto-confirmation email
- [ ] (You) Follow-up email sequence written & scheduled
- [ ] (You) Missed-call text-back message written & live (includes booking link)
- [ ] (You) Booking flow built: confirmation + reminder messages
- [ ] (You) Full flow mapped end to end (inquiry → response → booked → logged)

## Phase 4 — QA & Testing (Day 4–5)
- [ ] (You) Submit form as a real customer — confirm log + notification + auto-email all fire
- [ ] (You) Place a real missed call — confirm text-back sends with correct link
- [ ] (You) Check auto-emails land in **inbox, not spam**
- [ ] (You) Book a test appointment — confirm calendar sync + reminders
- [ ] (You) Confirm client receives lead notifications on phone/email
- [ ] (You) Mobile/responsive + page-speed check
- [ ] (You) Proofread all copy; verify phone, email, service area, hours

## Phase 5 — Client Review & Approval (Day 5–6)
- [ ] (You) Send preview link + short Loom walkthrough
- [ ] (Client) Review and send feedback
- [ ] (You) Implement revisions
- [ ] (Client) Final approval / sign-off to launch

## Phase 6 — Launch (Day 6–7)
- [ ] (You) Point domain live / DNS cutover; confirm site loads on real URL
- [ ] (You) Confirm all automations live on the production site
- [ ] (You) Uptime/monitoring enabled
- [ ] (You) Send "You're live" summary: plain-English of what they have, how leads reach them, what to expect, who to contact
- [ ] (You) Mark CRM stage → **Active / Managed**

## Phase 7 — Post-Launch & Ongoing (recurring)
- [ ] (You) 30-day tuning check-in (the included post-launch window)
- [ ] (You) Confirm recurring billing ran successfully (monthly)
- [ ] (You) Monthly: monitor uptime, deliverability, automations; make small edits
- [ ] (You) Monthly/quarterly: short performance recap to client (leads captured, booked)
- [ ] (You) Lead-gen tasks, if applicable to that client

## Phase 8 — Offboarding (only if they cancel)
- [ ] (You) Cancel recurring billing
- [ ] (You) Transfer domain, website, calendar, and lead data to the client ("it stays yours" promise)
- [ ] (You) Disable/clean up managed accounts; confirm handover complete

---

## Don't-miss compliance items
1. **A2P 10DLC registration** (Phase 2) — US carriers require registration for business texting. Skip it and missed-call text-backs can be silently blocked. Start Day 1.
2. **Email authentication (SPF/DKIM/DMARC)** — without it, automated follow-ups land in spam, which kills the value prop. Non-negotiable per client.
