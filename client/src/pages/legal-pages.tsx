import type { ReactNode } from "react";

// /privacy and /terms - DRAFTS for the business to review with a lawyer before Pulse is sold.
// They are not legal advice. Anything in [square brackets] is a detail only the business can
// fill in; nothing there has been made up. Written for New Zealand (Privacy Act 2020).

const DRAFT_DATE = "12 November 2026";

function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="bg-amber-100 px-1 rounded">[{children}]</mark>;
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div role="note" className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Draft for review, not legal advice.</strong> This page is a working draft written for the business
          behind Pulse to check with a lawyer. It is not yet in force. Items in <Placeholder>brackets</Placeholder> still
          need the business's details.
        </div>
        <h1 className="text-3xl font-bold text-emerald-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">Draft of {DRAFT_DATE}</p>
        <div className="prose prose-slate max-w-none mt-6 space-y-4 text-slate-800 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
        <p className="mt-10 text-sm"><a className="underline" href="/login">Back to Pulse</a> · <a className="underline" href={title.startsWith("Privacy") ? "/terms" : "/privacy"}>{title.startsWith("Privacy") ? "Terms" : "Privacy policy"}</a></p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Pulse is farm management software provided by <Placeholder>business legal name</Placeholder> (NZBN <Placeholder>NZBN</Placeholder>)
        ("we", "us"). This policy explains what personal information we collect through Pulse, why, and your rights under
        the New Zealand Privacy Act 2020.
      </p>

      <h2>Who this covers</h2>
      <p>
        Pulse is used by farm businesses. Each farm (our customer) decides who joins it and what is recorded. For
        records a farm keeps about its own people and animals, the farm is responsible for its use of that information
        and we hold it on the farm's behalf. This policy covers what we do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong>: your name, email address and a scrambled (hashed) form of your password. We never see or store your actual password.</li>
        <li><strong>Farm membership</strong>: which farms you belong to and your role on each.</li>
        <li><strong>Farm records</strong>: what you and your farm enter, such as animals, treatments, paddocks and maps, jobs, timesheets, rosters and leave, health and safety incidents, visitor sign-ins, photos and documents.</li>
        <li><strong>Location</strong>: map positions and, where you allow it in your browser, your device's location while you use location features.</li>
        <li><strong>Billing details</strong>: the farm's billing contact and subscription status. Card details are handled by our payment provider and never stored by Pulse.</li>
        <li><strong>Technical information</strong>: sign-in times, error reports and server logs used to keep Pulse running and secure.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide Pulse to your farm: sign-in, keeping each farm's data to that farm, and the features you use.</li>
        <li>To send emails you need, such as farm invites, password resets, alerts and billing notices.</li>
        <li>To bill the farm for its subscription.</li>
        <li>To keep Pulse secure, fix problems, and meet our legal obligations.</li>
      </ul>
      <p>We do not sell personal information, and we do not use farm records for advertising.</p>

      <h2>Who we share it with</h2>
      <p>We use these service providers to run Pulse. Each handles information only to provide its service to us:</p>
      <ul>
        <li>Database hosting: Neon (data stored in Amazon Web Services' Sydney, Australia region).</li>
        <li>Application hosting: <Placeholder>Railway, region to confirm</Placeholder>.</li>
        <li>File storage for photos and documents: <Placeholder>storage provider and region to confirm</Placeholder>.</li>
        <li>Email delivery: <Placeholder>SendGrid (Twilio), to confirm</Placeholder>.</li>
        <li>Payments: <Placeholder>Stripe, to confirm</Placeholder>.</li>
        <li>Error tracking: <Placeholder>Sentry, if enabled</Placeholder>.</li>
      </ul>
      <p>
        Some of these providers store or process information outside New Zealand. Under the Privacy Act (information
        privacy principle 12), we only do this where the information will be protected in a way comparable to New
        Zealand law. <Placeholder>Confirm the basis for each overseas provider</Placeholder>
      </p>
      <p>
        Inside a farm, other members of that farm can see the records they have access to under their role. We may also
        disclose information where the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep a farm's records while it uses Pulse. If a subscription lapses, the farm becomes read-only and its data
        is kept, not deleted. A farm owner can download all of the farm's data at any time from Pulse.
        <Placeholder>Retention period after an account is closed, and how deletion is requested</Placeholder>
      </p>

      <h2>Security</h2>
      <p>
        Passwords are stored hashed. Each farm's records are separated by the database itself, so one farm's members
        cannot see another farm's data. Connections are encrypted. If a privacy breach is likely to cause anyone
        serious harm, we will notify the Privacy Commissioner and the people affected as soon as practicable, as the
        Privacy Act requires.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see the personal information we hold about you, and ask us to correct it (information privacy
        principles 6 and 7). Contact our Privacy Officer: <Placeholder>name or role</Placeholder>, <Placeholder>email address</Placeholder>,{" "}
        <Placeholder>postal address</Placeholder>. If you're not happy with our response, you can complain to the Office of the
        Privacy Commissioner (privacy.org.nz).
      </p>

      <h2>Changes</h2>
      <p>We will tell farm owners by email before making significant changes to this policy.</p>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are an agreement between <Placeholder>business legal name</Placeholder> (NZBN <Placeholder>NZBN</Placeholder>) ("we", "us")
        and the farm business that signs up for Pulse ("you"). By creating a farm on Pulse, you agree to them for that
        business.
      </p>

      <h2>The service</h2>
      <p>
        Pulse is online farm management software. We aim to keep it available and working well, but it may sometimes be
        unavailable for maintenance or because of problems outside our control. <Placeholder>Any service level or support hours</Placeholder>
      </p>

      <h2>Your account and people</h2>
      <ul>
        <li>The person who signs up is the farm's owner on Pulse and is responsible for who they invite and what roles they give.</li>
        <li>Keep sign-in details private. Tell us straight away if you think an account has been misused.</li>
        <li>You are responsible for the accuracy of the records your farm keeps in Pulse.</li>
      </ul>

      <h2>Your data</h2>
      <ul>
        <li>Your farm's data belongs to you. We use it only to provide Pulse to you, as set out in our <a className="underline" href="/privacy">privacy policy</a>.</li>
        <li>A farm owner can download all of the farm's data at any time.</li>
        <li>
          Pulse helps with records and compliance (for example NAIT, NZFAP and nitrogen limits) but does not replace your own
          obligations. Check what you submit to regulators, processors and auditors.
        </li>
      </ul>

      <h2>Trial, fees and payment</h2>
      <ul>
        <li>A new farm gets a free 30-day trial. No card is needed to start.</li>
        <li>
          To keep using Pulse after the trial, you subscribe. The fees are a one-off onboarding fee set by the farm area you
          give us (under 300 ha: $500; 300 to 500 ha: $800; over 500 ha: $1,200), and $1.80 per cow per year, charged monthly
          ($0.15 per cow each month) on the number of active cows in your Pulse animal register. All amounts are in New
          Zealand dollars and are plus GST.
        </li>
        <li>Invoices are tax invoices showing GST. <Placeholder>GST number</Placeholder></li>
        <li>
          If payment lapses, your farm becomes read-only: you can still see and download everything, but can't add or change
          records until the subscription is paid. We don't delete a farm's data because a payment lapsed.
        </li>
        <li><Placeholder>Notice period for price changes; refunds; cancellation</Placeholder></li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Don't use Pulse to break the law, to try to reach another farm's data, to disrupt the service, or to upload harmful
        software.
      </p>

      <h2>Liability</h2>
      <p>
        <Placeholder>
          Limitation of liability, and whether the Consumer Guarantees Act 1993 is excluded for business customers
          (section 43). This needs legal advice.
        </Placeholder>
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You can stop using Pulse at any time. <Placeholder>How a farm closes its account, how long data is kept afterwards, and when we may suspend an account</Placeholder>
      </p>

      <h2>General</h2>
      <p>These terms are governed by New Zealand law. <Placeholder>Contact details for notices</Placeholder></p>
    </LegalPage>
  );
}
