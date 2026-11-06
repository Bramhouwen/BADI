/**
 * Minimal in-memory stand-in for the Supabase client, used only in demo mode.
 * It supports the subset of the query builder, RPCs, auth and storage calls
 * that the app uses, and mimics the database triggers for notifications.
 */
import { buildSeed, demoId, type Row, type Store } from "./seed";
import { DEMO_CHALLENGE_ID, DEMO_USER_ID } from "./index";
import { personalRecords, weekStartOf, type RecordSession } from "@/lib/checkin-plan";
import { todayKey } from "@/lib/dates";
import { availablePrizes, expectedCost, wheelOdds, WHEEL_CHALLENGES, type PrizeLike, type WheelCategory } from "@/lib/wheel";

type Result = { data: unknown; error: { message: string } | null; count: number | null };

const g = globalThis as unknown as { __winterArcDemoStore?: Store };
function store(): Store {
  if (!g.__winterArcDemoStore) g.__winterArcDemoStore = buildSeed();
  return g.__winterArcDemoStore;
}

const FK: Record<string, string> = { profiles: "user_id", exercises: "exercise_id", challenges: "challenge_id" };

type Filter = (row: Row) => boolean;

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private ascending = true;
  private limitN: number | null = null;
  private mode: "single" | "maybe" | null = null;
  private countExact = false;
  private head = false;
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private onConflict: string[] = [];
  private returning: string | null = null;

  constructor(private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.returning = cols;
    else this.returning = cols;
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.head = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col]) >= String(val));
    return this;
  }
  lte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col]) <= String(val));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    else this.filters.push((r) => r[col] !== val);
    return this;
  }
  gt(col: string, val: unknown) {
    this.filters.push((r) => String(r[col]) > String(val));
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push((r) => String(r[col]) < String(val));
    return this;
  }
  or(expr: string) {
    // Supports the one pattern the app uses: "owner_user_id.is.null,owner_user_id.eq.<id>"
    const parts = expr.split(",").map((p) => p.trim());
    this.filters.push((r) =>
      parts.some((p) => {
        const [col, op, ...rest] = p.split(".");
        const val = rest.join(".");
        if (op === "is" && val === "null") return r[col] == null;
        if (op === "eq") return String(r[col]) === val;
        return false;
      }),
    );
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.ascending = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = rows;
    this.onConflict = (opts?.onConflict ?? "id").split(",").map((s) => s.trim());
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  private matching(): Row[] {
    return (store()[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }

  private withJoins(rows: Row[]): Row[] {
    const cols = this.returning ?? "*";
    const joins = [...cols.matchAll(/(\w+):(\w+)\(\*\)/g)];
    if (joins.length === 0) return rows.map((r) => ({ ...r }));
    return rows.map((r) => {
      const out: Row = { ...r };
      for (const [, alias, table] of joins) {
        const fk = FK[table] ?? "id";
        out[alias] = (store()[table] ?? []).find((x) => x.id === r[fk]) ?? null;
      }
      return out;
    });
  }

  private finish(rows: Row[]): Result {
    let data: unknown = rows;
    if (this.mode === "single") data = rows[0] ?? null;
    if (this.mode === "maybe") data = rows[0] ?? null;
    if (this.mode === "single" && !rows[0]) return { data: null, error: { message: "Row not found" }, count: null };
    return { data: this.head ? null : data, error: null, count: this.countExact ? rows.length : null };
  }

  private execute(): Result {
    const s = store();
    if (!s[this.table]) s[this.table] = [];
    const now = new Date().toISOString();

    if (this.op === "select") {
      let rows = this.matching();
      if (this.orderCol) {
        const c = this.orderCol;
        rows = [...rows].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : String(a[c]) > String(b[c]) ? 1 : 0) * (this.ascending ? 1 : -1));
      }
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      return this.finish(this.withJoins(rows));
    }

    if (this.op === "insert" || this.op === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const inserted: Row[] = [];
      for (const input of list) {
        const existing =
          this.op === "upsert" ? s[this.table].find((r) => this.onConflict.every((c) => r[c] === input[c])) : undefined;
        if (existing) {
          Object.assign(existing, input, { updated_at: now });
          inserted.push(existing);
          continue;
        }
        const row: Row = { id: demoId(), created_at: now, updated_at: now, ...input };
        if (this.table === "daily_checkins" && s[this.table].some((r) => r.user_id === row.user_id && r.checkin_date === row.checkin_date)) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" }, count: null };
        }
        s[this.table].push(row);
        inserted.push(row);
        afterInsert(this.table, row);
      }
      return this.finish(inserted);
    }

    if (this.op === "update") {
      const rows = this.matching();
      for (const r of rows) Object.assign(r, this.payload as Row, { updated_at: now });
      return this.finish(rows);
    }

    if (this.op === "delete") {
      const rows = this.matching();
      s[this.table] = s[this.table].filter((r) => !rows.includes(r));
      return this.finish(rows);
    }
    return { data: null, error: { message: "unsupported" }, count: null };
  }

  then<R1 = Result, R2 = never>(onfulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null, onrejected?: ((e: unknown) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

/** Mimics the notification triggers from the migration. */
function afterInsert(table: string, row: Row) {
  const s = store();
  const notify = (user_id: unknown, type: string, actor_id: unknown, ref_id: unknown) =>
    s.notifications.push({ id: demoId(), user_id, challenge_id: DEMO_CHALLENGE_ID, type, actor_id, ref_id, created_at: new Date().toISOString(), read_at: null });
  const others = () => s.memberships.map((m) => m.user_id).filter((u) => u !== row.user_id);
  if (table === "compliments") notify(row.receiver_id, "compliment", row.sender_id, row.id);
  if (table === "post_reactions") {
    const post = s.wall_posts.find((p) => p.id === row.post_id);
    if (post && post.user_id !== row.user_id) notify(post.user_id, "reaction", row.user_id, post.id);
  }
  if (table === "wall_posts") for (const u of others()) notify(u, "post", row.user_id, row.id);
  if (table === "squad_messages") for (const u of (row.mentions as string[] | undefined) ?? []) if (u !== row.user_id) notify(u, "mention", row.user_id, row.id);
  if (table === "recipes") for (const u of others()) notify(u, "recipe", row.user_id, row.id);
}

const DEMO_TOKEN = "d".repeat(64);

/** Demo twin of the SQL function member_habits: yourself always, others only while they share habits. */
function memberHabits(s: Store, pUser: string, from: string, to: string) {
  const row = s.stat_sharing.find((r) => r.user_id === pUser);
  const shared = pUser === DEMO_USER_ID || (row ? row.share_habits !== false : true);
  if (!shared) return { shared: false, habits: [] };
  const habits = s.custom_habits
    .filter((h) => h.user_id === pUser)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji ?? null,
      dates: s.custom_habit_logs.filter((l) => l.habit_id === h.id && String(l.log_date) >= from && String(l.log_date) <= to).map((l) => l.log_date).sort(),
    }));
  return { shared: true, habits };
}

