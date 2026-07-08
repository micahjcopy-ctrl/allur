import LegalLayout, { LegalSection } from "./LegalLayout";
import { useSeo } from "@/hooks/useSeo";

export default function About() {
  useSeo({
    title: "About ALLUR — The Adaptive AI Fitness Coach",
    description:
      "ALLUR is an AI fitness coach that builds a personalized, research-backed training and nutrition plan and adapts it to your real life. Meet the team and the science behind it.",
    path: "/about",
  });

  return (
    <LegalLayout title="About ALLUR" updated="July 8, 2026">
      <p>
        ALLUR is an adaptive body-transformation system. Instead of handing you a
        generic template, it builds a personalized training and nutrition plan
        around your body, goal, experience, injuries, and schedule — then adapts
        that plan when life changes. The aim is simple: remove the friction that
        makes people quit, so progress is easier to sustain.
      </p>

      <LegalSection heading="Built on evidence, not hype">
        <p>
          ALLUR&rsquo;s programs are grounded in mainstream exercise-science
          guidance rather than fads. Our training model reflects widely cited
          resistance-training and physical-activity recommendations (including
          the American College of Sports Medicine&rsquo;s guidance), evidence-based
          weekly-volume landmarks popularized by coaches such as Jeff Nippard, and
          the International Society of Sports Nutrition&rsquo;s protein guidance of
          roughly 1.4&ndash;2.0 g/kg/day for people who train. The same framework is
          what the in-app AI coach reasons from, so the advice you get stays
          consistent with the plan you&rsquo;re following.
        </p>
      </LegalSection>

      <LegalSection heading="What ALLUR does">
        <ul className="list-disc space-y-1 pl-5">
          <li>Generates a personalized training plan from a guided onboarding.</li>
          <li>Tracks nutrition with photo-based meal logging and macro targets.</li>
          <li>Estimates body composition and physique changes from progress photos.</li>
          <li>Adapts your plan through an AI coach when your schedule, equipment, or recovery changes.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="The team">
        <p>
          ALLUR was founded by <strong>Micah Jacobi</strong> and{" "}
          <strong>Raiden Nomura</strong>, who lead product, engineering, and the
          coaching methodology behind the app. Our editorial content is written to
          reflect current, citable exercise-science research and is reviewed for
          accuracy against published guidelines.
        </p>
      </LegalSection>

      <LegalSection heading="A note on health">
        <p>
          ALLUR provides general fitness and nutrition information and AI-generated
          estimates. It is not medical advice and is not a substitute for a
          qualified professional. Please read our{" "}
          <a href="/disclaimer" style={{ textDecoration: "underline" }}>
            Medical Disclaimer
          </a>
          , and consult a physician before starting any new training or nutrition
          program.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions or feedback? Email{" "}
          <a href="mailto:support@getallur.com" style={{ textDecoration: "underline" }}>
            support@getallur.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
