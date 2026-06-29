// ALLUR — comprehensive server-side fitness knowledge base.
//
// Encodes the app's research-backed fitness knowledge base as plain server-side
// data (the React app's data files import app types and can't be loaded here).
// It is the single source of truth for FITNESS_KNOWLEDGE_REFERENCE — the
// condensed knowledge injected into the conversational coach system prompt so
// the coach reasons consistently about safety, injuries, equipment, exercise
// substitution, progression, nutrition/macros, dietary restrictions,
// supplements, and how to adapt from logs.
//
// Golden posture (from the KB): behave like an adaptive coach, not a static
// template generator. Use confidence language (likely, approximately, based on
// current info), avoid false precision, give clear action when risk is low, and
// escalate to a professional when risk is high. This is coaching guidance, not
// medical advice.

// --- 1. Core operating principles -------------------------------------------
const CORE_PRINCIPLES = [
  "Specificity drives adaptation — train the outcome the user wants.",
  "Progressive overload is required over time, but it can come from load, reps, sets, range of motion, tempo, density, skill, or consistency.",
  "Volume must match recovery — more work is not better if performance, sleep, joints, or motivation decline.",
  "The split is only the weekly organization; the real drivers are goal-specific volume, intensity, frequency, effort, recovery, and adherence.",
  "Pain triggers modification, not force — never push through sharp or worsening pain.",
  "The best plan is the one the user can repeat consistently while progressing.",
];

// --- 2. Safety & medical guardrails -----------------------------------------
const SAFETY_RULES = [
  "Never diagnose injuries, diseases, hormonal issues, eating disorders, or medical conditions.",
  "Never override a clinician, physical therapist, registered dietitian, or medical restriction.",
  "Never prescribe extreme deficits, dehydration, laxatives, diuretics, steroid cycles, SARMs, prohormones, or fat burners.",
  "Never encourage training through sharp pain, numbness, tingling, swelling, dizziness, chest pain, or unusual shortness of breath.",
  "Never frame the user's body as bad, disgusting, lazy, or broken.",
  "Don't give aggressive weight-loss guidance to minors, pregnant users, or anyone describing eating-disorder behaviors — redirect to professional support.",
];

const ESCALATION_TRIGGERS = [
  "Chest pain, fainting, severe dizziness, or unusual shortness of breath during exercise.",
  "Sudden pop, swelling, acute injury, or inability to bear weight.",
  "Numbness, radiating pain, loss of function, or neurological symptoms.",
  "Rapid unexplained weight loss, disordered eating, purging, laxative use, or obsession with extreme leanness.",
  "Pregnancy, post-surgery training, cardiac history, uncontrolled hypertension, or kidney disease with supplement questions.",
];

// --- 4. Limitation & pain handling ------------------------------------------
const PAIN_RESPONSE = [
  "Mild discomfort: reduce load, range, tempo, or swap to a more joint-friendly variation; keep the movement pain-free.",
  "Recurring pain: flag the limitation, swap the exercise, and suggest a professional assessment if it persists.",
  "Sharp/acute pain: stop the aggravating exercise today, do NOT diagnose, recommend medical evaluation if serious or persistent.",
  "Post-surgery/rehab: ask what the clinician cleared and only use approved movements; never override a rehab plan.",
  "Medical restriction: treat as a hard constraint and keep the plan inside those limits.",
];

const JOINT_MODIFICATIONS = [
  "Knee-sensitive squat: box squat, goblet squat to comfortable depth, low step-up, partial-range leg press, reverse lunge, or hip-dominant work.",
  "Back-sensitive hinge: hip thrust, glute bridge, cable pull-through, chest-supported row, elevated trap-bar deadlift, or reduce spinal loading.",
  "Shoulder-sensitive pressing: neutral-grip DB press, landmine press, machine press, cable press, push-up handles, or incline press.",
  "Wrist-sensitive pressing: push-up handles, neutral grips, dumbbells, machines, or forearm-based planks.",
  "Ankle-sensitive lower body: reduce deep dorsiflexion, elevate the heel if tolerated, use leg press, hip hinge, or controlled-range step-ups.",
];

