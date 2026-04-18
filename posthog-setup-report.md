<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Sequência Viral. The integration covers client-side event tracking, user identification, server-side events for critical business operations (payments, AI generation, exports), and exception capture for error boundaries.

**Files created:**
- `instrumentation-client.ts` — PostHog client-side initialization using the Next.js 15.3+ instrumentation hook. Enables autocapture, session replay, and exception tracking automatically.
- `lib/posthog-server.ts` — Singleton server-side PostHog client (posthog-node) used across API routes.
- `next.config.ts` — Added reverse-proxy rewrites for `/ingest/*` → PostHog ingestion endpoints to improve ad-blocker resilience.
- `.env.local` — Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`.

**Packages installed:** `posthog-js`, `posthog-node`

## Event tracking summary

| Event | Description | File |
|-------|-------------|------|
| `user_signed_up` | User successfully created a new email/password account | `app/app/login/page.tsx` |
| `user_signed_in` | User signed in with email and password | `app/app/login/page.tsx` |
| `user_signed_in_with_google` | User clicked the Google OAuth sign-in button | `app/app/login/page.tsx` |
| `user_signed_in_with_twitter` | User clicked the X/Twitter OAuth sign-in button | `app/app/login/page.tsx` |
| `checkout_initiated` | User clicked the final subscribe button on the checkout page | `app/app/checkout/page.tsx` |
| `order_bump_toggled` | User toggled the autopublish add-on bump on the checkout page | `app/app/checkout/page.tsx` |
| `subscription_confirmed` | Stripe webhook confirmed checkout.session.completed — plan upgraded | `app/api/stripe/webhook/route.ts` |
| `subscription_cancelled` | Stripe webhook confirmed customer.subscription.deleted — user downgraded | `app/api/stripe/webhook/route.ts` |
| `carousel_generated` | AI successfully generated carousel variations | `app/api/generate/route.ts` |
| `carousel_exported` | User exported a carousel as PNG slides | `app/api/carousel/exports/route.ts` |
| `onboarding_completed` | User finished the onboarding flow | `app/app/onboarding/page.tsx` |
| `settings_saved` | User saved their profile settings | `app/app/settings/page.tsx` |
| `carousel_deleted` | User confirmed deletion of a carousel from the library | `app/app/carousels/page.tsx` |

**Exception tracking** was added to `app/app/error.tsx` and `app/global-error.tsx` via `posthog.captureException()`.

**User identification** is called on email sign-in and sign-up using the user's email as the distinct ID.

## Next steps

We've built a dashboard and five insights to keep an eye on user behavior:

- **Dashboard:** [Analytics basics](https://us.posthog.com/project/387434/dashboard/1482919)
- **Signup → Subscription Funnel:** [iHeFQhQ4](https://us.posthog.com/project/387434/insights/iHeFQhQ4)
- **Carousel Generations Over Time:** [VYeE81OH](https://us.posthog.com/project/387434/insights/VYeE81OH)
- **New Subscriptions vs Cancellations:** [1PgXEsPY](https://us.posthog.com/project/387434/insights/1PgXEsPY)
- **Login Method Breakdown:** [qBLVYnBJ](https://us.posthog.com/project/387434/insights/qBLVYnBJ)
- **Carousel Export Rate:** [wED2Q9NR](https://us.posthog.com/project/387434/insights/wED2Q9NR)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
