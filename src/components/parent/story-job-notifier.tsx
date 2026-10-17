"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type JobStatus = {
  id: string;
  status: string;
  progress?: string | null;
  storyId?: string | null;
  redirectTo?: string | null;
  error?: string | null;
  titleHint?: string;
};

const STORAGE_KEY = "em_active_story_jobs";

function loadJobIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJobIds(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function trackStoryJob(jobId: string) {
  const ids = loadJobIds();
  if (!ids.includes(jobId)) {
    saveJobIds([jobId, ...ids].slice(0, 20));
  }
  window.dispatchEvent(
    new CustomEvent("em-story-job", { detail: { jobId } }),
  );
}

async function maybeNotifyBrowser(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}

export function StoryJobNotifier({
  initialJobIds = [],
}: {
  initialJobIds?: string[];
}) {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [toast, setToast] = useState<JobStatus | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fromStorage = loadJobIds();
    const merged = Array.from(new Set([...initialJobIds, ...fromStorage]));
    saveJobIds(merged);

    function onCustom(e: Event) {
      const detail = (e as CustomEvent<{ jobId: string }>).detail;
      if (detail?.jobId) {
        const next = Array.from(new Set([detail.jobId, ...loadJobIds()]));
        saveJobIds(next);
      }
    }
    window.addEventListener("em-story-job", onCustom);
    return () => window.removeEventListener("em-story-job", onCustom);
  }, [initialJobIds]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const ids = loadJobIds();
      if (ids.length === 0) {
        if (!cancelled) setJobs([]);
        return;
      }
      const results: JobStatus[] = [];
      const stillActive: string[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(`/api/stories/jobs/${id}`);
          if (!res.ok) continue;
          const body = (await res.json()) as JobStatus;
          results.push(body);
          if (body.status === "pending" || body.status === "running") {
            stillActive.push(id);
          } else if (body.status === "ready") {
            stillActive.push(id);
            if (!notifiedRef.current.has(id)) {
              notifiedRef.current.add(id);
              setToast(body);
              void maybeNotifyBrowser(
                "História pronta!",
                body.progress || "Sua história do Estúdio Mágico está pronta.",
              );
            }
          } else if (body.status === "failed") {
            if (!notifiedRef.current.has(id)) {
              notifiedRef.current.add(id);
              setToast(body);
            }
          }
        } catch {
          stillActive.push(id);
        }
      }
      // Remove failed/ready after toast seen for a while — keep ready until dismissed
      saveJobIds(
        stillActive.filter((id) => {
          const j = results.find((r) => r.id === id);
          return j && (j.status === "pending" || j.status === "running" || j.status === "ready");
        }),
      );
      if (!cancelled) setJobs(results.filter((j) => j.status !== "failed" || toast?.id === j.id));
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [toast?.id]);

  const active = jobs.filter(
    (j) => j.status === "pending" || j.status === "running",
  );

  return (
    <>
      {active.length > 0 ? (
        <div className="rounded-xl border border-amber-600/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-medium">
            <Bell className="size-4" />
            {active.length === 1
              ? "Gerando sua história em segundo plano…"
              : `${active.length} histórias na fila…`}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-900/80">
            {active.map((j) => (
              <li key={j.id}>{j.progress || j.status}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-border bg-background p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">
                {toast.status === "ready"
                  ? "História pronta!"
                  : "Geração falhou"}
              </p>
              <p className="text-sm text-muted-foreground">
                {toast.progress || toast.error || "Abra a biblioteca para ver."}
              </p>
              {toast.status === "ready" && toast.redirectTo ? (
                <Button asChild size="sm" className="mt-2">
                  <Link href={toast.redirectTo}>Abrir história</Link>
                </Button>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                const ids = loadJobIds().filter((id) => id !== toast.id);
                saveJobIds(ids);
                setToast(null);
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