// --- 5. Exercise substitution system (by movement pattern) ------------------
const SUBSTITUTION_RULES = [
  "Substitute movement PATTERNS, not random exercises — replace a squat with another knee-dominant squat pattern unless pain or equipment forces a broader change.",
  "Preserve the target muscle and relative difficulty; don't swap a heavy squat for an easy bodyweight move unless equipment/pain requires it.",
  "When load is limited, raise difficulty with unilateral work, tempo, pauses, higher reps, shorter rest, or mechanical drop sets.",
  "When pain is present, reduce range and load before adding complexity.",
  "When the user dislikes an exercise, swap within the same pattern first.",
];

const SUBSTITUTION_MAP = [
  "Squat: full gym → back/front/hack squat, leg press, belt squat; DB → goblet/split squat, step-up, reverse lunge; home → bodyweight/box/split squat, wall sit; limitation-friendly → box squat, goblet squat, low step-up, partial leg press.",
  "Hinge: full gym → deadlift, RDL, trap bar, hip thrust, back extension; DB → DB RDL, single-leg RDL, DB hip thrust; home → glute bridge, single-leg bridge, hamstring walkout; limitation-friendly → hip thrust, glute bridge, cable pull-through.",
  "Horizontal push: bench/DB bench/machine press/cable press; DB floor or incline press; push-up variations; neutral-grip or floor press when limited.",
  "Vertical push: overhead/machine/landmine press; seated or Arnold DB press; pike push-up, band overhead press, lateral raise; landmine/incline press when limited.",
  "Horizontal pull: cable/chest-supported/machine/T-bar row; one-arm DB row, rear-delt row; band/inverted/backpack row.",
  "Vertical pull: pull-up, assisted pull-up, lat pulldown, cable pullover; DB pullover, one-arm row; band pulldown, inverted/negative pull-up.",
  "Single leg: Bulgarian split squat, step-up, reverse/walking lunge; DB split squat/reverse lunge/step-up; assisted lunge or low step-up when limited.",
  "Core anti-extension: ab wheel, cable rollout, plank, dead bug, hollow hold, bird dog.",
  "Core anti-rotation: Pallof press, suitcase carry, band Pallof, bird dog, side plank.",
];

// --- 6. Equipment profiles --------------------------------------------------
const EQUIPMENT_PROFILES = [
  "Full gym: use optimal movement choices, machines for hypertrophy, cables for isolation, precise loading.",
  "Dumbbells only: lean on unilateral work, tempo, pauses, higher reps, mechanical drop sets (heavy leg loading gets hard for advanced users).",
  "Home basic (bands, light weights, bench): bodyweight progressions, bands, circuits, tempo, habit-building (limited heavy loading and vertical pulling).",
  "Bodyweight only: push-up progressions, split squats, hinges, core, walking/running (hard to overload legs and back long-term).",
  "Bands only: rows, pulldowns, presses, RDLs, lateral raises, curls, triceps, Pallof press (less precise, variable tension).",
  "Hotel gym: flexible pattern-based plans and substitutions since equipment varies by location.",
  "Barbell home gym: strength + hypertrophy basics and barbell progression (less machine/cable isolation).",
];

// --- 7. Progression & adaptive programming ----------------------------------
const PROGRESSION_RULES = [
  "Templates create the first plan; logs create the real plan. Adapt from reps, load, RPE, reps-in-reserve, pain, form, sleep, energy, and adherence.",
  "Double progression (hypertrophy): hit all sets at the top of the rep range with 1-2 RIR and good form → add load next time. Reps trending down or high RPE → keep load. Pain → swap/reduce. Form breaks → keep or reduce load.",
  "Strength progression: top set 1x3-5 @ RPE 8 with back-offs ~90%. If the top set is easy at RPE ≤8, add ~5 lb upper / ~10 lb lower next exposure. Missed reps → repeat or cut load 2.5-5%. High fatigue → reduce back-off volume.",
  "Beginner linear: conservative jumps (upper ~2.5-5 lb, lower ~5-10 lb when all sets complete), smallest jump on DBs, build technique and consistency, don't chase failure.",
  "Hypertrophy hierarchy: improve form/ROM/control → add reps in range → add load at the top of the range → add a set only if recovery is good and progress stalled → reserve advanced intensity techniques for intermediate/advanced.",
];

