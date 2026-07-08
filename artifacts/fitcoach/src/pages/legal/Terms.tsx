import LegalLayout, { LegalSection } from "./LegalLayout";
import { useSeo } from "@/hooks/useSeo";

const CONTACT_EMAIL = "raiden@getallur.com";
const CONTACT_ADDRESS = "873 Communipaw Ave, Jersey City, NJ";

export default function Terms() {
  useSeo({
    title: "Terms of Service — ALLUR",
    description:
      "The terms that govern your use of the ALLUR app and website.",
    path: "/terms",
  });
  return (
    <LegalLayout title="Terms of Service" updated="June 24, 2026">
      <p>
        These Terms of Service (“Terms”) govern your use of the ALLUR app and website. By
        creating an account or using ALLUR, you agree to these Terms. If you do not agree, please do
        not use the service.
      </p>

      <LegalSection heading="Your account">
        <p>
          You must provide accurate information when registering and keep your password secure. You
          are responsible for activity that happens under your account. You must be at least 16 years
          old to use ALLUR.
        </p>
      </LegalSection>

      <LegalSection heading="Subscriptions and billing">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            ALLUR offers a Free tier and paid plans (Base and Premium). Paid plans are billed through
            Stripe on a recurring basis until cancelled.
          </li>
          <li>
            The Base plan may include a free trial. If you do not cancel before the trial ends, your
            subscription will begin and you will be charged the stated price.
          </li>
          <li>
            You can cancel anytime from your Account settings; access continues until the end of the
            current billing period. Except where required by law, payments are non-refundable.
          </li>
          <li>Prices and plan features may change, with notice for active subscribers.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Misuse, disrupt, or attempt to gain unauthorized access to the service.</li>
          <li>Upload content that is unlawful, infringing, or that you do not have the right to share.</li>
          <li>Resell or copy the service or its content without permission.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="AI-generated content">
        <p>
          ALLUR uses AI to generate training plans, coaching responses, physique estimates, and meal
          analyses. These outputs are automated estimates and may be inaccurate or incomplete. Use
          your own judgment and do not rely on them as a substitute for professional advice.
        </p>
      </LegalSection>

      <LegalSection heading="Health disclaimer">
        <p>
          ALLUR provides general fitness and nutrition information only and is not a medical service.
          Exercise carries inherent risks. Consult a qualified healthcare professional before
          starting any program, and stop and seek help if you experience pain or distress. You use
          ALLUR at your own risk.
        </p>
      </LegalSection>

      <LegalSection heading="Intellectual property">
        <p>
          ALLUR and its content, branding, and software are owned by us and protected by law. You
          retain ownership of the content you upload (such as photos) and grant us a limited license
          to process it solely to provide the service to you.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          You may stop using ALLUR and delete your account at any time. We may suspend or terminate
          accounts that violate these Terms or to protect the service and its users.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimers and limitation of liability">
        <p>
          The service is provided “as is” without warranties of any kind. To the maximum extent
          permitted by law, ALLUR is not liable for any indirect, incidental, or consequential
          damages, or for any injury arising from your use of the service.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these Terms">
        <p>
          We may update these Terms from time to time. Continued use after changes take effect means
          you accept the updated Terms. The “Last updated” date above reflects the latest version.
        </p>
      </LegalSection>

      <LegalSection heading="Contact us">
        <p>
          Questions about these Terms? Email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--lp-cyan)" }}>
            {CONTACT_EMAIL}
          </a>
          , or write to us at {CONTACT_ADDRESS}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
