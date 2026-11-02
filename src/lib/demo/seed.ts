import { addDays, todayKey } from "@/lib/dates";
import { DEMO_CHALLENGE_ID, DEMO_USER_ID } from "./index";

export type Row = Record<string, unknown>;
export type Store = Record<string, Row[]>;

const SAM = "00000000-0000-4000-8000-000000000002";
const ALEX = "00000000-0000-4000-8000-000000000003";
const NOOR = "00000000-0000-4000-8000-000000000004";

function iso(dateKey: string, hour = 9, minute = 0): string {
  // Amsterdam is UTC+1 in November/December.
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+01:00`).toISOString();
}

let counter = 0;
export function demoId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(Date.now() % 1e8).padStart(8, "0")}${String(counter).padStart(4, "0")}`;
}

/** Builds a fresh demo dataset around today's date so streaks and timelines look alive. */
export function buildSeed(): Store {
  const today = todayKey();
  const d = (n: number) => addDays(today, -n);
  const start = d(11);
  const end = today < "2026-12-31" ? "2026-12-31" : addDays(today, 50);

  const profiles: Row[] = [
    { id: DEMO_USER_ID, display_name: "Bram", avatar_path: null, created_at: iso(start), updated_at: iso(start) },
    { id: SAM, display_name: "Sam de Vries", avatar_path: "demo/avatar-sam.jpg", created_at: iso(start), updated_at: iso(start) },
    { id: ALEX, display_name: "Alex Jansen", avatar_path: "demo/avatar-alex.jpg", created_at: iso(start), updated_at: iso(start) },
    { id: NOOR, display_name: "Noor Bakker", avatar_path: "demo/avatar-noor.jpg", created_at: iso(start), updated_at: iso(start) },
  ];

  const challenges: Row[] = [
    { id: DEMO_CHALLENGE_ID, name: "Winter Arc 2026", start_date: start, end_date: end, timezone: "Europe/Amsterdam", created_by: DEMO_USER_ID, created_at: iso(start) },
  ];

  const memberships: Row[] = [DEMO_USER_ID, SAM, ALEX, NOOR].map((user_id, i) => ({
    id: demoId(),
    challenge_id: DEMO_CHALLENGE_ID,
    user_id,
    role: i === 0 ? "admin" : "member",
    joined_at: iso(start, 10 + i),
  }));

  const pattern: Record<string, number[]> = {
    [DEMO_USER_ID]: [11, 10, 9, 8, 7, 5, 4, 3, 2, 1], // streak of 5 ending yesterday, today still open
    [SAM]: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    [ALEX]: [11, 9, 8, 6, 5, 2, 1, 0],
    [NOOR]: [10, 9, 8, 7, 6, 5, 4, 3, 1, 0],
  };
  const acts = [["moved"], ["strength", "nutrition"], ["moved", "hydration"], ["recovery"], ["strength"], ["nutrition", "alcohol"], ["moved", "strength", "hydration"]];
  const notes: Record<number, string> = { 1: "Vandaag lekker benen getraind!", 3: "Rustdag, bewust gekozen.", 0: "Koude ochtendwandeling ❄️" };
  const daily_checkins: Row[] = [];
  for (const [user_id, days] of Object.entries(pattern)) {
    days.forEach((n, i) => {
      daily_checkins.push({
        id: demoId(),
        challenge_id: DEMO_CHALLENGE_ID,
        user_id,
        checkin_date: d(n),
        activities: acts[(i + days.length) % acts.length],
        note: user_id === DEMO_USER_ID && notes[n] ? notes[n] : null,
        created_at: iso(d(n), n === 0 ? 7 : 19, 10),
        updated_at: iso(d(n), n === 0 ? 7 : 19, 10),
      });
    });
  }

  const recipes: Row[] = [
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: SAM, title: "Protein Pancakes 🥞", description: "Snel ontbijt met veel eiwit. Perfect na een ochtendtraining.", ingredients: "200 g magere kwark\n2 eieren\n50 g havermout\n1 banaan\nSnuf kaneel", instructions: "Alles mixen tot een glad beslag. Bak kleine pannenkoekjes in een hete pan met een beetje olie, twee minuten per kant.", category: "Ontbijt", protein_grams: 38, image_path: "demo/recipe-pancakes.jpg", created_at: iso(d(8), 8), updated_at: iso(d(8), 8) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: ALEX, title: "Chicken Rice Bowl 🥑", description: "Meal prep voor drie dagen. Kip, rijst, avocado en veel groente.", ingredients: "500 g kipfilet\n300 g basmatirijst\n2 avocado's\n1 komkommer\n200 g edamame\nSojasaus en sesam", instructions: "Kip kruiden en grillen. Rijst koken. Alles in bakjes verdelen, avocado er pas op de dag zelf bij.", category: "Middageten", protein_grams: 45, image_path: "demo/recipe-bowl.jpg", created_at: iso(d(5), 12), updated_at: iso(d(5), 12) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: DEMO_USER_ID, title: "High Protein Pasta 🍝", description: "Comfort food die toch in de Winter Arc past.", ingredients: "100 g linzenpasta\n150 g rundergehakt (mager)\n200 g passata\n1 ui, 2 tenen knoflook\nCottage cheese", instructions: null, category: "Avondeten", protein_grams: 52, image_path: "demo/recipe-pasta.jpg", created_at: iso(d(3), 18), updated_at: iso(d(3), 18) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: DEMO_USER_ID, title: "Overnight oats met skyr en blauwe bessen", description: "Vijf minuten werk de avond ervoor.", ingredients: "60 g havermout\n150 g skyr", instructions: null, category: "Ontbijt", protein_grams: 28, image_path: "static:/recipes/overnight-oats.jpg", created_at: iso(d(2), 7), updated_at: iso(d(2), 7) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: NOOR, title: "Greek Yogurt Breakfast 🍓", description: "Mijn vaste ontbijt. Twee minuten werk.", ingredients: "250 g Griekse yoghurt 0%\n100 g aardbeien\n20 g walnoten\n1 el honing", instructions: null, category: "Ontbijt", protein_grams: 27, image_path: "demo/recipe-yogurt.jpg", created_at: iso(d(1), 7, 30), updated_at: iso(d(1), 7, 30) },
  ];

  const wall_posts: Row[] = [
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: SAM, image_path: "demo/wall-gym.jpg", caption: "Dag 1 van de Winter Arc. We gaan ervoor! 🔥", created_at: iso(d(11), 18), updated_at: iso(d(11), 18) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: NOOR, image_path: "demo/wall-walk.jpg", caption: "Koud, grijs en toch 12.000 stappen.", created_at: iso(d(7), 16), updated_at: iso(d(7), 16) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: ALEX, image_path: "demo/wall-meal.jpg", caption: "Meal prep zondag. Drie dagen klaar.", created_at: iso(d(4), 14), updated_at: iso(d(4), 14) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: DEMO_USER_ID, image_path: "demo/wall-run.jpg", caption: "Eerste 5 km van het seizoen. Langzaam, maar gelopen.", created_at: iso(d(2), 8, 15), updated_at: iso(d(2), 8, 15) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: SAM, image_path: "demo/wall-view.jpg", caption: null, created_at: iso(d(0), 7, 45), updated_at: iso(d(0), 7, 45) },
  ];

  const post_reactions: Row[] = [
    { id: demoId(), post_id: wall_posts[0].id, user_id: DEMO_USER_ID, reaction: "fire", created_at: iso(d(11), 19) },
    { id: demoId(), post_id: wall_posts[0].id, user_id: ALEX, reaction: "muscle", created_at: iso(d(11), 20) },
    { id: demoId(), post_id: wall_posts[0].id, user_id: NOOR, reaction: "snow", created_at: iso(d(10), 8) },
    { id: demoId(), post_id: wall_posts[3].id, user_id: SAM, reaction: "clap", created_at: iso(d(2), 9) },
    { id: demoId(), post_id: wall_posts[3].id, user_id: NOOR, reaction: "heart", created_at: iso(d(2), 10) },
    { id: demoId(), post_id: wall_posts[4].id, user_id: ALEX, reaction: "snow", created_at: iso(d(0), 8) },
  ];

  const recipe_reactions: Row[] = [
    { id: demoId(), recipe_id: recipes[0].id, user_id: DEMO_USER_ID, reaction: "fire", created_at: iso(d(8), 9) },
    { id: demoId(), recipe_id: recipes[0].id, user_id: NOOR, reaction: "heart", created_at: iso(d(8), 10) },
  ];

  const recipe_favorites: Row[] = [{ id: demoId(), recipe_id: recipes[0].id, user_id: DEMO_USER_ID, created_at: iso(d(8), 9) }];

  const compliments: Row[] = [
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, sender_id: SAM, receiver_id: DEMO_USER_ID, message: "🔥 Lekker bezig!", created_at: iso(d(6), 21), read_at: iso(d(6), 22) },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, sender_id: NOOR, receiver_id: DEMO_USER_ID, message: "Die 5 km was echt een mooie stap. Trots op je!", created_at: iso(d(2), 12), read_at: null },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, sender_id: DEMO_USER_ID, receiver_id: ALEX, message: "💪 Trots op je!", created_at: iso(d(4), 15), read_at: iso(d(4), 16) },
  ];

  const notifications: Row[] = [
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, type: "compliment", actor_id: NOOR, ref_id: compliments[1].id, created_at: iso(d(2), 12), read_at: null },
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, type: "reaction", actor_id: SAM, ref_id: wall_posts[3].id, created_at: iso(d(2), 9), read_at: null },
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, type: "post", actor_id: SAM, ref_id: wall_posts[4].id, created_at: iso(d(0), 7, 45), read_at: null },
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, type: "recipe", actor_id: NOOR, ref_id: recipes[3].id, created_at: iso(d(1), 7, 30), read_at: iso(d(1), 9) },
  ];

  const water_entries: Row[] = [];
  const waterPlan: [number, number[]][] = [[0, [250, 500, 250]], [1, [500, 500, 750, 250, 250]], [2, [250, 500, 500, 250]], [3, [500, 750, 250]], [4, [250, 250]], [5, [500, 500, 500, 500, 500]], [6, [750, 500, 250, 250]]];
  for (const [n, amounts] of waterPlan) {
    amounts.forEach((amount_ml, i) =>
      water_entries.push({ id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: DEMO_USER_ID, log_date: d(n), amount_ml, created_at: iso(d(n), 8 + i * 2) }),
    );
  }

  const exerciseNames: [string, string][] = [
    ["Squat", "legs"], ["Leg Press", "legs"], ["Lunges", "legs"], ["Romanian Deadlift", "legs"], ["Leg Extension", "legs"], ["Leg Curl", "legs"], ["Calf Raise", "legs"],
    ["Bench Press", "chest"], ["Incline Dumbbell Press", "chest"], ["Chest Fly", "chest"], ["Push-up", "chest"],
    ["Lat Pulldown", "back"], ["Seated Row", "back"], ["Bent-over Row", "back"], ["Pull-up", "back"],
    ["Shoulder Press", "shoulders"], ["Lateral Raise", "shoulders"], ["Rear Delt Fly", "shoulders"],
    ["Bicep Curl", "arms"], ["Hammer Curl", "arms"], ["Tricep Pushdown", "arms"], ["Tricep Extension", "arms"],
    ["Plank", "core"], ["Crunch", "core"], ["Leg Raise", "core"], ["Russian Twist", "core"],
  ];
  const exercises: Row[] = exerciseNames.map(([name, muscle_group]) => ({ id: demoId(), name, muscle_group, is_custom: false, owner_user_id: null, created_at: iso(start) }));
  const exId = (name: string) => exercises.find((e) => e.name === name)!.id as string;

  const workout_sessions: Row[] = [
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "run", title: "Ochtendrun", workout_date: d(2), started_at: iso(d(2), 7, 30), completed_at: iso(d(2), 8, 5), duration_seconds: 1860, distance_meters: 5200, notes: "Rustig tempo, koud maar lekker.", status: "completed", created_at: iso(d(2), 8, 5), updated_at: iso(d(2), 8, 5) },
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "strength", title: "Lower body", workout_date: d(4), started_at: iso(d(4), 18), completed_at: iso(d(4), 18, 55), duration_seconds: 3300, distance_meters: null, notes: null, status: "completed", created_at: iso(d(4), 18, 55), updated_at: iso(d(4), 18, 55) },
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "walk", title: "Avondwandeling", workout_date: d(6), started_at: null, completed_at: iso(d(6), 20), duration_seconds: 2700, distance_meters: 4100, notes: null, status: "completed", created_at: iso(d(6), 20), updated_at: iso(d(6), 20) },
    { id: demoId(), user_id: DEMO_USER_ID, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "run", title: "Intervallen", workout_date: d(9), started_at: null, completed_at: iso(d(9), 8), duration_seconds: 1500, distance_meters: 4000, notes: null, status: "completed", created_at: iso(d(9), 8), updated_at: iso(d(9), 8) },
  ];
  workout_sessions.push(
    { id: demoId(), user_id: SAM, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "run", title: "Tempo run", workout_date: d(1), started_at: null, completed_at: iso(d(1), 7, 40), duration_seconds: 1560, distance_meters: 5100, notes: null, status: "completed", created_at: iso(d(1), 7, 40), updated_at: iso(d(1), 7, 40) },
    { id: demoId(), user_id: SAM, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "cycle", title: "Rondje", workout_date: d(3), started_at: null, completed_at: iso(d(3), 17), duration_seconds: 3600, distance_meters: 28000, notes: null, status: "completed", created_at: iso(d(3), 17), updated_at: iso(d(3), 17) },
    { id: demoId(), user_id: SAM, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "run", title: "Lange duurloop", workout_date: d(8), started_at: null, completed_at: iso(d(8), 10), duration_seconds: 3900, distance_meters: 10500, notes: null, status: "completed", created_at: iso(d(8), 10), updated_at: iso(d(8), 10) },
    { id: demoId(), user_id: NOOR, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "walk", title: "Lunchwandeling", workout_date: d(0), started_at: null, completed_at: iso(d(0), 13), duration_seconds: 2400, distance_meters: 3200, notes: null, status: "completed", created_at: iso(d(0), 13), updated_at: iso(d(0), 13) },
    { id: demoId(), user_id: NOOR, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "yoga", title: "Yoga", workout_date: d(2), started_at: null, completed_at: iso(d(2), 19), duration_seconds: 2700, distance_meters: null, notes: null, status: "completed", created_at: iso(d(2), 19), updated_at: iso(d(2), 19) },
    { id: demoId(), user_id: NOOR, challenge_id: DEMO_CHALLENGE_ID, template_id: null, activity_type: "walk", title: "Avondwandeling", workout_date: d(5), started_at: null, completed_at: iso(d(5), 20), duration_seconds: 3000, distance_meters: 4500, notes: null, status: "completed", created_at: iso(d(5), 20), updated_at: iso(d(5), 20) },
  );
  const strengthSession = workout_sessions[1].id as string;
  const workout_exercises: Row[] = [
    { id: demoId(), session_id: strengthSession, exercise_id: exId("Squat"), sort_order: 0, notes: null },
    { id: demoId(), session_id: strengthSession, exercise_id: exId("Romanian Deadlift"), sort_order: 1, notes: null },
    { id: demoId(), session_id: strengthSession, exercise_id: exId("Leg Press"), sort_order: 2, notes: null },
  ];
  const exercise_sets: Row[] = [];
  const setPlan: [number, [number, number][]][] = [[0, [[40, 12], [50, 10], [55, 8]]], [1, [[50, 10], [60, 8], [60, 8]]], [2, [[100, 12], [120, 10], [120, 10]]]];
  for (const [wi, sets] of setPlan) sets.forEach(([w, r], i) => exercise_sets.push({ id: demoId(), workout_exercise_id: workout_exercises[wi].id, set_number: i + 1, weight_kg: w, repetitions: r, completed: true }));

  const stat_sharing: Row[] = [
    { user_id: SAM, share_workout_counts: true, share_minutes_distance: true, share_active_days: true, share_checkins: true, share_records: true, share_recent_workouts: true, updated_at: iso(start) },
    { user_id: NOOR, share_workout_counts: true, share_minutes_distance: false, share_active_days: true, share_checkins: true, share_records: false, share_recent_workouts: true, updated_at: iso(start) },
  ];

  const squad_messages: Row[] = [
    [SAM, 6, 19, 12, "Zondag 9:00 verzamelen bij het park voor 5 km?"],
    [NOOR, 6, 19, 20, "Ik ben erbij."],
    [ALEX, 6, 20, 5, "Ik ook, maar ik loop rustig achteraan."],
    [DEMO_USER_ID, 6, 20, 40, "Top, ik neem de route van vorige week."],
    [SAM, 2, 7, 55, "Lower body gedaan, squat 55 kg x 8."],
    [NOOR, 2, 12, 30, "Lunchwandeling van 3 km. Zon!"],
    [DEMO_USER_ID, 1, 18, 10, "Wie heeft er zin in een avondloop morgen?"],
    [ALEX, 1, 18, 25, "Hoe laat?"],
    [DEMO_USER_ID, 1, 18, 26, "19:30 bij mij."],
    [SAM, 0, 7, 45, "Nieuwe foto op de Wall, kijk maar."],
    [NOOR, 0, 8, 5, "Recept van vanavond staat in de Kitchen: linzen dahl."],
  ].map(([user_id, n, h, mi, body]) => ({ id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id, body, created_at: iso(d(n as number), h as number, mi as number), attachment_type: null, attachment_path: null, attachment_name: null, ref_id: null }));
  squad_messages.push(
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: NOOR, body: "", created_at: iso(d(0), 8, 6), attachment_type: "recipe", attachment_path: null, attachment_name: recipes[3].title, ref_id: recipes[3].id },
    { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: SAM, body: "Deze dus", created_at: iso(d(0), 7, 46), attachment_type: "post", attachment_path: null, attachment_name: wall_posts[3].caption, ref_id: wall_posts[3].id },
  );

  const squad_chat_reads: Row[] = [];

  const checkin_sources: Row[] = [];
  for (const c of daily_checkins) for (const a of c.activities as string[]) checkin_sources.push({ id: demoId(), user_id: c.user_id, challenge_id: DEMO_CHALLENGE_ID, checkin_date: c.checkin_date, activity: a, source: "manual", workout_session_id: null, created_at: c.created_at });

  return {
    profiles,
    water_entries,
    exercises,
    workout_plans: [],
    workout_templates: [],
    template_exercises: [],
    workout_sessions,
    workout_exercises,
    exercise_sets,
    checkin_sources,
    stat_sharing,
    squad_messages,
    squad_chat_reads,
    challenges,
    memberships,
    invitations: [],
    daily_checkins,
    recipes,
    recipe_favorites,
    recipe_reactions,
    wall_posts,
    post_reactions,
    compliments,
    alcohol_exceptions: [],
    notifications,
  };
}