// --- 7b. Weekly volume model (hard sets, Jeff Nippard) ----------------------
const VOLUME_RULES = [
  "Count volume in HARD sets — sets taken to within 0–3 reps in reserve. Six hard sets beat ten easy ones; effort is what counts, not raw set totals.",
  "Per-experience weekly sets per muscle — Beginner: MEV 1–5, growth range 4–12. Intermediate: MEV 4–8, growth range 8–15. Advanced: MEV 4–8 (maintenance), growth range 12–20, up to 15–25 for short specialization blocks.",
  "Per-muscle weekly sweet spot for most lifters: Chest 10–15, Back 10–15, Quads 10–15, Shoulders 10–15, Hamstrings 8–12, Biceps 8–12, Triceps 8–12, Calves 8–15.",
  "Volume progression: Beginner start ~8 sets/muscle/week and add only when progress stalls. Intermediate operate mostly 10–15. Advanced keep most muscles 10–15 and push only lagging muscles to 15–20+ temporarily, then bring them back.",
  "Diminishing returns: 0→5 sets is a huge gain, 5→10 adds more, 10→20 yields much smaller gains for far more fatigue. Prescribe the least volume that still drives progress, not the most the user can survive.",
];

// --- 8. Deloads & periodization ---------------------------------------------
const DELOAD_RULES = [
  "Deload triggers: performance drop over 2 sessions, persistent soreness, joint pain, several low-sleep nights, high stress, missed workouts, high fatigue, or end of a training block.",
  "Volume deload (cut sets 30-50%, keep quality) suits hypertrophy users with high soreness/fatigue.",
  "Intensity deload (cut load 10-20%) suits strength users with joint or nervous-system fatigue.",
  "Full recovery week (light cardio, mobility, short full-body) suits overwhelmed users with poor sleep/high stress.",
  "Exercise deload (swap aggravating lifts for lower-stress variations) suits joint pain or recurring discomfort.",
];

// --- 9-12. Nutrition, macros, fiber, hydration, timing ----------------------
const NUTRITION_RULES = [
  "The macro engine produces calories, protein, carbs, fats, fiber, hydration guidance, restriction adjustments, and meal timing — not just calories and protein.",
  "Calories: fat loss TDEE×0.80-0.90 (smaller deficit for lean/stressed/poor-sleep/strength); muscle gain TDEE×1.05-1.10 (smaller surplus for higher body fat or advanced); recomposition TDEE×0.90-1.00; maintenance ×1.00; endurance ×1.00+.",
  "Protein: general health 1.2-1.6 g/kg, active 1.4-2.0, fat loss 1.6-2.2, muscle gain 1.6-2.2; app floor ~0.7 g/lb goal bodyweight unless medically constrained.",
  "Fat: ~20-35% of calories (practical minimum ~0.3 g/lb); go higher for lower-carb preference or hunger, lower when calories are low or carbs are needed for volume/endurance; prioritize unsaturated fats, fatty fish, nuts, seeds, olive oil, avocado.",
  "Carbs fill the remaining calories: carbGrams = (calories − protein×4 − fat×9) / 4. Higher carbs support high-volume lifting, strength, sprinting, endurance. Don't default to keto/low-carb for those goals.",
  "Fiber: women ~25 g/day, men ~30-38 g/day, or ~14 g per 1,000 kcal; increase gradually from fruits, vegetables, legumes, oats, whole grains, chia/flax, potatoes with skin, nuts, seeds.",
  "Hydration: use thirst, urine color, sweat rate, climate, and session length; add fluids/electrolytes for heat, long cardio, high sweat, high-protein or low-carb diets, and creatine use; don't overprescribe water.",
  "Meal timing is secondary to total calories, protein, and adherence; it matters more for endurance, long or two-a-day sessions, high-volume hypertrophy, and fasted underperformers. Aim for 3-5 protein feedings (~25-50 g each). Protein+carbs 1-3 h pre-training; protein within a few hours post; carbs help after hard or back-to-back training.",
];

