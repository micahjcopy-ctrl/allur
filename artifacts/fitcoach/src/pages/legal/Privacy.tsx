import LegalLayout, { LegalSection } from "./LegalLayout";
import { useSeo } from "@/hooks/useSeo";

const CONTACT_EMAIL = "raiden@getallur.com";
const CONTACT_ADDRESS = "873 Communipaw Ave, Jersey City, NJ";

export default function Privacy() {
  useSeo({
    title: "Privacy Policy — ALLUR",
    description:
      "How ALLUR collects, uses, and protects your information when you use the ALLUR app and website.",
    path: "/privacy",
  });
  return (
    <LegalLayout title="Privacy Policy" updated="September 9, 2026">
      <p>
        This Privacy Policy explains how ALLUR (“ALLUR,” “we,” “us”) collects, uses, and
        protects your information when you use the ALLUR app and website. By creating an account or
        using ALLUR, you agree to the practices described here.
      </p>

      <LegalSection heading="Information we collect">
        <p>We collect the information you provide and the data needed to operate the service:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account details:</strong> email address, username, and a securely hashed
            password. We never store your password in plain text.
          </li>
          <li>
            <strong>Fitness profile:</strong> the goals, experience level, activity level, target
            physique, injuries, dietary restrictions, equipment, and preferences you enter during
            onboarding.
          </li>
          <li>
            <strong>Progress data:</strong> body-weight logs, personal records, logged workouts and
            meals, and the progress photos you choose to upload.
          </li>
          <li>
            <strong>Location data:</strong> if you allow it, your precise location while you record a
            run or walk, used to track your route, distance and pace and to suggest routes near you.
            Location is only used while you are actively using the cardio feature.
          </li>
          <li>
            <strong>Voice notes:</strong> if you use the microphone to talk to your coach or log a
            meal, the recording is sent to our AI provider to be transcribed and is not kept after
            the transcription is returned.
          </li>
          <li>
            <strong>Payment data:</strong> subscription status and billing are handled by Stripe on
            the web and by Apple (via the App Store) in the iOS app. We do not receive or store your
            full card number. For App Store subscriptions we use RevenueCat to validate purchases and
            keep your subscription status in sync; RevenueCat receives your account ID and a device
            identifier for that purpose.
          </li>
          <li>
            <strong>Usage and diagnostic data:</strong> basic technical information (such as device
            type, app version, IP address and crash reports) used to keep the service secure and
            reliable. Crash reports are not linked to your identity.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How we use your information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To create and maintain your account and personalized training plan.</li>
          <li>To generate AI coaching responses, physique estimates, and meal analyses you request.</li>
          <li>To process subscriptions and provide customer support.</li>
          <li>To send essential account emails (for example, password resets).</li>
          <li>To secure the service, prevent abuse, and comply with the law.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="AI processing of photos and inputs">
        <p>
          When you ask for a physique analysis, meal analysis, or AI coaching, the relevant photo or
          text is sent to our AI provider (OpenAI) solely to generate your result and return it to
          you. Photos are used for that analysis and are not sold or used for advertising.
        </p>
      </LegalSection>

      <LegalSection heading="How we share information">
        <p>
          We do not sell your personal information. We share data only with the service providers that
          make ALLUR work — such as our hosting platform, Stripe and Apple (payments), RevenueCat
          (App Store subscription validation), OpenAI (AI features), Sentry (crash reporting), and
          our email provider — and only as needed to deliver the service or when required by
          law.
        </p>
      </LegalSection>

      <LegalSection heading="Data retention">
        <p>
          We keep your account data for as long as your account is active. You can delete your
          account at any time, after which we remove your durable fitness data, subject to any
          records we must retain for legal or billing purposes.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices and rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>Access, update, or delete your profile and progress data from within the app.</li>
          <li>Cancel your subscription at any time from your Account settings.</li>
          <li>
            Request a copy or deletion of your personal data by contacting us at the address below.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          We use industry-standard measures — including encrypted connections and hashed passwords
          — to protect your data. No method of transmission or storage is 100% secure, but we work
          to safeguard your information.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          ALLUR is not intended for anyone under 16. We do not knowingly collect information from
          children. If you believe a child has provided us data, contact us and we will remove it.
        </p>
      </LegalSection>

      <LegalSection heading="Health disclaimer">
        <p>
          ALLUR provides general fitness and nutrition guidance for informational purposes only and
          is not medical advice. Consult a qualified professional before starting any exercise or
          nutrition program.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be reflected by updating
          the “Last updated” date above.
        </p>
      </LegalSection>

      <LegalSection heading="Contact us">
        <p>
          Questions about this policy or your data? Email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--lp-cyan)" }}>
            {CONTACT_EMAIL}
          </a>
          , or write to us at {CONTACT_ADDRESS}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
