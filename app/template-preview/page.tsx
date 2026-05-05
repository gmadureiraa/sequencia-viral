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
  "madureira",
];

type SearchParams = Promise<{
  id?: string;
  full?: string;
  style?: string;
  brief?: string;
}>;

export default async function TemplatePreviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { id, full, style, brief } = await searchParams;
  const initial: TemplateId = VALID_IDS.includes(id as TemplateId)
    ? (id as TemplateId)
    : "paper-mono";
  const initialFull = full === "1" || full === "true";
  const initialDark = style === "dark";
  const briefNum = Number(brief);
  const initialBrief =
    briefNum === 1 || briefNum === 2 || briefNum === 3
      ? (briefNum as 1 | 2 | 3)
      : null;
  return (
    <TemplatePreviewClient
      initial={initial}
      initialFull={initialFull}
      initialDark={initialDark}
      initialBrief={initialBrief}
    />
  );
}
