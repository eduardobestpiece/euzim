import { createAdminClient } from "@/lib/supabase/admin";

export type AdminKpis = {
  totalAccounts: number;
  active7d: number;
  dormant30d: number;
  byStatus: Record<string, number>;
  stories7d: number;
  stories30d: number;
  parentsWithoutStoriesPct: number;
  avgSessionSeconds7d: number;
  incompleteOnboarding: number;
  totalChildren: number;
  totalCharacters: number;
  monthSpendUsd: number;
  monthSpendBrl: number;
  monthTokens: number;
};

export type UsageCategoryBreakdown = {
  category: string;
  events: number;
  tokens: number;
  usd: number;
  brl: number;
};

export type UsageEventRow = {
  id: string;
  category: string;
  provider: string | null;
  model: string | null;
  operation: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  estimatedBrl: number;
  createdAt: string;
};

export type AdminAccountRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
  subscriptionStatus: string | null;
  subscriptionPlanId: string | null;
  complimentaryUntil: string | null;
  onboardingCompleted: boolean;
  onboardingResetMode: string | null;
  lastActiveAt: string | null;
  lastStoryAt: string | null;
  adminNotes: string | null;
  childrenCount: number;
  charactersCount: number;
  storiesCount: number;
  sessionSeconds7d: number;
  lastSignInAt: string | null;
  usageTokens: number;
  usageUsd: number;
  usageBrl: number;
  usageByCategory: UsageCategoryBreakdown[];
  recentUsage: UsageEventRow[];
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export async function loadAdminDashboard(): Promise<{
  kpis: AdminKpis;
  accounts: AdminAccountRow[];
  error?: string;
}> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      kpis: emptyKpis(),
      accounts: [],
      error: "Admin client indisponível.",
    };
  }

  const { data: users, error: usersErr } = await admin
    .from("users")
    .select(
      "id, email, full_name, role, subscription_status, subscription_plan_id, complimentary_until, onboarding_completed, onboarding_reset_mode, last_active_at, last_story_at, admin_notes, created_at",
    )
    .order("created_at", { ascending: false });

  if (usersErr) {
    return { kpis: emptyKpis(), accounts: [], error: usersErr.message };
  }

  const rows = users ?? [];
  const parentRows = rows.filter((u) => u.role === "parent");

  const [
    { data: children },
    { data: characters },
    { data: stories },
    { data: sessions },
    { data: usageEvents },
  ] = await Promise.all([
    admin.from("children").select("id, parent_id"),
    admin.from("characters").select("id, parent_id"),
    admin.from("stories").select("id, parent_id, created_at"),
    admin
      .from("analytics_sessions")
      .select("user_id, duration_seconds, last_seen_at")
      .gte("last_seen_at", daysAgo(7).toISOString()),
    admin
      .from("usage_events")
      .select(
        "id, user_id, category, provider, model, operation, prompt_tokens, completion_tokens, total_tokens, estimated_usd, estimated_brl, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const childCount = new Map<string, number>();
  for (const c of children ?? []) {
    childCount.set(c.parent_id, (childCount.get(c.parent_id) ?? 0) + 1);
  }
  const charCount = new Map<string, number>();
  for (const c of characters ?? []) {
    charCount.set(c.parent_id, (charCount.get(c.parent_id) ?? 0) + 1);
  }
  const storyCount = new Map<string, number>();
  const story7 = daysAgo(7).getTime();
  const story30 = daysAgo(30).getTime();
  let stories7d = 0;
  let stories30d = 0;
  for (const s of stories ?? []) {
    storyCount.set(s.parent_id, (storyCount.get(s.parent_id) ?? 0) + 1);
    const t = new Date(s.created_at).getTime();
    if (t >= story7) stories7d += 1;
    if (t >= story30) stories30d += 1;
  }

  const sessionSec = new Map<string, number>();
  let sessionSum = 0;
  let sessionUsers = 0;
  for (const s of sessions ?? []) {
    const sec = s.duration_seconds ?? 0;
    sessionSec.set(s.user_id, (sessionSec.get(s.user_id) ?? 0) + sec);
  }
  for (const [, sec] of sessionSec) {
    sessionSum += sec;
    sessionUsers += 1;
  }

  type UsageAgg = {
    tokens: number;
    usd: number;
    brl: number;
    byCategory: Map<string, UsageCategoryBreakdown>;
    recent: UsageEventRow[];
  };
  const usageByUser = new Map<string, UsageAgg>();
  const monthStart = new Date(monthStartIso()).getTime();
  let monthSpendUsd = 0;
  let monthSpendBrl = 0;
  let monthTokens = 0;

  for (const ev of usageEvents ?? []) {
    const usd = Number(ev.estimated_usd) || 0;
    const brl = Number(ev.estimated_brl) || 0;
    const tokens = Number(ev.total_tokens) || 0;
    const created = new Date(ev.created_at).getTime();
    if (created >= monthStart) {
      monthSpendUsd += usd;
      monthSpendBrl += brl;
      monthTokens += tokens;
    }

    let agg = usageByUser.get(ev.user_id);
    if (!agg) {
      agg = {
        tokens: 0,
        usd: 0,
        brl: 0,
        byCategory: new Map(),
        recent: [],
      };
      usageByUser.set(ev.user_id, agg);
    }
    agg.tokens += tokens;
    agg.usd += usd;
    agg.brl += brl;

    const cat = String(ev.category);
    const prev = agg.byCategory.get(cat) ?? {
      category: cat,
      events: 0,
      tokens: 0,
      usd: 0,
      brl: 0,
    };
    prev.events += 1;
    prev.tokens += tokens;
    prev.usd += usd;
    prev.brl += brl;
    agg.byCategory.set(cat, prev);

    if (agg.recent.length < 12) {
      agg.recent.push({
        id: ev.id,
        category: cat,
        provider: ev.provider ?? null,
        model: ev.model,
        operation: ev.operation,
        promptTokens: Number(ev.prompt_tokens) || 0,
        completionTokens: Number(ev.completion_tokens) || 0,
        totalTokens: tokens,
        estimatedUsd: usd,
        estimatedBrl: brl,
        createdAt: ev.created_at,
      });
    }
  }

  const signInMap = new Map<string, string | null>();
  try {
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      for (const u of data.users) {
        signInMap.set(u.id, u.last_sign_in_at ?? null);
      }
      if (data.users.length < 200) break;
      page += 1;
      if (page > 20) break;
    }
  } catch {
    // ignore
  }

  const active7d = parentRows.filter((u) => {
    const t = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
    return t >= story7;
  }).length;
  const dormant30d = parentRows.filter((u) => {
    const t = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
    return !t || t < daysAgo(30).getTime();
  }).length;

  const byStatus: Record<string, number> = {};
  for (const u of parentRows) {
    const st = u.subscription_status || "none";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
  }

  const withoutStories = parentRows.filter(
    (u) => (storyCount.get(u.id) ?? 0) === 0,
  ).length;
  const parentsWithoutStoriesPct =
    parentRows.length === 0
      ? 0
      : Math.round((withoutStories / parentRows.length) * 100);

  const accounts: AdminAccountRow[] = rows.map((u) => {
    const usage = usageByUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      subscriptionStatus: u.subscription_status,
      subscriptionPlanId: u.subscription_plan_id,
      complimentaryUntil: u.complimentary_until,
      onboardingCompleted: Boolean(u.onboarding_completed),
      onboardingResetMode: u.onboarding_reset_mode,
      lastActiveAt: u.last_active_at,
      lastStoryAt: u.last_story_at,
      adminNotes: u.admin_notes,
      childrenCount: childCount.get(u.id) ?? 0,
      charactersCount: charCount.get(u.id) ?? 0,
      storiesCount: storyCount.get(u.id) ?? 0,
      sessionSeconds7d: sessionSec.get(u.id) ?? 0,
      lastSignInAt: signInMap.get(u.id) ?? null,
      usageTokens: usage?.tokens ?? 0,
      usageUsd: usage?.usd ?? 0,
      usageBrl: usage?.brl ?? 0,
      usageByCategory: usage
        ? Array.from(usage.byCategory.values()).sort((a, b) =>
            a.category.localeCompare(b.category),
          )
        : [],
      recentUsage: usage?.recent ?? [],
    };
  });

  return {
    kpis: {
      totalAccounts: parentRows.length,
      active7d,
      dormant30d,
      byStatus,
      stories7d,
      stories30d,
      parentsWithoutStoriesPct,
      avgSessionSeconds7d:
        sessionUsers === 0 ? 0 : Math.round(sessionSum / sessionUsers),
      incompleteOnboarding: parentRows.filter((u) => !u.onboarding_completed)
        .length,
      totalChildren: children?.length ?? 0,
      totalCharacters: characters?.length ?? 0,
      monthSpendUsd,
      monthSpendBrl,
      monthTokens,
    },
    accounts,
  };
}

function emptyKpis(): AdminKpis {
  return {
    totalAccounts: 0,
    active7d: 0,
    dormant30d: 0,
    byStatus: {},
    stories7d: 0,
    stories30d: 0,
    parentsWithoutStoriesPct: 0,
    avgSessionSeconds7d: 0,
    incompleteOnboarding: 0,
    totalChildren: 0,
    totalCharacters: 0,
    monthSpendUsd: 0,
    monthSpendBrl: 0,
    monthTokens: 0,
  };
}
