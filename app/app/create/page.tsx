// Redirect tratado em `next.config.ts` → redirects(). Esse arquivo fica só
// pra impedir que o Next.js gere um 404 se alguma build gerar prerender.
// `dynamic = "force-dynamic"` impede prerender estático.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function Page(): never {
  redirect("/app/create/new");
}