/** Demo twin of the SQL function squad_member_stats: same gating, same shape. */
function squadMemberStats(s: Store, pUser: string): Result {
  const isMember = s.memberships.some((m) => m.user_id === pUser && m.challenge_id === DEMO_CHALLENGE_ID);
  if (!isMember) return { data: null, error: { message: "NOT_A_MEMBER" }, count: null };
  const self = pUser === DEMO_USER_ID;
  const row = s.stat_sharing.find((r) => r.user_id === pUser);
  const flag = (col: string, fallback: boolean) => self || (row ? Boolean(row[col]) : fallback);
  // Everything is shared unless switched off (migration 0022).
  const counts = flag("share_workout_counts", true);
  const minutes = flag("share_minutes_distance", true);
  const active = flag("share_active_days", true);
  const checkins = flag("share_checkins", true);
  const records = flag("share_records", true);
  const recent = flag("share_recent_workouts", true);
  const done = s.workout_sessions.filter((w) => w.user_id === pUser && w.status === "completed").sort((a, b) => (String(a.workout_date) < String(b.workout_date) ? 1 : -1));
  const strip = (w: Row) => ({ activity_type: w.activity_type, workout_date: w.workout_date, duration_seconds: minutes ? w.duration_seconds : null, distance_meters: minutes ? w.distance_meters : null });
  let recordsJson: unknown = null;
  if (records) {
    const runs = done.filter((w) => w.activity_type === "run");
    const fiveK = runs.filter((w) => Number(w.distance_meters) >= 5000 && Number(w.distance_meters) <= 5500 && Number(w.duration_seconds) > 0);
    const byExercise = new Map<string, number>();
    for (const we of s.workout_exercises) {
      const session = done.find((w) => w.id === we.session_id);
      if (!session) continue;
      const name = String(s.exercises.find((e) => e.id === we.exercise_id)?.name ?? "");
      for (const set of s.exercise_sets) {
        if (set.workout_exercise_id !== we.id || !set.completed || !(Number(set.weight_kg) > 0)) continue;
        byExercise.set(name, Math.max(byExercise.get(name) ?? 0, Number(set.weight_kg)));
      }
    }
    recordsJson = {
      longest_run_meters: runs.length ? Math.max(...runs.map((w) => Number(w.distance_meters) || 0)) : null,
      fastest_5k_seconds: fiveK.length ? Math.min(...fiveK.map((w) => Number(w.duration_seconds))) : null,
      strength: [...byExercise.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([exercise, max_weight_kg]) => ({ exercise, max_weight_kg })),
    };
  }
  return {
    data: {
      user_id: pUser,
      sharing: { workout_counts: counts, minutes_distance: minutes, active_days: active, checkins, records, recent_workouts: recent },
      sessions: counts ? done.map(strip) : [],
      workout_dates: !counts && active ? [...new Set(done.map((w) => String(w.workout_date)))] : [],
      checkin_dates: checkins ? s.daily_checkins.filter((c) => c.user_id === pUser).map((c) => String(c.checkin_date)).sort() : [],
      records: recordsJson,
      recent: recent ? done.slice(0, 10).map(strip) : [],
    },
    error: null,
    count: null,
  };
}

function rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
  const s = store();
  const ok = (data: unknown): Result => ({ data, error: null, count: null });
  switch (name) {
    case "create_invitation":
      s.invitations.push({ id: demoId(), challenge_id: DEMO_CHALLENGE_ID, token_hash: "demo", invited_email: args.p_invited_email ?? null, created_by: DEMO_USER_ID, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), accepted_at: null, accepted_by: null, created_at: new Date().toISOString() });
      return Promise.resolve(ok(DEMO_TOKEN));
    case "preview_invitation":
      return Promise.resolve(
        ok(args.p_token === DEMO_TOKEN ? [{ challenge_name: "Winter Arc 2026", inviter_name: "Bram", valid: false, reason: "MEMBER_LIMIT_REACHED" }] : []),
      );
    case "accept_invitation":
      return Promise.resolve({ data: null, error: { message: "ALREADY_MEMBER" }, count: null });
    case "create_challenge":
      return Promise.resolve({ data: null, error: { message: "ALREADY_MEMBER" }, count: null });
    case "mark_notifications_read":
      for (const n of s.notifications) if (n.user_id === DEMO_USER_ID && !n.read_at) n.read_at = new Date().toISOString();
      return Promise.resolve(ok(null));
    case "group_compliment_count":
      return Promise.resolve(ok(s.compliments.length));
    case "squad_member_stats":
      return Promise.resolve(squadMemberStats(s, String(args.p_user)));
    case "shares_stat": {
      const row = s.stat_sharing.find((r) => r.user_id === String(args.p_user));
      return Promise.resolve(ok(row ? row[`share_${String(args.p_key)}`] !== false : true));
    }
    case "wheel_available_ids":
      return Promise.resolve(ok(demoAvailable(s).map((p) => p.id)));
    case "wheel_budget_status":
      return Promise.resolve(ok(demoBudgetLeft(s)));
    case "spin_wheel":
      return Promise.resolve(spinWheelTwin(s));
    case "claim_prize": {
      const spin = s.wheel_spins.find((x) => x.id === args.p_spin && x.user_id === DEMO_USER_ID);
      if (!spin) return Promise.resolve({ data: null, error: { message: "NOT_FOUND" }, count: null });
      if (spin.status !== "won") return Promise.resolve({ data: null, error: { message: "ALREADY_CLAIMED" }, count: null });
      const variants = (s.prizes.find((p) => p.id === spin.prize_id)?.variants as string[] | undefined) ?? [];
      if (variants.length && !variants.includes(String(args.p_variant))) return Promise.resolve({ data: null, error: { message: "PICK_VARIANT" }, count: null });
      Object.assign(spin, { status: "claimed", claimed_at: new Date().toISOString(), variant: variants.length ? args.p_variant : null });
      return Promise.resolve(ok(null));
    }
    case "complete_wheel_challenge": {
      const spin = s.wheel_spins.find((x) => x.id === args.p_spin && x.user_id === DEMO_USER_ID);
      if (spin && !spin.challenge_completed_at) spin.challenge_completed_at = new Date().toISOString();
      return Promise.resolve(ok(null));
    }
    case "week_records":
      return Promise.resolve(ok(weekRecords(s, String(args.p_from))));
    case "member_habits":
      return Promise.resolve(ok(memberHabits(s, String(args.p_user), String(args.p_from), String(args.p_to))));
    default:
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` }, count: null });
  }
}

/** Twin of wheel_budget_left: budget minus the cost of spins this week or month, or null. */
function demoBudgetLeft(s: ReturnType<typeof store>): number | null {
  const cfg = s.wheel_settings.find((w) => w.challenge_id === DEMO_CHALLENGE_ID);
  if (!cfg || cfg.budget_cents == null) return null;
  const today = todayKey();
  const from = cfg.budget_period === "week" ? weekStartOf(today) : `${today.slice(0, 7)}-01`;
  const spent = s.wheel_spins.filter((x) => todayKey(new Date(String(x.created_at))) >= from).reduce((a, x) => a + Number(x.cost_cents ?? 0), 0);
  return Number(cfg.budget_cents) - spent;
}

function demoAvailable(s: ReturnType<typeof store>) {
  const week = weekStartOf(todayKey());
  const wins: Record<string, number> = {};
  for (const x of s.wheel_spins) if (x.week_start === week && x.prize_id) wins[String(x.prize_id)] = (wins[String(x.prize_id)] ?? 0) + 1;
  return availablePrizes(s.prizes as unknown as (PrizeLike & Row)[], wins, demoBudgetLeft(s));
}

/** Twin of the SQL function spin_wheel: a level by its chance, then a prize by product weight. */
function spinWheelTwin(s: ReturnType<typeof store>): Result {
  const week = weekStartOf(todayKey());
  // Demo: unlimited spins, to walk through every outcome. The real function allows one per week.
  const available = demoAvailable(s);
  const weights = Object.fromEntries(s.wheel_categories.map((c) => [c.key, c.weight])) as Record<WheelCategory, number>;
  const odds = wheelOdds(weights, available);
  let pick = Math.random();
  let category: WheelCategory = odds[odds.length - 1].category;
  for (const o of odds) {
    if (pick < o.chance) {
      category = o.category;
      break;
    }
    pick -= o.chance;
  }
  const base = { id: demoId(), challenge_id: DEMO_CHALLENGE_ID, user_id: DEMO_USER_ID, week_start: week, created_at: new Date().toISOString(), claimed_at: null, delivered_at: null, challenge_completed_at: null, variant: null };
  let row: Row;
  if (category === "challenge") {
    row = { ...base, category, prize_id: null, prize_brand: null, prize_name: null, cost_cents: 0, challenge_key: WHEEL_CHALLENGES[Math.floor(Math.random() * WHEEL_CHALLENGES.length)], status: "challenge" };
  } else {
    const pool = available.filter((p) => p.category === category);
    const total = pool.reduce((a, p) => a + p.weight, 0);
    let r = Math.random() * total;
    const prize = pool.find((p) => (r -= p.weight) < 0) ?? pool[pool.length - 1];
    prize.stock = Number(prize.stock) - 1;
    row = { ...base, category, prize_id: prize.id, prize_brand: prize.brand, prize_name: prize.name, cost_cents: expectedCost(prize), challenge_key: null, status: "won" };
  }
  s.wheel_spins.push(row);
  return { data: row, error: null, count: null };
}

/** Twin of the SQL function week_records: new personal records since a date. */
function weekRecords(s: ReturnType<typeof store>, from: string): { user_id: string; record_date: string }[] {
  const sessions: RecordSession[] = [];
  for (const w of s.workout_sessions.filter((x) => x.status === "completed")) {
    for (const we of s.workout_exercises.filter((x) => x.session_id === w.id)) {
      const ex = s.exercises.find((e) => e.id === we.exercise_id);
      sessions.push({
        user_id: String(w.user_id),
        date: String(w.workout_date),
        created_at: String(w.created_at),
        exercise_id: String(we.exercise_id),
        measure: ex?.measure === "time" ? "time" : "reps",
        sets: s.exercise_sets
          .filter((x) => x.workout_exercise_id === we.id)
          .map((x) => ({ weight_kg: x.weight_kg == null ? null : Number(x.weight_kg), repetitions: (x.repetitions as number | null) ?? null, duration_seconds: (x.duration_seconds as number | null) ?? null, completed: Boolean(x.completed) })),
      });
    }
  }
  return personalRecords(sessions).filter((r) => r.date >= from).map((r) => ({ user_id: r.user_id, record_date: r.date }));
}

/** Resolves an object path to a URL: seeded demo images, or a placeholder for uploads made during the demo. */
function demoUrl(path: string): string {
  if (path.startsWith("static:")) return path.slice("static:".length);
  if (path.startsWith("demo/")) return `/${path}`;
  return "/demo/upload.jpg";
}

const demoUser = { id: DEMO_USER_ID, email: "demo@winterarc.app" };

export function createDemoClient() {
  const client = {
    from: (table: string) => new Query(table),
    rpc: (name: string, args?: Record<string, unknown>) => {
      const p = rpc(name, args);
      return Object.assign(p, { maybeSingle: () => p.then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })) });
    },
    auth: {
      getUser: async () => ({ data: { user: demoUser }, error: null }),
      getClaims: async () => ({ data: { claims: { sub: demoUser.id, email: demoUser.email } }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithOtp: async () => ({ data: {}, error: null }),
      signInWithPassword: async () => ({ data: { user: demoUser, session: {} }, error: null }),
      signUp: async () => ({ data: { user: demoUser, session: {} }, error: null }),
      exchangeCodeForSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: demoUrl(path), error: null })), error: null }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: demoUrl(path) }, error: null }),
        upload: async (path: string) => ({ data: { path }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => undefined };
      return ch;
    },
    removeChannel: () => undefined,
  };
  return client;
}
