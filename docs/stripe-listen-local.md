# Stripe webhook local (:5050)

Em desenvolvimento o app usa **Stripe Test** (`STRIPE_SECRET_KEY_TEST` + publishable test). O signing secret do webhook também deve ser o de test.

## CLI (recomendado)

1. Instale o [Stripe CLI](https://stripe.com/docs/stripe-cli) e faça login.
2. Encaminhe eventos para o Next local:

```bash
stripe listen --forward-to localhost:5050/api/stripe/webhook
```

3. Copie o `whsec_…` que o CLI imprime para `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
```

4. Reinicie `npm run dev` (porta **5050**) para carregar o secret.
5. Em outro terminal, dispare um evento de teste se quiser:

```bash
stripe trigger checkout.session.completed
```

## Notas

- Produção continua com `STRIPE_WEBHOOK_SECRET` (live) no host de deploy.
- Checkout Embedded no local exige `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST` (`pk_test_…`) da **mesma conta** do `sk_test_…`.
- Cartões de teste: `4242 4242 4242 4242` (só no modo test).
- Não altere produtos live; use o botão Admin **Sincronizar Stripe Test** ou o sync automático no boot.
