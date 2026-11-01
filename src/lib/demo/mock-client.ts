/**
 * Minimal in-memory stand-in for the Supabase client, used only in demo mode.
 * It supports the subset of the query builder, RPCs, auth and storage calls
 * that the app uses, and mimics the database triggers for notifications.
 */
import { buildSeed, demoId, type Row, type Store } from "./seed";
import { DEMO_CHALLENGE_ID, DEMO_USER_ID } from "./index";

type Result = { data: unknown; error: { message: string } | null; count: number | null };

const g = globalThis as unknown as { __winterArcDemoStore?: Store };
function store(): Store {
  if (!g.__winterArcDemoStore) g.__winterArcDemoStore = buildSeed();
  return g.__winterArcDemoStore;
}

const FK: Record<string, string> = { profiles: "user_id" };

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
  if (table === "recipes") for (const u of others()) notify(u, "recipe", row.user_id, row.id);
}

const DEMO_TOKEN = "d".repeat(64);

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
    default:
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` }, count: null });
  }
}

/** Resolves an object path to a URL: seeded demo images, or a placeholder for uploads made during the demo. */
function demoUrl(path: string): string {
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
        upload: async () => ({ data: { path: "demo-upload" }, error: null }),
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
