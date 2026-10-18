"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddFriendButton } from "@/components/social/add-friend-button";
import { searchParentByQueryAction } from "@/lib/social/friend-actions";
import type { FriendProfile } from "@/lib/social/types";

export function EmailFriendSearch({
  title = "Buscar amigo",
  placeholder = "Nome ou e-mail",
  compact = false,
}: {
  title?: string;
  placeholder?: string;
  compact?: boolean;
} = {}) {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<FriendProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section
      className={
        compact
          ? "space-y-3"
          : "space-y-3 rounded-2xl border border-border/70 p-4"
      }
    >
      {!compact ? (
        <div>
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Encontre outra família pelo nome ou e-mail da conta dos pais.
          </p>
        </div>
      ) : (
        <p className="text-sm font-medium">{title}</p>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setProfiles([]);
          startTransition(async () => {
            const result = await searchParentByQueryAction(query);
            if (result.error) {
              setError(result.error);
              return;
            }
            setProfiles(result.profiles ?? (result.profile ? [result.profile] : []));
          });
        }}
      >
        <Input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
          minLength={2}
        />
        <Button type="submit" disabled={pending} className="gap-1.5">
          <Search className="size-3.5" />
          {pending ? "Buscando…" : "Buscar"}
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {profiles.map((profile) => (
        <div
          key={profile.userId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3"
        >
          <div className="flex items-center gap-3">
            {profile.authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.authorAvatarUrl}
                alt=""
                className="size-12 rounded-full object-cover"
              />
            ) : (
              <div className="size-12 rounded-full bg-muted" />
            )}
            <div>
              <p className="font-medium">{profile.authorName}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
          </div>
          {profile.friendshipStatus === "self" ? (
            <p className="text-xs text-muted-foreground">Esta é a sua conta</p>
          ) : profile.friendshipStatus === "accepted" ? (
            <p className="text-xs font-medium text-emerald-800">Já são amigos</p>
          ) : profile.friendshipStatus === "pending" ? (
            <p className="text-xs text-muted-foreground">Pedido pendente</p>
          ) : (
            <AddFriendButton userId={profile.userId} />
          )}
        </div>
      ))}
    </section>
  );
}
