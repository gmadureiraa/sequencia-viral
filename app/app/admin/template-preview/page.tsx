/**
 * MOVED to /template-preview (public, no auth gate).
 * Esta rota antiga ficou só como redirect pra não quebrar bookmarks.
 */
import { redirect } from "next/navigation";

export default function MovedPage() {
  redirect("/template-preview");
}
