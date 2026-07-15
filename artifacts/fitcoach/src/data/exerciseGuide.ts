// ALLUR — Exercise demo + coaching guide.
//
// Maps every exercise name used across `trainingKnowledge.ts` to a canonical
// guide entry: target muscles, a demo image, step-by-step setup/execution, and
// the form cues a coach would call out. Variant spellings (plurals, equipment
// synonyms) are normalized to a single canonical entry via `ALIASES`.
//
// Demo images live in `public/exercises/<slug>.png` and are referenced at
// runtime through `import.meta.env.BASE_URL` (no static import type decls here).

export type ExerciseType = "strength" | "core" | "cardio" | "power";

export interface ExerciseGuide {
  name: string;
  slug: string;
  type: ExerciseType;
  muscles: string[];
  summary: string;
  steps: string[];
  cues: string[];
}

const imageBase = () => `${import.meta.env.BASE_URL}exercises/`;

// Returns the public path to an exercise demo image for a given slug.
export const exerciseImage = (slug: string): string => `${imageBase()}${slug}.jpg`;

// Canonical guides, keyed by canonical exercise name.
const GUIDE: Record<string, ExerciseGuide> = {
  "Back Squat": {
    name: "Back Squat",
    slug: "back-squat",
    type: "strength",
    muscles: ["Quads", "Glutes", "Core"],
    summary: "The king of lower-body lifts — barbell across the upper back, sit down and drive up.",
    steps: [
      "Set the bar on your traps, grip just outside the shoulders, and unrack with feet shoulder-width.",
      "Brace your core, break at the hips and knees together, and sit down between your legs.",
      "Descend until hips drop below knee level, then drive through mid-foot to stand tall.",
    ],
    cues: [
      "Keep the bar over mid-foot the whole way — chest up, don't fold forward.",
      "Knees track over your toes, never cave inward.",
      "Take a big breath and brace before each rep.",
    ],
  },
  "Front Squat": {
    name: "Front Squat",
    slug: "front-squat",
    type: "strength",
    muscles: ["Quads", "Core", "Upper Back"],
    summary: "Bar racked on the front delts — keeps you upright and hammers the quads.",
    steps: [
      "Rack the bar across your front delts with elbows high, fingers loosely under the bar.",
      "Brace hard and squat straight down, keeping the torso vertical.",
      "Drive up through mid-foot, keeping the elbows pointed forward.",
    ],
    cues: [
      "Elbows up — if they drop, the bar rolls forward.",
      "Stay tall through the chest and upper back.",
      "Sit between your hips, not back like a low-bar squat.",
    ],
  },
  "Goblet Squat": {
    name: "Goblet Squat",
    slug: "goblet-squat",
    type: "strength",
    muscles: ["Quads", "Glutes", "Core"],
    summary: "Hold one dumbbell at your chest — the easiest squat to learn good depth and posture.",
    steps: [
      "Cup a dumbbell or kettlebell vertically against your chest.",
      "Stand shoulder-width, brace, and squat down between your knees.",
      "Let your elbows brush the inside of your knees at the bottom, then stand up.",
    ],
    cues: [
      "Keep the weight tight to your chest and elbows down.",
      "Push your knees out as you descend.",
      "Stay tall — the load in front keeps you honest.",
    ],
  },
  "Pause Squat": {
    name: "Pause Squat",
    slug: "pause-squat",
    type: "strength",
    muscles: ["Quads", "Glutes", "Core"],
    summary: "A back squat with a dead stop at the bottom — builds control and bottom-end strength.",
    steps: [
      "Set up and descend as a normal back squat.",
      "Hold the bottom position for a full 2–3 seconds without bouncing.",
      "Drive up explosively while staying braced.",
    ],
    cues: [
      "Stay tight in the hole — don't relax under load.",
      "No bouncing out of the pause.",
      "Keep the same bar path on the way up.",
    ],
  },
  "Bulgarian Split Squat": {
    name: "Bulgarian Split Squat",
    slug: "bulgarian-split-squat",
    type: "strength",
    muscles: ["Quads", "Glutes", "Adductors"],
    summary: "Rear foot elevated single-leg squat — brutal for quads and glutes, great for balance.",
    steps: [
      "Place the top of your rear foot on a bench, front foot a stride ahead.",
      "Lower straight down until the front thigh is roughly parallel.",
      "Drive through the front heel to return to the top.",
    ],
    cues: [
      "Keep most of your weight on the front leg.",
      "Lean slightly forward to bias the glute.",
      "Front knee tracks over the foot, not collapsing in.",
    ],
  },
  "Bench Press": {
    name: "Bench Press",
    slug: "bench-press",
    type: "strength",
    muscles: ["Chest", "Front Delts", "Triceps"],
    summary: "The classic horizontal press — lower the bar to your chest and press it back up.",
    steps: [
      "Lie back, eyes under the bar, grip slightly wider than shoulders.",
      "Set your shoulder blades down and back, feet planted, slight arch.",
      "Lower the bar to your lower chest, then press up and slightly back.",
    ],
    cues: [
      "Keep your shoulder blades pinched and tucked the whole set.",
      "Touch the same spot each rep — don't bounce off the chest.",
      "Drive your feet into the floor for a stable base.",
    ],
  },
  "Incline Dumbbell Press": {
    name: "Incline Dumbbell Press",
    slug: "incline-press",
    type: "strength",
    muscles: ["Upper Chest", "Front Delts", "Triceps"],
    summary: "Pressing on a 30° incline — emphasizes the upper chest. Works with bar or dumbbells.",
    steps: [
      "Set the bench to ~30°, dumbbells on your thighs, then kick them to the start.",
      "Press the weights up over your upper chest, palms forward.",
      "Lower under control until you feel a stretch across the upper chest.",
    ],
    cues: [
      "Don't set the incline too steep or it becomes a shoulder press.",
      "Keep wrists stacked over elbows.",
      "Control the negative — that's where the growth is.",
    ],
  },
  "Incline Dumbbell Flyes": {
    name: "Incline Dumbbell Flyes",
    slug: "incline-fly",
    type: "strength",
    muscles: ["Upper Chest"],
    summary: "An isolation movement that stretches and squeezes the upper chest through a wide arc.",
    steps: [
      "On a ~30° bench, press two dumbbells up with a slight elbow bend.",
      "Open your arms in a wide arc until you feel a deep chest stretch.",
      "Squeeze the chest to bring the weights back together over your chest.",
    ],
    cues: [
      "Keep a fixed, soft elbow bend — it's an arc, not a press.",
      "Lead with the elbows, not the hands.",
      "Go light and feel the chest, don't chase weight.",
    ],
  },
  "Cable Fly": {
    name: "Cable Fly",
    slug: "cable-fly",
    type: "strength",
    muscles: ["Chest"],
    summary: "Constant-tension chest isolation — hug the cables together in front of you.",
    steps: [
      "Set the pulleys high (or mid), grab a handle in each hand, step forward into a stagger.",
      "With soft elbows, sweep your hands down and together in front of your chest.",
      "Control the cables back out until you feel a stretch, then repeat.",
    ],
    cues: [
      "Keep the elbow angle fixed throughout.",
      "Squeeze and hold for a beat at the front.",
      "Stay leaned slightly forward for constant tension.",
    ],
  },
  "Close-Grip Bench": {
    name: "Close-Grip Bench",
    slug: "close-grip-bench",
    type: "strength",
    muscles: ["Triceps", "Chest", "Front Delts"],
    summary: "A narrow-grip bench press that shifts the work onto the triceps.",
    steps: [
      "Grip the bar about shoulder-width, no narrower.",
      "Lower the bar to your lower chest with elbows tucked close to your sides.",
      "Press up by extending the elbows hard.",
    ],
    cues: [
      "Keep elbows tucked, not flared.",
      "Don't grip so narrow that your wrists hurt.",
      "Think about pushing the bar away with your triceps.",
    ],
  },
  "Overhead Press": {
    name: "Overhead Press",
    slug: "overhead-press",
    type: "strength",
    muscles: ["Shoulders", "Triceps", "Upper Chest"],
    summary: "Standing barbell press from the shoulders to lockout overhead.",
    steps: [
      "Start with the bar on your front delts, grip just outside shoulders.",
      "Brace your core and glutes, press the bar straight up past your face.",
      "Lock out with the bar over the back of your head, then lower under control.",
    ],
    cues: [
      "Squeeze your glutes — don't lean back and turn it into an incline press.",
      "Move your head 'through the window' once the bar passes your forehead.",
      "Keep your forearms vertical.",
    ],
  },
  "Dumbbell Shoulder Press": {
    name: "Dumbbell Shoulder Press",
    slug: "shoulder-press",
    type: "strength",
    muscles: ["Shoulders", "Triceps"],
    summary: "Seated or standing press with dumbbells (or a machine) — builds round, strong delts.",
    steps: [
      "Bring the dumbbells to shoulder height, palms facing forward.",
      "Press up and slightly together until your arms are nearly locked out.",
      "Lower under control to ear level.",
    ],
    cues: [
      "Don't bang the dumbbells together at the top.",
      "Keep your ribs down — brace the core.",
      "Stop the lowering phase at ear height to keep tension.",
    ],
  },
  "Deadlift": {
    name: "Deadlift",
    slug: "deadlift",
    type: "strength",
    muscles: ["Hamstrings", "Glutes", "Back"],
    summary: "Pull a loaded bar from the floor to a standing lockout — full posterior-chain power.",
    steps: [
      "Stand with mid-foot under the bar, hinge down and grip just outside your legs.",
      "Drop your hips, chest up, take the slack out of the bar.",
      "Drive the floor away and stand tall, then return the bar along your legs.",
    ],
    cues: [
      "Keep the bar dragging close to your body the whole pull.",
      "Brace like you're about to be punched before you pull.",
      "Push the floor away rather than yanking with your back.",
    ],
  },
  "Romanian Deadlift": {
    name: "Romanian Deadlift",
    slug: "romanian-deadlift",
    type: "strength",
    muscles: ["Hamstrings", "Glutes", "Lower Back"],
    summary: "A top-down hip hinge that loads the hamstrings and glutes through a big stretch.",
    steps: [
      "Start standing, bar at your hips, knees softly bent.",
      "Push your hips back and let the bar slide down your thighs.",
      "Stop when you feel a strong hamstring stretch, then drive your hips forward to stand.",
    ],
    cues: [
      "It's a hinge, not a squat — hips travel back, not down.",
      "Keep the bar against your legs the entire time.",
      "Maintain a flat back; don't round to chase depth.",
    ],
  },
  "Barbell Row": {
    name: "Barbell Row",
    slug: "barbell-row",
    type: "strength",
    muscles: ["Lats", "Mid Back", "Biceps"],
    summary: "Hinge over and row a barbell to your torso — a heavy back-thickness builder.",
    steps: [
      "Hinge to about 45°, bar hanging at arm's length, flat back.",
      "Pull the bar to your lower ribs by driving your elbows back.",
      "Squeeze the back, then lower under control.",
    ],
    cues: [
      "Lead with the elbows, not the hands.",
      "Keep your torso angle fixed — don't heave upright.",
      "Squeeze the shoulder blades together at the top.",
    ],
  },
  "Cable Row": {
    name: "Cable Row",
    slug: "cable-row",
    type: "strength",
    muscles: ["Lats", "Mid Back", "Biceps"],
    summary: "Seated horizontal row (cable, machine, or chest-supported) for back thickness.",
    steps: [
      "Sit tall, feet braced, grab the handle with arms extended.",
      "Pull the handle to your stomach, driving your elbows back.",
      "Let the weight stretch your back forward, then row again.",
    ],
    cues: [
      "Keep your chest up and torso still — don't rock for momentum.",
      "Pull to the belly button, not the chest.",
      "Get a full stretch at the front of each rep.",
    ],
  },
  "Lat Pulldown": {
    name: "Lat Pulldown",
    slug: "lat-pulldown",
    type: "strength",
    muscles: ["Lats", "Biceps", "Mid Back"],
    summary: "Vertical pull that builds the lats — the bridge toward your first pull-ups.",
    steps: [
      "Grip the bar wider than shoulders, secure your thighs under the pad.",
      "Pull the bar to your upper chest by driving your elbows down.",
      "Control the bar back up to a full stretch overhead.",
    ],
    cues: [
      "Lead with the elbows, think 'elbows to hips'.",
      "Don't lean way back — slight lean only.",
      "Full stretch at the top each rep.",
    ],
  },
  "Pull-ups": {
    name: "Pull-ups",
    slug: "pull-ups",
    type: "strength",
    muscles: ["Lats", "Biceps", "Core"],
    summary: "Bodyweight (or weighted) vertical pull — the gold standard of back strength.",
    steps: [
      "Hang from the bar with an overhand grip, slightly wider than shoulders.",
      "Pull your chest toward the bar by driving your elbows down and back.",
      "Lower all the way to a full hang under control.",
    ],
    cues: [
      "Start each rep from a dead hang — full range.",
      "Drive your elbows to your ribs.",
      "Keep your core tight to stop swinging.",
    ],
  },
  "Push-ups": {
    name: "Push-ups",
    slug: "push-ups",
    type: "strength",
    muscles: ["Chest", "Triceps", "Core"],
    summary: "The fundamental bodyweight press — a moving plank that builds the whole upper body.",
    steps: [
      "Set hands slightly wider than shoulders, body in a straight line.",
      "Lower your chest toward the floor with elbows at ~45°.",
      "Press back up and lock out, keeping your body rigid.",
    ],
    cues: [
      "Keep a straight line from head to heels — no sagging hips.",
      "Elbows at 45°, not flared to 90°.",
      "Full lockout at the top.",
    ],
  },
  "Lateral Raise": {
    name: "Lateral Raise",
    slug: "lateral-raise",
    type: "strength",
    muscles: ["Side Delts"],
    summary: "Raise dumbbells out to the sides — the key move for wider, capped shoulders.",
    steps: [
      "Stand with a dumbbell in each hand, slight bend in the elbows.",
      "Raise your arms out to the sides up to shoulder height.",
      "Lower slowly under control.",
    ],
    cues: [
      "Lead with your elbows, pinkies slightly up.",
      "Go light — momentum kills this exercise.",
      "Stop at shoulder height; no higher.",
    ],
  },
  "Face Pull": {
    name: "Face Pull",
    slug: "face-pull",
    type: "strength",
    muscles: ["Rear Delts", "Upper Back"],
    summary: "Rope pull to the face — bulletproofs the shoulders and improves posture.",
    steps: [
      "Set a rope at face height, grab both ends with thumbs back.",
      "Pull the rope toward your face, splitting your hands apart.",
      "Squeeze the rear delts, then return under control.",
    ],
    cues: [
      "Pull to your forehead with high elbows.",
      "Externally rotate — thumbs end pointing behind you.",
      "Light weight, slow tempo, full squeeze.",
    ],
  },
  "Rear Delt Fly": {
    name: "Rear Delt Fly",
    slug: "rear-delt-fly",
    type: "strength",
    muscles: ["Rear Delts", "Upper Back"],
    summary: "A reverse fly that targets the often-neglected rear delts.",
    steps: [
      "Hinge forward with a dumbbell in each hand, arms hanging down.",
      "With soft elbows, raise the weights out to the sides.",
      "Squeeze the rear delts at the top, then lower under control.",
    ],
    cues: [
      "Keep a fixed elbow bend — it's an arc, not a row.",
      "Lead with the pinkies.",
      "Go light and feel the rear delts working.",
    ],
  },
  "Barbell Curl": {
    name: "Barbell Curl",
    slug: "barbell-curl",
    type: "strength",
    muscles: ["Biceps"],
    summary: "The classic mass-builder for the biceps with a straight or EZ bar.",
    steps: [
      "Stand holding the bar at arm's length, shoulder-width grip.",
      "Curl the bar up by flexing the biceps, keeping elbows pinned.",
      "Lower under control to a full stretch.",
    ],
    cues: [
      "Keep your elbows glued to your sides.",
      "Don't swing or use your back.",
      "Full range — all the way up, all the way down.",
    ],
  },
  "Cable Curl": {
    name: "Cable Curl",
    slug: "cable-curl",
    type: "strength",
    muscles: ["Biceps"],
    summary: "Constant-tension bicep curl from a low pulley.",
    steps: [
      "Attach a bar to a low pulley, stand back to load the cable.",
      "Curl the bar up, keeping elbows fixed at your sides.",
      "Lower slowly, resisting the cable the whole way.",
    ],
    cues: [
      "The cable keeps tension at the bottom — use it.",
      "No elbow drift forward.",
      "Squeeze hard at the top.",
    ],
  },
  "Hammer Curl": {
    name: "Hammer Curl",
    slug: "hammer-curl",
    type: "strength",
    muscles: ["Biceps", "Forearms"],
    summary: "Neutral-grip curl that builds the brachialis for thicker-looking arms.",
    steps: [
      "Hold dumbbells with palms facing each other (neutral grip).",
      "Curl up keeping the neutral grip throughout.",
      "Lower under control to full extension.",
    ],
    cues: [
      "Keep palms facing in the whole time.",
      "Elbows stay pinned to your sides.",
      "Control the lowering phase.",
    ],
  },
  "Tricep Pushdown": {
    name: "Tricep Pushdown",
    slug: "tricep-pushdown",
    type: "strength",
    muscles: ["Triceps"],
    summary: "Cable pushdown (bar or rope) — the go-to tricep isolation movement.",
    steps: [
      "Set a high pulley, grab the attachment with elbows at your sides.",
      "Push down by extending the elbows until your arms are straight.",
      "Control the weight back up to about 90° at the elbow.",
    ],
    cues: [
      "Pin your elbows to your sides — only the forearms move.",
      "Lock out and squeeze the triceps at the bottom.",
      "Lean slightly forward for a stable base.",
    ],
  },
  "Triceps Extension": {
    name: "Triceps Extension",
    slug: "triceps-extension",
    type: "strength",
    muscles: ["Triceps"],
    summary: "Overhead extension that stretches and builds the long head of the triceps.",
    steps: [
      "Hold a dumbbell or rope overhead with elbows pointing up.",
      "Lower the weight behind your head by bending only the elbows.",
      "Extend back up to lockout, squeezing the triceps.",
    ],
    cues: [
      "Keep your elbows high and close together.",
      "Get a deep stretch at the bottom.",
      "Only the forearms move — upper arms stay still.",
    ],
  },
  "Weighted Dips": {
    name: "Weighted Dips",
    slug: "weighted-dips",
    type: "strength",
    muscles: ["Chest", "Triceps", "Front Delts"],
    summary: "Bodyweight (or weighted) dip on parallel bars — a powerful chest and tricep builder.",
    steps: [
      "Support yourself on parallel bars, arms locked out.",
      "Lower by bending the elbows until your shoulders are just below your elbows.",
      "Press back up to full lockout.",
    ],
    cues: [
      "Lean forward for chest, stay upright for triceps.",
      "Don't go so deep that your shoulders hurt.",
      "Control the descent — no dropping.",
    ],
  },
  "Leg Press": {
    name: "Leg Press",
    slug: "leg-press",
    type: "strength",
    muscles: ["Quads", "Glutes", "Hamstrings"],
    summary: "Machine press that lets you load the legs heavily with low balance demand.",
    steps: [
      "Sit back with feet shoulder-width on the platform.",
      "Unlock the safeties and lower until your knees reach ~90°.",
      "Press through mid-foot back up without locking the knees hard.",
    ],
    cues: [
      "Don't let your lower back round off the pad.",
      "Keep knees tracking over toes.",
      "Don't slam into a locked knee at the top.",
    ],
  },
  "Leg Curl": {
    name: "Leg Curl",
    slug: "leg-curl",
    type: "strength",
    muscles: ["Hamstrings"],
    summary: "Seated or lying machine curl that isolates the hamstrings.",
    steps: [
      "Set the pad just above your heels, knees off the bench edge.",
      "Curl your heels toward your glutes.",
      "Squeeze the hamstrings, then lower under control.",
    ],
    cues: [
      "Avoid jerking — smooth, controlled reps.",
      "Squeeze hard at the fully bent position.",
      "Keep your hips down on the pad.",
    ],
  },
  "Nordic Curl": {
    name: "Nordic Curl",
    slug: "nordic-curl",
    type: "strength",
    muscles: ["Hamstrings"],
    summary: "Brutal bodyweight hamstring curl — lower yourself slowly with anchored ankles.",
    steps: [
      "Kneel with your ankles anchored under a pad or held by a partner.",
      "Keeping a straight line from knees to head, lower yourself as slowly as possible.",
      "Catch with your hands, then push and pull yourself back up.",
    ],
    cues: [
      "Fight gravity — the slow negative is the whole point.",
      "Keep your hips extended; don't bend at the waist.",
      "Use your hands to assist as needed.",
    ],
  },
  "Leg Extension": {
    name: "Leg Extension",
    slug: "leg-extension",
    type: "strength",
    muscles: ["Quads"],
    summary: "Machine isolation that hammers the quads, especially near lockout.",
    steps: [
      "Sit with the pad on your lower shins, knees at the pivot.",
      "Extend your knees until your legs are straight.",
      "Squeeze the quads, then lower under control.",
    ],
    cues: [
      "Pause and squeeze at the top.",
      "Don't swing the weight up with momentum.",
      "Control the lowering phase fully.",
    ],
  },
  "Calf Raise": {
    name: "Calf Raise",
    slug: "calf-raise",
    type: "strength",
    muscles: ["Calves"],
    summary: "Rise onto your toes against load to build the calves through a full stretch.",
    steps: [
      "Stand with the balls of your feet on a step or block, heels hanging.",
      "Drop your heels for a deep stretch.",
      "Rise up onto your toes as high as possible and squeeze.",
    ],
    cues: [
      "Full range — deep stretch at the bottom, high squeeze at the top.",
      "Pause briefly at the top of each rep.",
      "Slow and controlled, no bouncing.",
    ],
  },
  "Hip Thrust": {
    name: "Hip Thrust",
    slug: "hip-thrust",
    type: "strength",
    muscles: ["Glutes", "Hamstrings"],
    summary: "Bench-supported barbell bridge — the single best glute-building exercise.",
    steps: [
      "Sit on the floor, upper back against a bench, bar over your hips.",
      "Drive through your heels to lift your hips until your torso is parallel to the floor.",
      "Squeeze your glutes hard at the top, then lower under control.",
    ],
    cues: [
      "Tuck your chin and keep your ribs down.",
      "Finish with a full glute squeeze, not a low-back arch.",
      "Push through your heels.",
    ],
  },
  "Walking Lunge": {
    name: "Walking Lunge",
    slug: "walking-lunge",
    type: "strength",
    muscles: ["Quads", "Glutes", "Hamstrings"],
    summary: "Step forward into alternating lunges — great for legs, balance, and conditioning.",
    steps: [
      "Hold dumbbells at your sides, stand tall.",
      "Step forward and lower until both knees are at ~90°.",
      "Drive through the front heel and step straight into the next lunge.",
    ],
    cues: [
      "Keep your torso upright.",
      "Front knee tracks over the foot.",
      "Take a long enough step to protect the front knee.",
    ],
  },
  "Plank": {
    name: "Plank",
    slug: "plank",
    type: "core",
    muscles: ["Core", "Abs"],
    summary: "An isometric hold that teaches your whole core to brace and stay rigid.",
    steps: [
      "Set forearms under your shoulders, legs extended behind you.",
      "Lift your hips so your body forms a straight line.",
      "Brace your abs and glutes and hold for time.",
    ],
    cues: [
      "Squeeze glutes and abs — don't let the hips sag or pike.",
      "Keep a neutral neck, eyes down.",
      "Breathe steadily while staying tight.",
    ],
  },
  "Hanging Leg Raise": {
    name: "Hanging Leg Raise",
    slug: "hanging-leg-raise",
    type: "core",
    muscles: ["Abs", "Hip Flexors"],
    summary: "Hang from a bar and raise your legs (or knees) to torch the lower abs.",
    steps: [
      "Hang from a bar with a firm grip, body still.",
      "Raise your legs (or knees) up by curling your pelvis toward your ribs.",
      "Lower under control without swinging.",
    ],
    cues: [
      "Curl the pelvis up — don't just swing the legs.",
      "Control the descent to kill momentum.",
      "Bend the knees if straight legs are too hard.",
    ],
  },
  "Barbell Shrugs": {
    name: "Barbell Shrugs",
    slug: "barbell-shrugs",
    type: "strength",
    muscles: ["Traps"],
    summary: "Elevate the shoulders straight up against load to build the upper traps.",
    steps: [
      "Hold a barbell at arm's length in front of your thighs.",
      "Shrug your shoulders straight up toward your ears.",
      "Squeeze the traps, then lower under control.",
    ],
    cues: [
      "Straight up and down — don't roll the shoulders.",
      "Pause and squeeze at the top.",
      "Let the bar pull your shoulders down for a stretch.",
    ],
  },
  "Power Clean": {
    name: "Power Clean",
    slug: "power-clean",
    type: "power",
    muscles: ["Full Body", "Posterior Chain"],
    summary: "An explosive pull from floor to shoulders — builds power and rate of force.",
    steps: [
      "Set up like a deadlift, bar over mid-foot, flat back.",
      "Explosively extend hips, knees, and ankles, shrugging the bar up.",
      "Drop under and catch the bar on your front delts in a quarter squat.",
    ],
    cues: [
      "Be patient off the floor, then explode at the top.",
      "Keep the bar close to your body the whole pull.",
      "Catch with the elbows whipping up fast.",
    ],
  },
  "Box Jump": {
    name: "Box Jump",
    slug: "box-jump",
    type: "power",
    muscles: ["Quads", "Glutes", "Calves"],
    summary: "Explosive jump onto a box — trains lower-body power and landing mechanics.",
    steps: [
      "Stand a foot back from a sturdy box, hips loaded.",
      "Swing your arms and jump explosively, landing softly on top.",
      "Stand fully, then step (don't jump) back down.",
    ],
    cues: [
      "Land soft and quiet with bent knees.",
      "Step down to save your joints.",
      "Pick a height you can land cleanly, not your max.",
    ],
  },
  "Kettlebell Swing": {
    name: "Kettlebell Swing",
    slug: "kettlebell-swing",
    type: "power",
    muscles: ["Glutes", "Hamstrings", "Core"],
    summary: "An explosive hip hinge that builds power and conditioning at the same time.",
    steps: [
      "Stand with a kettlebell a foot in front of you, hinge and grab it.",
      "Hike it back between your legs, then snap your hips forward to float it up.",
      "Let it swing back down and reload the hips for the next rep.",
    ],
    cues: [
      "Power comes from the hips, not the arms.",
      "Keep the bell floating — don't lift it with your shoulders.",
      "Flat back, athletic hinge.",
    ],
  },
  "Trap-Bar Jump": {
    name: "Trap-Bar Jump",
    slug: "trap-bar-jump",
    type: "power",
    muscles: ["Quads", "Glutes", "Calves"],
    summary: "Loaded jump from a trap bar — develops raw lower-body explosiveness safely.",
    steps: [
      "Stand inside a lightly loaded trap bar, grip the handles.",
      "Dip and explosively jump, leaving the ground a few inches.",
      "Land softly and reset before the next rep.",
    ],
    cues: [
      "Keep the load light — this is about speed.",
      "Full triple extension on the jump.",
      "Absorb the landing with bent knees.",
    ],
  },
  "Med-Ball Throw": {
    name: "Med-Ball Throw",
    slug: "med-ball-throw",
    type: "power",
    muscles: ["Core", "Full Body"],
    summary: "Throwing a medicine ball with max intent trains explosive total-body power.",
    steps: [
      "Hold the med ball, load your hips (or overhead, depending on variation).",
      "Explosively throw the ball into the floor or against a wall.",
      "Reset and repeat each rep with full intent.",
    ],
    cues: [
      "Throw with 100% effort — power, not endurance.",
      "Drive from the hips and core.",
      "Reset fully between reps.",
    ],
  },
  "Sled Push": {
    name: "Sled Push",
    slug: "sled-push",
    type: "power",
    muscles: ["Quads", "Glutes", "Calves"],
    summary: "Drive a loaded sled (or run shuttles) — brutal conditioning with zero impact.",
    steps: [
      "Grip the sled posts, arms extended, body leaning forward.",
      "Drive with short, powerful steps, keeping the sled moving.",
      "Push for the prescribed distance or time, then rest.",
    ],
    cues: [
      "Stay low with a forward lean.",
      "Powerful, choppy steps — don't over-stride.",
      "Keep constant tension on the sled.",
    ],
  },
  "Sprint": {
    name: "Sprint",
    slug: "sprint",
    type: "power",
    muscles: ["Hamstrings", "Glutes", "Calves"],
    summary: "Max-effort running bouts — the most athletic way to build speed and power.",
    steps: [
      "Warm up thoroughly with build-up runs first.",
      "Accelerate smoothly to near-max speed for the set distance.",
      "Walk back fully to recover before the next sprint.",
    ],
    cues: [
      "Drive the arms and pump the knees.",
      "Build up speed — don't go cold into max effort.",
      "Take full recovery between reps for quality.",
    ],
  },
  "Mobility Flow": {
    name: "Mobility Flow",
    slug: "mobility-flow",
    type: "cardio",
    muscles: ["Full Body"],
    summary: "A gentle sequence of dynamic stretches to prep joints and aid recovery.",
    steps: [
      "Move through dynamic stretches for hips, shoulders, and spine.",
      "Hold each position briefly and breathe into the stretch.",
      "Flow smoothly from one movement to the next for the set time.",
    ],
    cues: [
      "Move slowly and with control.",
      "Breathe deeply throughout.",
      "Never force a painful range.",
    ],
  },
  "Zone 2 Cardio": {
    name: "Zone 2 Cardio",
    slug: "zone2-cardio",
    type: "cardio",
    muscles: ["Heart", "Endurance"],
    summary: "Steady, easy cardio (walk, bike, row, swim) you can hold a conversation through.",
    steps: [
      "Pick any steady cardio — incline walk, bike, row, or easy jog.",
      "Settle into a pace where you could just barely hold a conversation.",
      "Hold that effort for the full duration.",
    ],
    cues: [
      "If you're gasping, slow down — this should feel sustainable.",
      "Consistency beats intensity here.",
      "Nasal breathing is a good gauge of the right pace.",
    ],
  },
  "Intervals": {
    name: "Intervals",
    slug: "intervals",
    type: "cardio",
    muscles: ["Heart", "Conditioning"],
    summary: "Alternating hard efforts and recovery — efficient cardio for fitness and fat loss.",
    steps: [
      "Warm up, then go hard for the work interval (e.g. 30–60s).",
      "Recover with easy effort for the rest interval.",
      "Repeat for the prescribed rounds, then cool down.",
    ],
    cues: [
      "Make the hard parts genuinely hard.",
      "Recover fully enough to hit the next effort.",
      "1–2 interval sessions a week is plenty.",
    ],
  },
};

