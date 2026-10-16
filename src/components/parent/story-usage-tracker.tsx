import { BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { StoryUsage } from "@/lib/stories/usage";

export function StoryUsageTracker({ usage }: { usage: StoryUsage }) {
  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const remaining = Math.max(0, usage.limit - usage.used);

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="size-4" />
            Histórias do mês
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight">
            Histórias usadas: {usage.used}/{usage.limit}
          </p>
          <p className="text-sm text-muted-foreground">
            {remaining === 0
              ? "Limite mensal atingido."
              : `Restam ${remaining} história${remaining === 1 ? "" : "s"} neste ciclo.`}
          </p>
        </div>
        <Badge variant="secondary">
          {usage.source === "supabase" ? "ao vivo" : "demo"}
        </Badge>
      </div>
      <Progress value={pct} className="h-2" />
    </section>
  );
}
