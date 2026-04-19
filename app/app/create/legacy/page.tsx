// Redirect tratado em `next.config.ts` → redirects().
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function Page(): never {
  redirect("/app/create/new");
}