// Variant / plural / synonym spellings → canonical guide key.
const ALIASES: Record<string, string> = {
  "Barbell Squat": "Back Squat",
  "Incline Bench": "Incline Dumbbell Press",
  "Incline DB Press": "Incline Dumbbell Press",
  "Machine Shoulder Press": "Dumbbell Shoulder Press",
  "Deficit Deadlift": "Deadlift",
  "Seated Row": "Cable Row",
  "Chest-Supported Row": "Cable Row",
  "Weighted Pull-ups": "Pull-ups",
  "Lateral Raises": "Lateral Raise",
  "Cable Curls": "Cable Curl",
  "Rope Pushdowns": "Tricep Pushdown",
  "Walking Lunges": "Walking Lunge",
  "Hanging Knee Raise": "Hanging Leg Raise",
  "Hanging Leg Raises": "Hanging Leg Raise",
  "Box Jumps": "Box Jump",
  "Kettlebell Swings": "Kettlebell Swing",
  "Shuttle Runs / Sled": "Sled Push",
  // Cardio variants
  "Incline Walk (Zone 2)": "Zone 2 Cardio",
  "Zone 2 Base": "Zone 2 Cardio",
  "Zone 2 Cooldown": "Zone 2 Cardio",
  "Bike / Row": "Zone 2 Cardio",
  "Bike / Walk / Swim": "Zone 2 Cardio",
  "Rower / Incline Walk": "Zone 2 Cardio",
  "Long Easy Cardio": "Zone 2 Cardio",
  "Easy Walk": "Zone 2 Cardio",
  "Tempo Intervals": "Intervals",
  "Interval Conditioning": "Intervals",
};

// Normalize a name for tolerant lookup: lowercase, trim, collapse whitespace,
// and strip stray punctuation so AI-edited name drift still resolves.
const normalizeKey = (s: string): string =>
  s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.]/g, "");

// Precomputed normalized lookup covering both canonical names and aliases.
const NORMALIZED: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const key of Object.keys(GUIDE)) map[normalizeKey(key)] = key;
  for (const [variant, canonical] of Object.entries(ALIASES)) {
    if (GUIDE[canonical]) map[normalizeKey(variant)] = canonical;
  }
  return map;
})();

// Resolve any exercise name (including variants / minor drift) to its guide.
export const getExerciseGuide = (name: string): ExerciseGuide | null => {
  if (GUIDE[name]) return GUIDE[name];
  const alias = ALIASES[name];
  if (alias && GUIDE[alias]) return GUIDE[alias];
  const canonical = NORMALIZED[normalizeKey(name)];
  return canonical ? GUIDE[canonical] : null;
};

export const allExerciseGuides = (): ExerciseGuide[] => Object.values(GUIDE);
