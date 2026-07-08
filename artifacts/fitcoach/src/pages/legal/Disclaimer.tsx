import LegalLayout, { LegalSection } from "./LegalLayout";
import { useSeo } from "@/hooks/useSeo";

export default function Disclaimer() {
  useSeo({
    title: "Medical Disclaimer — ALLUR",
    description:
      "ALLUR provides general fitness and nutrition information and AI-generated estimates. It is not medical advice. Read the full medical disclaimer.",
    path: "/disclaimer",
  });

  return (
    <LegalLayout title="Medical Disclaimer" updated="July 8, 2026">
      <p>
        The information and features provided by ALLUR (&ldquo;ALLUR,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) &mdash; including training plans,
        nutrition targets, AI coaching, body-composition estimates, and meal
        analysis &mdash; are for general informational and educational purposes
        only. They are not medical advice, diagnosis, or treatment.
      </p>

      <LegalSection heading="Not a substitute for professional care">
        <p>
          ALLUR does not provide medical services and is not a substitute for the
          advice of a physician, registered dietitian, physical therapist, or
          other qualified health professional. Always seek the advice of your
          physician or a qualified provider with any questions about a medical
          condition, medication, injury, or before beginning any exercise or
          nutrition program. Never disregard professional medical advice or delay
          seeking it because of something you read or received in ALLUR.
        </p>
      </LegalSection>

      <LegalSection heading="Consult a professional before you start">
        <p>
          Exercise carries inherent risks. Consult your physician before starting
          any new training or nutrition program, especially if you are pregnant or
          nursing, are under 18, are elderly, or have any pre-existing medical
          condition, injury, eating disorder, cardiovascular concern, or take
          medication. If you experience pain, dizziness, shortness of breath, or
          any concerning symptom during exercise, stop immediately and seek
          medical attention.
        </p>
      </LegalSection>

      <LegalSection heading="AI estimates are approximate">
        <p>
          Features such as body-fat estimation, physique analysis, and photo-based
          calorie and macro estimates are AI-generated approximations. They can be
          inaccurate and should not be relied upon for medical, clinical, or
          diagnostic purposes. Individual results vary and are not guaranteed.
        </p>
      </LegalSection>

      <LegalSection heading="Emergencies">
        <p>
          ALLUR is not designed for medical emergencies. If you think you may have
          a medical emergency, call your doctor or your local emergency number
          immediately.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
