// Redirect tratado em `next.config.ts` → redirects(). Esse arquivo fica só
// como fallback. `dynamic = "force-dynamic"` impede prerender estático
// (que estava fazendo o Vercel Edge servir HTML da V1 antiga em cache).
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function Page(): never {
  redirect("/app/create/new");
}
