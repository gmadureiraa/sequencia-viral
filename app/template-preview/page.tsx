import type { TemplateId } from "@/components/app/templates/types";
import TemplatePreviewClient from "./client";

export const dynamic = "force-dynamic";

const VALID_IDS: TemplateId[] = [
  "manifesto",
  "futurista",
  "autoral",
  "twitter",
  "ambitious",
  "blank",
  "bohdan",
  "paper-mono",
];

type SearchParams = Promise<{ id?: string }>;

export default async function TemplatePreviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { id } = await searchParams;
  const initial: TemplateId = VALID_IDS.includes(id as TemplateId)
    ? (id as TemplateId)
    : "paper-mono";
  return <TemplatePreviewClient initial={initial} />;
}
