import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
  Users, Building2, TrendingUp, CheckSquare, Activity,
  ArrowRight, AlertCircle, Clock, Trophy, BarChart3,
  Phone, Mail, MessageSquare, Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { DashboardStats, LeadStatus, ActivityType } from "@/lib/types";
import { CRMLayout } from "@/components/crm/CRMLayout";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-50 text-blue-700",
  qualified: "bg-violet-50 text-violet-700",
  proposal: "bg-amber-50 text-amber-700",
  won: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
};

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  call: Phone,
  email: Mail,
  note: MessageSquare,
  meeting: Calendar,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call: "bg-blue-50 text-blue-600",
  email: "bg-violet-50 text-violet-600",
  note: "bg-amber-50 text-amber-600",
  meeting: "bg-green-50 text-green-600",
};

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-semibold text-foreground">{value}</p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </div>
            <div className={`p-2.5 rounded-lg ${color}`}>
              <Icon className="size-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/reports/dashboard")
      .then((r) => r.json())
      .then((body) => {
        if (body?.error) throw new Error(body.error);
        setStats(body?.stats ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <CRMLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-lg lg:col-span-2" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </CRMLayout>
    );
  }

  if (error) {
    return (
      <CRMLayout>
        <div className="flex items-center gap-2 text-destructive p-4 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="size-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </CRMLayout>
    );
  }

  const totalPipelineValue = stats?.leads_by_stage
    .filter((s) => !["won", "lost"].includes(s.status))
    .reduce((sum, s) => sum + s.total_value, 0) ?? 0;

  return (
    <CRMLayout>
      <div className="space-y-6">
          {/* Welcome */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here&apos;s what&apos;s happening with your sales pipeline today.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Contacts"
              value={stats?.total_contacts ?? 0}
              href="/contacts"
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={Building2}
              label="Companies"
              value={stats?.total_companies ?? 0}
              href="/companies"
              color="bg-violet-50 text-violet-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Active Leads"
              value={stats?.total_leads ?? 0}
              sub={`Pipeline: ${formatCurrency(totalPipelineValue)}`}
              href="/leads"
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={Trophy}
              label="Won Revenue"
              value={formatCurrency(stats?.won_leads_value ?? 0)}
              href="/leads"
              color="bg-green-50 text-green-600"
            />
          </div>

          {/* Tasks alert strip */}
          {stats && (stats.tasks_summary.overdue > 0 || stats.tasks_summary.due_today > 0) && (
            <div className="flex flex-wrap gap-3">
              {stats.tasks_summary.overdue > 0 && (
                <Link href="/tasks">
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors cursor-pointer">
                    <AlertCircle className="size-4" />
                    <span className="font-medium">{stats.tasks_summary.overdue} overdue task{stats.tasks_summary.overdue !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              )}
              {stats.tasks_summary.due_today > 0 && (
                <Link href="/tasks">
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
                    <Clock className="size-4" />
                    <span className="font-medium">{stats.tasks_summary.due_today} due today</span>
                  </div>
                </Link>
              )}
              {stats.tasks_summary.open_total > 0 && (
                <Link href="/tasks">
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                    <CheckSquare className="size-4" />
                    <span className="font-medium">{stats.tasks_summary.open_total} open task{stats.tasks_summary.open_total !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline by stage */}
            <Card className="lg:col-span-2 border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="size-4 text-muted-foreground" />
                    Pipeline by Stage
                  </CardTitle>
                  <Link href="/leads">
                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                      View all <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {!stats || stats.leads_by_stage.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No leads yet. <Link href="/leads" className="text-primary underline">Add your first lead</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(["new", "contacted", "qualified", "proposal", "won", "lost"] as LeadStatus[]).map((status) => {
                      const stage = stats.leads_by_stage.find((s) => s.status === status);
                      const count = stage?.count ?? 0;
                      const value = stage?.total_value ?? 0;
                      const maxCount = Math.max(...stats.leads_by_stage.map((s) => s.count), 1);
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className="w-20 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
                              {STATUS_LABELS[status]}
                            </span>
                          </div>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-24 text-right shrink-0">
                            <span className="text-xs font-medium text-foreground">{count}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {value > 0 ? `· ${formatCurrency(value)}` : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="size-4 text-muted-foreground" />
                    Recent Activity
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!stats || stats.recent_activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm px-4">
                    No recent activity.
                  </div>
                ) : (
                  <div className="divide-y">
                    {stats.recent_activities.slice(0, 6).map((act) => {
                      const Icon = ACTIVITY_ICONS[act.type as ActivityType] ?? MessageSquare;
                      const colorClass = ACTIVITY_COLORS[act.type as ActivityType] ?? "bg-slate-50 text-slate-600";
                      return (
                        <div key={act.id} className="flex gap-3 px-4 py-3">
                          <div className={`mt-0.5 p-1.5 rounded-md shrink-0 ${colorClass}`}>
                            <Icon className="size-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-foreground line-clamp-2">{act.body}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {act.user_name} · {formatDate(act.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick nav */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/contacts", label: "Contacts", icon: Users, desc: "Manage your contacts" },
              { href: "/companies", label: "Companies", icon: Building2, desc: "View all accounts" },
              { href: "/leads", label: "Leads", icon: TrendingUp, desc: "Track your pipeline" },
              { href: "/tasks", label: "Tasks", icon: CheckSquare, desc: "Stay on top of work" },
            ].map(({ href, label, icon: Icon, desc }) => (
              <Link key={href} href={href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer border h-full">
                  <CardContent className="p-4 flex flex-col gap-2">
                    <Icon className="size-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground mt-auto" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
    </CRMLayout>
  );
}