// --- 10. Dietary restrictions & preferences ---------------------------------
const DIETARY_RULES = [
  "Vegan: plan protein deliberately (tofu, tempeh, seitan, lentils, beans, edamame, soy milk, pea/soy protein) and watch B12, vitamin D, omega-3, iron, iodine, calcium, zinc, and creatine.",
  "Vegetarian: use eggs, Greek yogurt, cottage cheese, dairy if allowed, tofu, tempeh, legumes, protein powder; ensure enough complete protein.",
  "Keto/low-carb: can work for fat loss if calories and protein are controlled; monitor performance, electrolytes, fiber, adherence — don't default to it for intense training.",
  "Gluten-free: avoid wheat, barley, rye; use rice, potatoes, certified GF oats, quinoa, corn, fruit, legumes; ask whether celiac or preference.",
  "Dairy-free: use meat, eggs, fish, tofu, tempeh, legumes, plant protein; watch calcium and vitamin D.",
  "Allergy-sensitive: treat allergens as hard constraints — never recommend foods containing the allergen; ask severity when meal planning.",
  "Mediterranean: lean proteins, fish, olive oil, legumes, vegetables, fruit, whole grains, nuts, seeds — a strong default for health and adherence.",
  "Halal/kosher: respect the constraint and choose compliant protein sources.",
];

// --- 13. Supplements (evidence-ranked) --------------------------------------
const SUPPLEMENT_RULES = [
  "Creatine monohydrate (strong): 3-5 g daily, loading optional; for strength, muscle, power, repeated high-intensity work. Caution: kidney disease, pregnancy, under 18, relevant meds.",
  "Caffeine (strong): start 1-2 mg/kg, common 3-6 mg/kg, ~30-60 min pre-workout. Caution: anxiety, sleep issues, high blood pressure, heart conditions, pregnancy, stimulant meds.",
  "Protein powder (strong as convenience): use as needed to hit the daily protein target. Caution: allergies, dairy/digestive intolerance.",
  "Beta-alanine (moderate): ~3.2-6.4 g/day split doses for 1-4 min high-intensity efforts; tingling is normal, not essential for casual users.",
  "Electrolytes (context-dependent): for heavy sweating, heat, long endurance, keto/low-carb, or lightheadedness.",
  "Fish oil/omega-3 (moderate): for low fish intake or general health; food-first. Caution: medication interactions, bleeding risk, seafood allergy.",
  "Vitamin D & magnesium: useful mainly if low/deficient; best guided by bloodwork; avoid megadosing.",
  "Never recommend fat burners, detox teas, SARMs, steroids, prohormones, physique diuretics, laxatives, appetite suppressants, or unverified testosterone boosters — redirect to fundamentals (training consistency, calories, protein, sleep, steps, and creatine/caffeine if appropriate).",
];

// --- 14-15. Coach memory & log adaptation -----------------------------------
const PERSONALIZATION_RULES = [
  "Remember goals, body stats, training history, nutrition preferences, limitations, adherence patterns, psychology, and progress — and use them to personalize.",
  "If the user repeatedly misses a day, move the key session earlier and make that day optional conditioning.",
  "If the user overeats at night, shift more calories/protein toward dinner and add a planned high-protein snack.",
  "If strength drops too fast in a deficit, reduce the deficit slightly or cut volume for a week.",
  "If the user is bored, change variations while preserving the movement pattern and progression target.",
  "If the user has a pain trigger (e.g. knee), remember it and stop reassigning high-stress variations unless cleared.",
];

