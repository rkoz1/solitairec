import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How SolitaireC collects, uses, and protects your personal data.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <section className="px-5 max-w-2xl mx-auto">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Privacy Policy
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
        <p className="mt-4 text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
          Last updated: April 2026
        </p>
      </div>

      <div className="space-y-12 pb-24">
        {/* Introduction */}
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            SolitaireC (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
            is committed to protecting your privacy. This policy explains what
            personal data we collect, why we collect it, and your rights
            regarding that data.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            By using our website at solitairec.com you agree to the practices
            described in this policy.
          </p>
        </div>

        {/* What We Collect */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            What We Collect
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface font-medium">Account &amp; order data:</strong>{" "}
            When you create an account, place an order, or contact us, we
            collect your name, email address, phone number, shipping address,
            and payment details. Payment information is processed securely by
            our payment providers (Stripe and PayPal) and is never stored on our
            servers.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface font-medium">Browsing data:</strong>{" "}
            With your consent, we collect anonymised usage data including pages
            visited, products viewed, search queries, and interactions. This
            helps us understand how customers use our site and improve the
            shopping experience.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface font-medium">Device &amp; technical data:</strong>{" "}
            IP address, browser type, device type, and operating system. This is
            collected automatically to ensure site functionality and security.
          </p>
        </div>

        {/* How We Use Your Data */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            How We Use Your Data
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-on-surface-variant list-disc pl-5">
            <li>Process and fulfil your orders</li>
            <li>Send order confirmations and shipping updates</li>
            <li>Provide customer support</li>
            <li>Send marketing communications (only with your consent)</li>
            <li>Analyse site usage to improve our products and experience</li>
            <li>Prevent fraud and ensure security</li>
          </ul>
        </div>

        {/* Cookies & Tracking */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Cookies &amp; Tracking
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface font-medium">Essential cookies:</strong>{" "}
            Required for site functionality — authentication, cart, and region
            preferences. These are always active.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface font-medium">Analytics cookies (consent required):</strong>{" "}
            We use Microsoft Clarity for session recordings and heatmaps, and
            Meta Pixel for advertising attribution. These are only loaded after
            you accept cookies via our consent banner.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            <strong className="text-on-surface font-medium">Privacy-friendly analytics:</strong>{" "}
            We use Vercel Web Analytics which does not use cookies and does not
            collect personally identifiable information. This runs without
            requiring consent.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            You can change your cookie preferences at any time by clearing your
            browser data or using your browser&apos;s cookie settings.
          </p>
        </div>

        {/* Third Parties */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Third-Party Services
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            We share data with the following third parties only as necessary to
            operate our business:
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-on-surface-variant list-disc pl-5">
            <li>
              <strong className="text-on-surface font-medium">Wix</strong> — e-commerce
              platform, order management, and member accounts
            </li>
            <li>
              <strong className="text-on-surface font-medium">Stripe &amp; PayPal</strong> — payment
              processing
            </li>
            <li>
              <strong className="text-on-surface font-medium">Vercel</strong> — website
              hosting and privacy-friendly analytics
            </li>
            <li>
              <strong className="text-on-surface font-medium">Microsoft Clarity</strong> — session
              recordings and heatmaps (with consent)
            </li>
            <li>
              <strong className="text-on-surface font-medium">Meta</strong> — advertising
              pixel and conversion tracking (with consent)
            </li>
            <li>
              <strong className="text-on-surface font-medium">Shipping carriers</strong> — SF
              Express, DHL, FedEx for order delivery
            </li>
          </ul>
        </div>

        {/* Data Retention */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Data Retention
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            We retain your personal data for as long as necessary to provide our
            services and comply with legal obligations. Order data is retained
            for a minimum of 7 years for tax and accounting purposes. You may
            request deletion of your account data at any time.
          </p>
        </div>

        {/* Your Rights */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Your Rights
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Depending on your location, you may have the right to:
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-on-surface-variant list-disc pl-5">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for marketing communications</li>
            <li>Object to or restrict processing of your data</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:Enquiry@SolitaireC.com"
              className="underline underline-offset-2 text-on-surface hover:text-secondary transition-colors"
            >
              Enquiry@SolitaireC.com
            </a>
            .
          </p>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Contact Us
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            If you have questions about this policy or how we handle your data,
            please contact us at{" "}
            <a
              href="mailto:Enquiry@SolitaireC.com"
              className="underline underline-offset-2 text-on-surface hover:text-secondary transition-colors"
            >
              Enquiry@SolitaireC.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
