import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { HasAccountGate } from "@/components/referral/has-account-gate";
import { InviteAcceptClient } from "@/components/social/invite-accept-client";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadFriendInvite } from "@/lib/social/friend-actions";

async function InviteInner({ token }: { token: string }) {
  await connection();
  const user = await getCurrentUser();
  const loaded = await loadFriendInvite(token);
  const resumePath = `/invite/${token}`;

  if (loaded.error || !loaded.invite) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4 py-16">
        <h1 className="font-heading text-2xl font-semibold">Convite inválido</h1>
        <p className="text-sm text-muted-foreground">
          {loaded.error ?? "Este link não existe ou já foi usado."}
        </p>
        <ButtonLink href={user ? "/app/social" : "/login"} />
      </main>
    );
  }

  const { invite } = loaded;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-16">
      <div className="flex items-center gap-4">
        {invite.authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={invite.authorAvatarUrl}
            alt=""
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">
            {invite.authorName} te convidou
          </h1>
          <p className="text-sm text-muted-foreground">
            Aceite para ver histórias Para Amigos no Social.
          </p>
        </div>
      </div>

      {!user ? (
        <HasAccountGate
          nextPath={resumePath}
          title="Já possui cadastro?"
          subtitle="Para aceitar o convite de amizade, entre ou crie sua conta."
        />
      ) : invite.expired ? (
        <p className="text-sm text-muted-foreground">
          Este convite expirou ou já foi respondido.
        </p>
      ) : invite.inviterId === user.id ? (
        <p className="text-sm text-muted-foreground">
          Este é o seu próprio convite. Compartilhe o link com outra família.
        </p>
      ) : (
        <InviteAcceptClient token={token} />
      )}
    </main>
  );
}

function ButtonLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium"
    >
      Voltar
    </Link>
  );
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando convite…" />}>
      <InviteBridge params={params} />
    </Suspense>
  );
}

async function InviteBridge({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteInner token={token} />;
}