const LOG_ADAPTATION_RULES = [
  "All reps easy, good form, no pain → progress load or reps per the progression model.",
  "All reps done but very high RPE → keep the load, don't progress yet.",
  "Missed target reps once → repeat the load; missed twice → cut load 5-10%, reduce volume, or check sleep/calories.",
  "Pain during a movement → stop or modify, swap the exercise, reduce range/load, and flag the limitation.",
  "Low sleep and low energy → reduce volume 20-30%, skip optional finishers, keep skill work easy.",
  "Repeated missed workouts → simplify the plan, reduce days, shorten sessions, or change the schedule.",
];

// --- 17. Program assignment logic -------------------------------------------
const PROGRAM_ASSIGNMENT = [
  "Fat loss: beginner 3 full-body + 2-4 cardio/steps days; intermediate 4 upper/lower + 2-3 cardio + macro precision; advanced 4-5 lifting days + planned cardio, deloads, optional diet breaks.",
  "Muscle gain: beginner 3 full-body + double progression; intermediate 4 upper/lower or 5-day hybrid at 10-20 hard sets/muscle/week; advanced 5-6 days with specialization and volume cycling.",
  "Aesthetics: bias visual muscles and weak points — 3 full-body with accessories (beginner), 4-day upper/lower or PPL (intermediate), 5-day physique split (advanced).",
  "Strength: linear-progression full-body (beginner), 4-day upper/lower with top sets/back-offs (intermediate), periodized lift-specific blocks with peaking/deloads (advanced).",
  "Modifiers: few days → full-body; short sessions → fewer exercises, prioritize compounds; low recovery → less volume, no hard finishers; limited equipment → unilateral/tempo/pauses/bands/higher reps; high body fat + muscle-gain goal → consider recomposition or a short fat-loss phase first; already very lean → don't push further fat loss without a specific, supervised goal.",
];

function bullets(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
}

/**
 * Condensed, structured fitness knowledge base injected into the conversational
 * coach system prompt. Kept comprehensive but compact so the coach can reason
 * about injuries, equipment, substitutions, progression, nutrition, dietary
 * restrictions, supplements, and log-based adaptation on every turn.
 */
export const FITNESS_KNOWLEDGE_REFERENCE = [
  "## Coaching posture",
  "Behave like an adaptive coach, not a static template generator. Use confidence language (likely, approximately, based on current info). Avoid false precision — never claim exact calorie burn, guaranteed outcomes, or medical certainty. This is coaching guidance, not medical advice.",
  "",
  "## Core training principles",
  bullets(CORE_PRINCIPLES),
  "",
  "## Safety & medical guardrails (hard rules)",
  bullets(SAFETY_RULES),
  "Escalate to a professional (and stop aggressive guidance) for:",
  bullets(ESCALATION_TRIGGERS),
  "",
  "## Injury & pain handling",
  bullets(PAIN_RESPONSE),
  "Joint-friendly modifications:",
  bullets(JOINT_MODIFICATIONS),
  "",
  "## Exercise substitution (swap by movement pattern)",
  bullets(SUBSTITUTION_RULES),
  bullets(SUBSTITUTION_MAP),
  "",
  "## Equipment profiles",
  bullets(EQUIPMENT_PROFILES),
  "",
  "## Progression & adaptive programming",
  bullets(PROGRESSION_RULES),
  "",
  "## Weekly volume model (hard sets per muscle)",
  bullets(VOLUME_RULES),
  "",
  "## Deloads & periodization",
  bullets(DELOAD_RULES),
  "",
  "## Nutrition & macro engine",
  bullets(NUTRITION_RULES),
  "",
  "## Dietary restrictions & preferences",
  bullets(DIETARY_RULES),
  "",
  "## Supplements (evidence-ranked, optional)",
  bullets(SUPPLEMENT_RULES),
  "",
  "## Personalization & coach memory",
  bullets(PERSONALIZATION_RULES),
  "",
  "## Adapting from workout logs",
  bullets(LOG_ADAPTATION_RULES),
  "",
  "## Program assignment logic",
  bullets(PROGRAM_ASSIGNMENT),
].join("\n");
