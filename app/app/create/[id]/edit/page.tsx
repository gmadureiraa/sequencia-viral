"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  TEMPLATES_META,
  TemplateRenderer,
  type TemplateId,
} from "@/components/app/templates";
import { useAuth } from "@/lib/auth-context";
import { useDraft, useAutoSaveDraft, useSaveDraft } from "@/lib/create/use-draft";
import { useImages } from "@/lib/create/use-images";
// CarouselFeedbackPanel removido — agora so aparece em /app/create/[id]/preview.
import { DiscountPopup } from "@/components/app/discount-popup";
import { ImagePicker } from "@/components/app/image-picker";
import { supabase } from "@/lib/supabase";
import type {
  CreateSlide,
  SlideLayers,
  SlideVariant,
} from "@/lib/create/types";

/**
 * Tela 03 — Editor. 3 colunas (variantes/layers · canvas · branding) no
 * desktop; vira tabs no mobile. Canvas central usa `<TemplateRenderer>`
 * com o templateId escolhido. Auto-save 1200ms (debounced).
 */

/**
 * Google Fonts necessários pras opções de fonte display do editor.
 * Carregamos via `<link>` injetado em document.head na montagem do editor —
 * evita pesar a landing e o shell global.
 */
const DISPLAY_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@900&family=Archivo+Black&family=Bebas+Neue&family=Anton&family=Oswald:wght@500;700&family=Barlow+Condensed:wght@600;700;800&family=Instrument+Serif:ital@0;1&display=swap";

function useInjectDisplayFonts() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "sv-create-display-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = DISPLAY_FONTS_HREF;
    document.head.appendChild(link);
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect";
    pre1.href = "https://fonts.googleapis.com";
    document.head.appendChild(pre1);
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    document.head.appendChild(pre2);
  }, []);
}

const VARIANT_OPTS: { id: SlideVariant; label: string; ic: React.ReactNode }[] = [
  {
    id: "cover",
    label: "Capa",
    ic: <span style={{ width: 22, height: 22, background: "var(--sv-ink)", border: "1.5px solid var(--sv-ink)" }} />,
  },
  {
    id: "solid-brand",
    label: "Cor da marca",
    ic: <span style={{ width: 22, height: 22, background: "var(--sv-green)", border: "1.5px solid var(--sv-ink)" }} />,
  },
  {
    id: "full-photo-bottom",
    label: "Foto cheia",
    ic: (
      <span
        style={{
          width: 22,
          height: 22,
          background: "linear-gradient(var(--sv-paper) 55%, var(--sv-ink) 55%)",
          border: "1.5px solid var(--sv-ink)",
        }}
      />
    ),
  },
  {
    id: "text-only",
    label: "Só texto",
    ic: (
      <span
        style={{
          width: 22,
          height: 22,
          background: "var(--sv-ink)",
          borderTop: "3px solid var(--sv-paper)",
          borderBottom: "3px solid var(--sv-paper)",
        }}
      />
    ),
  },
  {
    id: "cta",
    label: "CTA",
    ic: (
      <span
        style={{
          width: 22,
          height: 22,
          background: "var(--sv-ink)",
          borderLeft: "4px solid var(--sv-green)",
          border: "1.5px solid var(--sv-ink)",
        }}
      />
    ),
  },
];

const ACCENT_SWATCHES_DEFAULT = [
  "#7CF067",
  "#D262B2",
  "#FF4A1C",
  "#F5C518",
  "#2B5FFF",
  "#0A0A0A",
];

// Opções de fonte display. `family` é a string CSS completa pra passar em
// `displayFontOverride`. `id` bate com o persistido em `style.display_font`.
// `atelier` = default do Manifesto (editorial). As 4 outras vêm do Google
// Fonts (ver <link> em `app/app/layout.tsx`).
// Fontes display do editor — priorizam caixa alta/condensada pra título
// cinematográfico editorial. Atelier (Kaleidos) foi removida.
// Default novo do Futurista: Inter 900 (curvas humanistas, bate com
// referência BrandsDecoded).
const FONT_OPTS = [
  {
    id: "inter-black",
    label: "Inter Black",
    family: '"Inter", system-ui, sans-serif',
    italic: false,
    uppercase: true,
  },
  {
    id: "archivo",
    label: "Archivo Black",
    family: '"Archivo Black", system-ui, sans-serif',
    italic: false,
    uppercase: true,
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    family: '"Bebas Neue", system-ui, sans-serif',
    italic: false,
    uppercase: true,
  },
  {
    id: "anton",
    label: "Anton",
    family: '"Anton", system-ui, sans-serif',
    italic: false,
    uppercase: true,
  },
  {
    id: "oswald",
    label: "Oswald",
    family: '"Oswald", system-ui, sans-serif',
    italic: false,
    uppercase: true,
  },
  {
    id: "barlow",
    label: "Barlow Condensed",
    family: '"Barlow Condensed", system-ui, sans-serif',
    italic: false,
    uppercase: true,
  },
  {
    id: "serif",
    label: "Serif",
    family: '"Instrument Serif", Georgia, serif',
    italic: true,
    uppercase: false,
  },
];

function familyFromFontId(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return FONT_OPTS.find((f) => f.id === id)?.family;
}
function fontIdFromFamily(family: string | undefined): string {
  if (!family) return "inter-black";
  return FONT_OPTS.find((f) => f.family === family)?.id ?? "inter-black";
}

function buildPreviewProfile(profile: {
  name: string;
  twitter_handle?: string;
  instagram_handle?: string;
  avatar_url?: string;
} | null) {
  if (!profile) return { name: "Seu nome", handle: "@seuhandle", photoUrl: "" };
  const handle = profile.twitter_handle
    ? `@${profile.twitter_handle}`
    : profile.instagram_handle
      ? `@${profile.instagram_handle}`
      : "@seuhandle";
  return {
    name: profile.name || "Seu nome",
    handle,
    photoUrl: profile.avatar_url || "",
  };
}

/**
 * Decide cor de texto contrastante pra um thumb com `bgColor` custom.
 * Calcula luminância perceptual (ITU BT.601) do hex.
 */
function pickThumbFg(hex: string): string {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return "var(--sv-ink)";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const l = (r * 299 + g * 587 + b * 114) / 1000;
  return l > 140 ? "var(--sv-ink)" : "var(--sv-paper)";
}

type MobileTab = "sidebar" | "canvas";

/** Swatches do painel "Background". Aplicados por-slide via `slide.bgColor`. */
const BG_SWATCHES = [
  "#0A0A0A",
  "#7CF067",
  "#D262B2",
  "#FFFFFF",
  "#0B0F1E",
];

const DEFAULT_LAYERS: SlideLayers = { title: true, body: true, bg: true };

/** Admin emails pra gate do painel Debug IA. */
const ADMIN_EMAILS = ["gf.madureiraa@gmail.com", "gf.madureira@hotmail.com"];

/** "+ Adicionar camada" — opções que vão aparecer no menu (stubs por enquanto). */
const EXTRA_LAYER_OPTIONS = [
  { id: "quote", label: "Citação em destaque" },
  { id: "badge", label: "Selo numerado" },
  { id: "kicker", label: "Tag kicker" },
] as const;

export default function EditPage(props: {
  params: Promise<{ id: string }>;
}) {
  useInjectDisplayFonts();
  const { id } = use(props.params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, session } = useAuth();
  const { draft, loading, error } = useDraft(id);

  // Ref do textarea do corpo pra aplicar negrito no range selecionado.
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Guarda o último range de seleção antes do textarea perder foco (o click
  // no botão B dispara blur antes do click, o que zerava selectionStart/End).
  const lastBodySelectionRef = useRef<{ start: number; end: number } | null>(null);

  // Query customizada pra busca/geração de imagem (quando preenchida,
  // sobrescreve o imageQuery padrão do slide).
  const [customImageQuery, setCustomImageQuery] = useState("");
  // Image picker modal: abre grid do Google Images pra o user escolher.
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const imagesHook = useImages(session);

  // Paleta de cores de destaque: prioriza cores da marca (definidas em
  // /app/settings?tab=branding) + defaults como fallback. Dedupes case-insens.
  const accentSwatches = useMemo(() => {
    const brand = Array.isArray(profile?.brand_colors)
      ? profile!.brand_colors!.filter(
          (c): c is string => typeof c === "string" && c.trim().length > 0
        )
      : [];
    const merged = [...brand, ...ACCENT_SWATCHES_DEFAULT];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of merged) {
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
      if (out.length >= 12) break;
    }
    return out;
  }, [profile?.brand_colors]);

  const initialTemplate = (searchParams.get("template") as TemplateId | null) ?? null;

  // Estado local do editor — hidratado a partir do draft no useEffect abaixo.
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<CreateSlide[]>([]);
  const [slideStyle, setSlideStyle] = useState<"white" | "dark">("white");
  const [templateId, setTemplateId] = useState<TemplateId>(
    initialTemplate ?? "manifesto"
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [kicker, setKicker] = useState("");
  const [handle, setHandle] = useState("@seuhandle");
  const [fontId, setFontId] = useState<string>("inter-black");
  const [accent, setAccent] = useState<string>("#7CF067");
  const [textScale, setTextScale] = useState(1);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  // Flag pra saber se o usuário já mexeu no accent/font/scale (pra não
  // forçar overrides quando o draft nem tem nada salvo — deixa o template
  // usar a cor/fonte default dele).
  const [accentTouched, setAccentTouched] = useState(false);
  const [fontTouched, setFontTouched] = useState(false);
  const [scaleTouched, setScaleTouched] = useState(false);

  // Drag-and-drop para reordenar thumbs.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Menu "+ Adicionar" (camada extra) — só UI estub.
  const [addLayerOpen, setAddLayerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Usamos um input de upload separado por slide (via indexRef) — armazenamos
  // o slide alvo pra reutilizar o mesmo file input oculto.
  const uploadTargetRef = useRef<number | null>(null);

  // Hidrata do draft quando carrega.
  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setSlides(draft.slides.length ? draft.slides : []);
    setSlideStyle(draft.style === "dark" ? "dark" : "white");
    if (!initialTemplate && draft.visualTemplate) {
      setTemplateId(draft.visualTemplate);
    }
    // Hidrata overrides persistidos (accent/font/text scale).
    // Prioridade pro accent: draft.accentOverride (salvo) → profile.brand_colors[0]
    // (cor da marca do user) → default #7CF067. Sem o fallback da marca, template
    // Futurista usava sempre ACCENT_DEFAULT laranja mesmo quando user escolheu verde.
    if (draft.accentOverride) {
      setAccent(draft.accentOverride);
      setAccentTouched(true);
    } else if (
      Array.isArray(profile?.brand_colors) &&
      profile!.brand_colors!.length > 0 &&
      typeof profile!.brand_colors![0] === "string"
    ) {
      setAccent(profile!.brand_colors![0]);
      setAccentTouched(true); // passa pro TemplateRenderer como accentOverride
    }
    if (draft.displayFont) {
      setFontId(fontIdFromFamily(draft.displayFont));
      setFontTouched(true);
    }
    if (typeof draft.textScale === "number") {
      setTextScale(draft.textScale);
      setScaleTouched(true);
    }
    if (profile) {
      setKicker(profile.name || "Seu nome");
      setHandle(
        profile.twitter_handle
          ? `@${profile.twitter_handle}`
          : profile.instagram_handle
            ? `@${profile.instagram_handle}`
            : "@seuhandle"
      );
    }
  }, [draft, initialTemplate, profile]);

  const previewProfile = useMemo(
    () => ({
      name: kicker || "Seu nome",
      handle: handle || "@seuhandle",
      photoUrl: profile?.avatar_url || "",
    }),
    [kicker, handle, profile?.avatar_url]
  );

  // ─── Auto-fill de imagens faltantes ───────────────────────────────
  // Todo slide deve ter imagem (evita espaco vazio). Quando slides hidratam
  // do draft, detecta os sem imageUrl e dispara fetch usando o IMAGE DECIDER
  // (agente Gemini Flash 2.5 que decide slide a slide):
  //   - Entidade nomeada (Anthropic, Satoshi, Tesla) → mode="search" via Serper
  //   - Conceito abstrato / metáfora → mode="generate" com StructuredImagePrompt
  //     cinematográfico (Gemini Flash Image / Imagen fallback)
  //   - Capa (slide 0) → sempre generate (forçado pelo decider pro max drama)
  // Roda continuamente ate TODOS os slides terem imageUrl. Com retry ilimitado
  // (backoff exponencial) em falhas — garantia de 100% fiel no export.
  const autoFillStartedRef = useRef<string | null>(null);
  const [imagesPending, setImagesPending] = useState<number>(0);
  useEffect(() => {
    if (!draft?.id) return;
    if (!slides.length) return;
    if (autoFillStartedRef.current === draft.id) return;
    autoFillStartedRef.current = draft.id;

    async function fillMissing() {
      const concurrency = 2;
      const maxRetries = 4;
      let passIndex = 0;
      // Multiplos passes: enquanto ainda ha slides sem imagem, tenta de novo
      // com backoff. Se depois de N passes ainda falhar, marca imageFailed=true
      // pra UX do editor mostrar card "Gerar de novo" claramente.
      while (passIndex < maxRetries) {
        // Snapshot dos indices que ainda precisam
        const missing: number[] = [];
        for (let i = 0; i < slides.length; i++) {
          if (!slides[i]?.imageUrl) missing.push(i);
        }
        setImagesPending(missing.length);
        if (missing.length === 0) break;

        if (passIndex > 0) {
          // Backoff entre passes: 3s, 6s, 9s
          await new Promise((r) => setTimeout(r, 3000 * passIndex));
        }

        let nextIdx = 0;
        async function worker() {
          while (true) {
            const slot = nextIdx++;
            if (slot >= missing.length) return;
            const i = missing[slot];
            const s = slides[i];
            if (!s || s.imageUrl) continue;
            const baseQuery =
              (s.imageQuery && s.imageQuery.trim()) ||
              (s.heading && s.heading.trim()) ||
              title;
            if (!baseQuery) continue;
            const isCover = i === 0 && templateId !== "twitter";
            // Decider define mode internamente no backend — passamos
            // "generate" como hint (será sobrescrito pelo decider).
            try {
              const res = await imagesHook.refetchImage(i, {
                query: baseQuery,
                contextHeading: s.heading,
                contextBody: s.body,
                mode: "generate",
                designTemplate: templateId,
                isCover,
                useDecider: true,
                slideNumber: i + 1,
                totalSlides: slides.length,
              });
              const urlToApply =
                res.appliedUrl ??
                (res.options && res.options.length > 0 ? res.options[0] : null);
              if (urlToApply) {
                updateSlide(i, { imageUrl: urlToApply, imageFailed: false });
              } else {
                console.warn(
                  `[auto-fill pass ${passIndex + 1}] slide ${i + 1} sem imagem aplicada`
                );
              }
            } catch (err) {
              console.warn(
                `[auto-fill pass ${passIndex + 1}] slide ${i + 1} falhou:`,
                err
              );
            }
            // Pequeno delay entre slides pra nao estourar rate limit
            await new Promise((r) => setTimeout(r, 300));
          }
        }
        await Promise.all(
          Array.from({ length: concurrency }).map(() => worker())
        );
        passIndex++;
      }
      // Update final do pending (apos todos os passes).
      // Slides que ainda nao tem imagem viram imageFailed=true pro card de
      // erro aparecer em vez de placeholder vazio.
      setSlides((prev) => {
        const next = prev.map((s) =>
          !s?.imageUrl ? { ...s, imageFailed: true } : s
        );
        return next;
      });
      const finalMissing = slides.filter((s) => !s?.imageUrl).length;
      setImagesPending(finalMissing);
    }
    void fillMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, slides.length]);

  // Re-calcula imagesPending toda vez que slides muda. Source de verdade pro
  // botão Preview — se algum slide ainda nao tem imagem, bloqueia export.
  useEffect(() => {
    if (!slides.length) {
      setImagesPending(0);
      return;
    }
    const missing = slides.filter((s) => !s?.imageUrl).length;
    setImagesPending(missing);
  }, [slides]);

  // Auto-save debounced. Só envia accent/font/scale se o usuário mexeu —
  // evita sobrescrever com defaults toda vez que o draft hidratar.
  useAutoSaveDraft({
    userId: user?.id ?? null,
    id,
    slides,
    title,
    slideStyle,
    visualTemplate: templateId,
    accentOverride: accentTouched ? accent : undefined,
    displayFont: fontTouched ? familyFromFontId(fontId) : undefined,
    textScale: scaleTouched ? textScale : undefined,
    enabled: slides.length > 0,
  });

  // Transição Editor → Preview: ESTRATEGIA DUPLA pra garantir fidelidade 100%:
  //   1. Flush sincrono do draft no server (preview → fetchUserCarousel pega fresh)
  //   2. ADICIONAL: passa snapshot EXATO dos slides via sessionStorage como
  //      override. Preview page le esse snapshot primeiro — se existir, renderiza
  //      dele direto. Bypass de qualquer race condition do DB.
  //
  // Bug reportado 2026-04-22: mesmo com flush, download vinha diferente do
  // editor. Por via das duvidas, sessionStorage e'a ponte direta.
  const { saveNow: flushDraft } = useSaveDraft(user?.id ?? null, null);
  const [flushingToPreview, setFlushingToPreview] = useState(false);
  async function goToPreview() {
    if (!id) return;
    setFlushingToPreview(true);

    // Snapshot EXATO do estado atual do editor — preview page usa como
    // override em vez de depender do DB.
    const snapshot = {
      draftId: id,
      title,
      slides,
      slideStyle,
      visualTemplate: templateId,
      accentOverride: accentTouched ? accent : undefined,
      displayFont: fontTouched ? familyFromFontId(fontId) : undefined,
      textScale: scaleTouched ? textScale : undefined,
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(
        `sv_preview_snapshot_${id}`,
        JSON.stringify(snapshot)
      );
    } catch {
      /* quota cheia — ignora, preview vai usar DB */
    }

    try {
      await flushDraft(id, {
        title,
        slides,
        slideStyle,
        status: "draft",
        visualTemplate: templateId,
        accentOverride: accentTouched ? accent : undefined,
        displayFont: fontTouched ? familyFromFontId(fontId) : undefined,
        textScale: scaleTouched ? textScale : undefined,
      });
    } catch (err) {
      console.warn("[edit] flush before preview falhou:", err);
    }
    router.push(`/app/create/${id}/preview`);
  }

  function updateSlide(index: number, patch: Partial<CreateSlide>) {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  /**
   * Envolve a seleção atual do textarea body com `**...**`. Se não houver
   * seleção, insere `****` e posiciona o cursor entre os asteriscos.
   * Também reverte se a seleção já está wrappada.
   */
  function applyBoldToBody() {
    const ta = bodyTextareaRef.current;
    if (!ta || !active) return;
    // Se o textarea não está focado (ex: usuário clicou no botão B, o que
    // dispara blur antes do click), recupera a última seleção salva em
    // `onSelect`/`onBlur`. Sem isso, selectionStart/End ficam no final do
    // texto e acabamos inserindo `****` no fim — bug relatado.
    const isFocused = document.activeElement === ta;
    const saved = lastBodySelectionRef.current;
    const start = isFocused ? ta.selectionStart : saved?.start ?? ta.selectionStart;
    const end = isFocused ? ta.selectionEnd : saved?.end ?? ta.selectionEnd;
    const value = active.body ?? "";
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);

    // Se a seleção já está envolta por **, remove.
    if (
      selected.startsWith("**") &&
      selected.endsWith("**") &&
      selected.length >= 4
    ) {
      const inner = selected.slice(2, -2);
      const next = before + inner + after;
      updateSlide(activeIndex, { body: next });
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + inner.length);
      });
      return;
    }

    // Sem seleção: insere "****" e coloca cursor no meio.
    if (start === end) {
      const next = before + "****" + after;
      updateSlide(activeIndex, { body: next });
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + 2, start + 2);
      });
      return;
    }

    // Com seleção: envolve.
    const wrapped = `**${selected}**`;
    const next = before + wrapped + after;
    updateSlide(activeIndex, { body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + wrapped.length);
    });
  }

  /** Toggle binário de uma camada específica do slide ativo. */
  function toggleLayer(key: keyof SlideLayers) {
    const slide = slides[activeIndex];
    if (!slide) return;
    const current = slide.layers ?? DEFAULT_LAYERS;
    updateSlide(activeIndex, {
      layers: { ...current, [key]: !current[key] },
    });
  }

  // Drag-and-drop nos thumbs (HTML5 nativo).
  function handleDragStart(index: number) {
    setDragIndex(index);
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  }
  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    // Ajusta activeIndex pra continuar apontando pro mesmo slide.
    setActiveIndex((prevActive) => {
      if (prevActive === dragIndex) return targetIndex;
      if (dragIndex < prevActive && targetIndex >= prevActive) return prevActive - 1;
      if (dragIndex > prevActive && targetIndex <= prevActive) return prevActive + 1;
      return prevActive;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }
  /** Reordenar via setinhas (mobile fallback). */
  function moveSlide(fromIdx: number, dir: -1 | 1) {
    const to = fromIdx + dir;
    if (to < 0 || to >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setActiveIndex((prev) => {
      if (prev === fromIdx) return to;
      if (prev === to) return fromIdx;
      return prev;
    });
  }

  function addSlide(afterIndex: number) {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, {
        heading: "Novo slide",
        body: "Adicione o texto deste slide.",
        imageQuery: "placeholder",
        variant: "headline",
      });
      return next;
    });
    setActiveIndex(afterIndex + 1);
  }

  async function handleUploadImage(file: File, targetIndex: number) {
    if (!file) return;
    const url = await imagesHook.uploadImage(targetIndex, file, id);
    if (url) {
      updateSlide(targetIndex, { imageUrl: url, imageFailed: false });
      toast.success("Imagem carregada.");
    } else if (imagesHook.error) {
      toast.error(imagesHook.error);
    }
  }

  /**
   * Prioridade da query pra busca/geração de imagem:
   * 1. campo custom preenchido pelo usuário (override explícito)
   * 2. imageQuery do slide (vem do Gemini, em inglês)
   * 3. heading do slide
   * 4. body do slide (truncado)
   * 5. título do carrossel
   */
  function resolveImageQuery(s: CreateSlide): string {
    const custom = customImageQuery.trim();
    if (custom) return custom;
    const iq = s.imageQuery?.trim();
    if (iq) return iq;
    const h = s.heading?.trim();
    if (h) return h;
    const b = s.body?.trim().slice(0, 60);
    if (b) return b;
    return title.trim();
  }

  async function handleSearchImage(targetIndex: number) {
    const s = slides[targetIndex];
    if (!s) return;
    const query =
      (s.imageQuery && s.imageQuery.trim()) ||
      (s.heading && s.heading.trim()) ||
      (s.body && s.body.trim().slice(0, 60)) ||
      title;
    const finalQuery = customImageQuery.trim() || query;
    if (!finalQuery) {
      toast.error("Escreva uma descrição ou um título antes de buscar.");
      return;
    }
    try {
      const res = await imagesHook.refetchImage(targetIndex, {
        query: finalQuery,
        contextHeading: s.heading,
        contextBody: s.body,
        mode: "search",
        designTemplate: templateId,
      });
      if (res.appliedUrl)
        updateSlide(targetIndex, { imageUrl: res.appliedUrl, imageFailed: false });
    } catch {
      if (imagesHook.error) toast.error(imagesHook.error);
    }
  }

  async function handleGenerateImage(targetIndex: number) {
    const s = slides[targetIndex];
    if (!s) return;
    const query =
      (s.imageQuery && s.imageQuery.trim()) ||
      (s.heading && s.heading.trim()) ||
      title;
    const finalQuery = customImageQuery.trim() || query;
    if (!finalQuery) {
      toast.error("Escreva uma descrição ou um título antes de gerar.");
      return;
    }
    try {
      const res = await imagesHook.refetchImage(targetIndex, {
        query: finalQuery,
        contextHeading: s.heading,
        contextBody: s.body,
        mode: "generate",
        designTemplate: templateId,
      });
      if (res.appliedUrl) {
        updateSlide(targetIndex, {
          imageUrl: res.appliedUrl,
          imageFailed: false,
        });
        toast.success("Imagem gerada.");
      }
    } catch {
      if (imagesHook.error) toast.error(imagesHook.error);
    }
  }

  /**
   * Regenera a CAPA com pipeline 2-pass (Gemini planeja cena → Flash Image
   * Nano Banana, fallback Imagen 4 se Flash Image falhar).
   * Só faz sentido no slide 0 e quando templateId !== "twitter". Demora
   * ~45s — toast avisa.
   */
  async function handleRegenCover() {
    const s = slides[0];
    if (!s) return;
    const query =
      (s.heading && s.heading.trim()) ||
      (s.imageQuery && s.imageQuery.trim()) ||
      title;
    if (!query) {
      toast.error("A capa precisa de um título antes de gerar.");
      return;
    }
    toast.info("Gerando capa cinematográfica (~45s). IA planeja a cena e renderiza.");
    try {
      const res = await imagesHook.refetchImage(0, {
        query,
        contextHeading: s.heading,
        contextBody: s.body,
        mode: "generate",
        designTemplate: templateId,
        isCover: true,
        useDecider: true,
        slideNumber: 1,
        totalSlides: slides.length,
      });
      if (res.appliedUrl) {
        updateSlide(0, { imageUrl: res.appliedUrl, imageFailed: false });
        toast.success("Nova capa pronta.");
      }
    } catch {
      if (imagesHook.error) toast.error(imagesHook.error);
    }
  }

  function handleRemoveImage(targetIndex: number) {
    updateSlide(targetIndex, { imageUrl: "" });
    toast("Imagem removida do slide.");
  }

  function triggerUploadFor(targetIndex: number) {
    uploadTargetRef.current = targetIndex;
    fileInputRef.current?.click();
  }

  // Galeria e picker-via-hook foram depreciados em favor do <ImagePicker>
  // (modal com Google Images). Mantive só o caller do ImagePicker via
  // setPickerFor(targetIndex) acima.

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Carregando rascunho...
        </p>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "var(--sv-ink)" }}>{error ?? "Rascunho não encontrado."}</p>
      </div>
    );
  }

  const active = slides[activeIndex];
  const selectedMeta = TEMPLATES_META.find((m) => m.id === templateId);

  // Twitter template tem UM UNICO layout (sem variantes). Ocultar o picker
  // evita user clicar e ver mudanca zero no canvas.
  const supportsVariants = templateId !== "twitter";

  const VariantsCol = (
    <div className="flex flex-col gap-4">
      {supportsVariants && (
        <>
          <h4
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
              fontWeight: 700,
            }}
          >
            Variante do slide
          </h4>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            {VARIANT_OPTS.map((v) => {
              const on = active?.variant === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() =>
                    active && updateSlide(activeIndex, { variant: v.id })
                  }
                  style={{
                    padding: "10px 4px",
                    border: "1.5px solid var(--sv-ink)",
                    background: on ? "var(--sv-green)" : "var(--sv-white)",
                    cursor: "pointer",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 8.5,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--sv-ink)",
                  }}
                >
                  {v.ic}
                  {v.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginTop: 10,
        }}
      >
        Camadas
      </h4>
      <div className="flex flex-col gap-1">
        {(
          [
            { id: "title", label: "Título" },
            { id: "body", label: "Corpo" },
            { id: "bg", label: "Fundo" },
          ] as { id: keyof SlideLayers; label: string }[]
        ).map((layer) => {
          const layers = active?.layers ?? DEFAULT_LAYERS;
          const on = layers[layer.id];
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => toggleLayer(layer.id)}
              style={{
                padding: "8px 10px",
                border: "1.5px solid var(--sv-ink)",
                background: on ? "var(--sv-white)" : "var(--sv-soft)",
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: on ? "var(--sv-ink)" : "var(--sv-muted)",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textDecoration: on ? "none" : "line-through",
                fontWeight: 700,
              }}
              aria-pressed={on}
            >
              <span>{layer.label}</span>
              <span
                style={{
                  fontSize: 8,
                  color: on ? "var(--sv-green, #7CF067)" : "var(--sv-muted)",
                }}
              >
                {on ? "ON" : "OFF"}
              </span>
            </button>
          );
        })}

        {/* "+ Adicionar" — menu dropdown com camadas extras (stubs). */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setAddLayerOpen((v) => !v)}
            style={{
              padding: "8px 10px",
              border: "1.5px dashed var(--sv-ink)",
              background: addLayerOpen ? "var(--sv-green)" : "var(--sv-white)",
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--sv-ink)",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              fontWeight: 700,
            }}
          >
            + Adicionar
          </button>
          {addLayerOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                zIndex: 10,
                border: "1.5px solid var(--sv-ink)",
                background: "var(--sv-white)",
                boxShadow: "3px 3px 0 0 var(--sv-ink)",
              }}
            >
              {EXTRA_LAYER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    toast("Em breve: " + opt.label);
                    setAddLayerOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 10px",
                    border: "none",
                    background: "transparent",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--sv-ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px dashed var(--sv-ink)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginTop: 10,
        }}
      >
        Background
      </h4>
      <div className="flex gap-1.5 flex-wrap items-center">
        {BG_SWATCHES.map((color) => {
          const selected = active?.bgColor === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => updateSlide(activeIndex, { bgColor: color })}
              style={{
                width: 26,
                height: 26,
                background: color,
                border: "1.5px solid var(--sv-ink)",
                cursor: "pointer",
                boxShadow: selected
                  ? "0 0 0 2px var(--sv-paper) inset, 0 0 0 4px var(--sv-ink)"
                  : "none",
              }}
              aria-label={`Background ${color}`}
              aria-pressed={selected}
            />
          );
        })}
        {active?.bgColor && (
          <button
            type="button"
            onClick={() => updateSlide(activeIndex, { bgColor: undefined })}
            style={{
              padding: "5px 8px",
              border: "1.5px dashed var(--sv-ink)",
              background: "var(--sv-white)",
              cursor: "pointer",
              fontFamily: "var(--sv-mono)",
              fontSize: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--sv-ink)",
              fontWeight: 700,
            }}
            aria-label="Remover cor custom do slide"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );

  const CanvasCol = (
    <div
      className="flex flex-col items-center gap-4"
      style={{ padding: "18px 14px", background: "var(--sv-soft)", minHeight: 480, minWidth: 0 }}
    >
      {active && (
        <div
          style={{
            boxShadow: "5px 5px 0 0 var(--sv-ink)",
            border: "1.5px solid var(--sv-ink)",
          }}
        >
          <TemplateRenderer
            templateId={templateId}
            heading={active.heading}
            body={active.body}
            imageUrl={active.imageUrl}
            slideNumber={activeIndex + 1}
            totalSlides={slides.length}
            profile={previewProfile}
            style={slideStyle}
            showFooter={activeIndex === 0}
            scale={0.5}
            isLastSlide={activeIndex === slides.length - 1}
            accentOverride={accentTouched ? accent : undefined}
            displayFontOverride={
              fontTouched ? familyFromFontId(fontId) : undefined
            }
            textScale={scaleTouched ? textScale : undefined}
            variant={active.variant ?? "headline"}
            bgColor={active.bgColor}
            layers={active.layers ?? DEFAULT_LAYERS}
          />
        </div>
      )}

      {/* Inputs do slide ativo */}
      <div
        className="grid gap-2.5 w-full"
        style={{ maxWidth: 620, gridTemplateColumns: "1fr" }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontFamily: "var(--sv-mono)",
              fontSize: 8.5,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
              marginBottom: 4,
              fontWeight: 700,
            }}
          >
            Título do slide
          </label>
          <input
            type="text"
            value={active?.heading ?? ""}
            onChange={(e) => updateSlide(activeIndex, { heading: e.target.value })}
            className="sv-input"
            style={{ width: "100%", fontFamily: "var(--sv-display)", fontSize: 15, padding: "8px 10px" }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 8.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
                fontWeight: 700,
              }}
            >
              Corpo
            </label>
            <button
              type="button"
              onMouseDown={(e) => {
                // Evita blur do textarea — preservamos a seleção ativa pra
                // o click seguinte envolver o range correto com **...**.
                e.preventDefault();
              }}
              onClick={applyBoldToBody}
              title="Negrito (⌘B) — selecione um trecho e clique"
              aria-label="Aplicar negrito"
              style={{
                width: 26,
                height: 22,
                fontFamily: "var(--sv-sans)",
                fontWeight: 900,
                fontSize: 12,
                color: "var(--sv-ink)",
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                cursor: "pointer",
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              B
            </button>
          </div>
          <textarea
            ref={bodyTextareaRef}
            value={active?.body ?? ""}
            onChange={(e) => updateSlide(activeIndex, { body: e.target.value })}
            onSelect={(e) => {
              const t = e.currentTarget;
              lastBodySelectionRef.current = {
                start: t.selectionStart,
                end: t.selectionEnd,
              };
            }}
            onBlur={(e) => {
              const t = e.currentTarget;
              lastBodySelectionRef.current = {
                start: t.selectionStart,
                end: t.selectionEnd,
              };
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
                e.preventDefault();
                applyBoldToBody();
              }
            }}
            className="sv-input"
            style={{ width: "100%", minHeight: 72, fontSize: 12.5, padding: "8px 10px" }}
          />
        </div>
      </div>

      {/* Thumbs horizontais com drag-and-drop */}
      <div
        className="flex gap-2 overflow-x-auto py-1"
        style={{ width: "100%", maxWidth: 620 }}
      >
        {slides.map((s, i) => {
          const on = i === activeIndex;
          const dragging = dragIndex === i;
          const targeted = dragOverIndex === i && dragIndex !== null && dragIndex !== i;
          // Thumb agora renderiza o TEMPLATE REAL em scale minúscula (0.06 ≈
          // 65×81px). Antes era caixa colorida simulada com texto —
          // Gabriel reportou que não representava o slide de verdade.
          return (
            <div
              key={i}
              style={{
                position: "relative",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                type="button"
                draggable
                onClick={() => setActiveIndex(i)}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                style={{
                  flexShrink: 0,
                  border: targeted
                    ? "2px solid var(--sv-green, #7CF067)"
                    : on
                      ? "1.5px solid var(--sv-ink)"
                      : "1.5px solid var(--sv-ink)",
                  padding: 0,
                  cursor: dragging ? "grabbing" : "grab",
                  transition: "transform .12s, opacity .12s",
                  transform: on ? "translateY(-2px)" : "translateY(0)",
                  boxShadow: on ? "3px 3px 0 0 var(--sv-green)" : "none",
                  opacity: dragging ? 0.4 : 1,
                  background: "transparent",
                  lineHeight: 0,
                  position: "relative",
                }}
                aria-label={`Slide ${i + 1}. Arraste pra reordenar.`}
              >
                <TemplateRenderer
                  templateId={templateId}
                  heading={s.heading || ""}
                  body={s.body || ""}
                  imageUrl={s.imageUrl}
                  slideNumber={i + 1}
                  totalSlides={slides.length}
                  profile={previewProfile}
                  style={slideStyle}
                  scale={0.06}
                  showFooter={i === 0}
                  isLastSlide={i === slides.length - 1}
                  accentOverride={accentTouched ? accent : undefined}
                  displayFontOverride={
                    fontTouched ? familyFromFontId(fontId) : undefined
                  }
                  textScale={scaleTouched ? textScale : undefined}
                  variant={s.variant ?? "headline"}
                  bgColor={s.bgColor}
                  layers={s.layers ?? DEFAULT_LAYERS}
                />
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: 3,
                    padding: "1px 4px",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 7,
                    letterSpacing: "0.14em",
                    background: "rgba(10,10,10,0.75)",
                    color: "var(--sv-paper)",
                    borderRadius: 2,
                    pointerEvents: "none",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
              {/* Setinhas mobile: só aparecem se tiver mais de 1 slide */}
              {slides.length > 1 && (
                <div className="flex gap-1 lg:hidden">
                  <button
                    type="button"
                    onClick={() => moveSlide(i, -1)}
                    disabled={i === 0}
                    style={{
                      width: 18,
                      height: 18,
                      border: "1px solid var(--sv-ink)",
                      background: "var(--sv-white)",
                      fontSize: 10,
                      lineHeight: 1,
                      cursor: i === 0 ? "not-allowed" : "pointer",
                      opacity: i === 0 ? 0.3 : 1,
                    }}
                    aria-label="Mover slide pra esquerda"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(i, 1)}
                    disabled={i === slides.length - 1}
                    style={{
                      width: 18,
                      height: 18,
                      border: "1px solid var(--sv-ink)",
                      background: "var(--sv-white)",
                      fontSize: 10,
                      lineHeight: 1,
                      cursor: i === slides.length - 1 ? "not-allowed" : "pointer",
                      opacity: i === slides.length - 1 ? 0.3 : 1,
                    }}
                    aria-label="Mover slide pra direita"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => addSlide(slides.length - 1)}
          style={{
            flexShrink: 0,
            width: 64,
            aspectRatio: "4/5",
            border: "1.5px dashed var(--sv-ink)",
            background: "var(--sv-paper)",
            color: "var(--sv-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--sv-display)",
            fontSize: 24,
            fontStyle: "italic",
            cursor: "pointer",
          }}
          aria-label="Adicionar slide"
        >
          +
        </button>
      </div>
    </div>
  );

  const BrandingCol = (
    <div className="flex flex-col gap-4">
      {/*
        Branding (nome + handle + accent) nao editaveis aqui. Eles sao
        propriedades do BRAND do user (settings). Nem mostramos card de
        lock — ocupava espaco sem agregar. Editor so tem fonte + tamanho.
      */}

      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          fontWeight: 700,
        }}
      >
        Fonte display
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {FONT_OPTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFontId(f.id);
              setFontTouched(true);
            }}
            style={{
              padding: "7px 11px",
              border: "1.5px solid var(--sv-ink)",
              background: fontId === f.id ? "var(--sv-ink)" : "var(--sv-white)",
              color: fontId === f.id ? "var(--sv-paper)" : "var(--sv-ink)",
              cursor: "pointer",
              fontFamily: f.family,
              fontStyle: f.italic ? "italic" : "normal",
              fontWeight: 900,
              textTransform: "uppercase",
              fontSize: 11,
              lineHeight: 1,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cor de destaque removida — locked no brand color do user (settings). */}

      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginTop: 10,
        }}
      >
        Tamanho do texto
      </h4>
      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min={0.8}
          max={1.3}
          step={0.02}
          value={textScale}
          onChange={(e) => {
            setTextScale(parseFloat(e.target.value));
            setScaleTouched(true);
          }}
          style={{ flex: 1, accentColor: "var(--sv-ink)" }}
        />
        <span
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            fontWeight: 700,
            minWidth: 42,
            textAlign: "right",
          }}
        >
          {textScale.toFixed(2)}×
        </span>
      </div>

      <h4
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          fontWeight: 700,
          marginTop: 10,
        }}
      >
        Imagem do slide ativo
      </h4>

      {active?.imageUrl ? (
        <div
          style={{
            width: "100%",
            aspectRatio: "4/5",
            background: `url(${active.imageUrl}) center/cover`,
            border: "1.5px solid var(--sv-ink)",
          }}
          aria-label="Preview da imagem atual"
        />
      ) : active?.imageFailed ? (
        <div
          style={{
            width: "100%",
            aspectRatio: "4/5",
            background: "var(--sv-paper)",
            border: "1.5px solid var(--sv-pink, #D262B2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 16,
          }}
        >
          <div
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sv-pink, #D262B2)",
              fontWeight: 700,
            }}
          >
            ⚠ Imagem falhou
          </div>
          <div
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 11,
              color: "var(--sv-muted)",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            A geração automática não entregou. Tente novamente abaixo.
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateImage(activeIndex)}
            disabled={imagesHook.loadingIndex === activeIndex}
            className="sv-btn"
            style={{
              padding: "8px 14px",
              fontSize: 10,
              background: "var(--sv-green)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {imagesHook.loadingIndex === activeIndex
              ? "Gerando..."
              : "✦ Gerar de novo"}
          </button>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "4/5",
            background: "var(--sv-paper)",
            border: "1.5px dashed var(--sv-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Sem imagem
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const target = uploadTargetRef.current ?? activeIndex;
          if (file) void handleUploadImage(file, target);
          uploadTargetRef.current = null;
          e.target.value = "";
        }}
      />

      {/* Campo custom: sobrescreve o imageQuery do slide pro próximo
           Buscar/Gerar. Ideal pra refinar ("close-up de mãos digitando",
           "gráfico azul com tendência de alta"). Vazio = usa query padrão. */}
      <input
        type="text"
        value={customImageQuery}
        onChange={(e) => setCustomImageQuery(e.target.value)}
        placeholder="Descreva a imagem (opcional — em PT ou EN)"
        className="sv-input"
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 12,
          fontFamily: "var(--sv-sans)",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) void handleGenerateImage(activeIndex);
            else void handleSearchImage(activeIndex);
          }
        }}
      />
      <div
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 8.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
          marginTop: -2,
        }}
      >
        ⏎ busca · shift+⏎ gera IA
      </div>

      {/* Botão especial "Nova capa" — só no slide 0 do template editorial
          (pipeline 2-pass: cena planejada → Imagen). Destaque em verde. */}
      {activeIndex === 0 && templateId !== "twitter" && (
        <button
          type="button"
          onClick={() => void handleRegenCover()}
          disabled={imagesHook.loadingIndex === 0}
          className="sv-btn"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "10px 12px",
            fontSize: 10.5,
            background: "var(--sv-green)",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {imagesHook.loadingIndex === 0
            ? "Gerando capa (~45s)..."
            : "✦ Gerar nova capa"}
        </button>
      )}

      <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button
          type="button"
          onClick={() => setPickerFor(activeIndex)}
          disabled={imagesHook.loadingIndex === activeIndex}
          className="sv-btn sv-btn-outline"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "8px 10px",
            fontSize: 9.5,
          }}
          title="Abre grid de imagens do Google pra você clicar na que quiser"
        >
          🔍 Escolher
        </button>
        <button
          type="button"
          onClick={() => void handleGenerateImage(activeIndex)}
          disabled={imagesHook.loadingIndex === activeIndex}
          className="sv-btn sv-btn-outline"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "8px 10px",
            fontSize: 9.5,
          }}
        >
          {imagesHook.loadingIndex === activeIndex ? "..." : "Gerar IA"}
        </button>
        <button
          type="button"
          onClick={() => triggerUploadFor(activeIndex)}
          className="sv-btn sv-btn-outline"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "8px 10px",
            fontSize: 9.5,
          }}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => handleRemoveImage(activeIndex)}
          className="sv-btn sv-btn-outline"
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "8px 10px",
            fontSize: 9.5,
            color: "var(--sv-pink, #D262B2)",
          }}
        >
          Remover
        </button>
      </div>

      {/* Label 'Template: X' removido — ja existe botao 'Trocar template' no
          topo do editor, e o user sabe qual escolheu. */}
      {/* Feedback panel removido — moveu pra /app/create/[id]/preview. */}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      {/* Popup 30% off — usuário acabou de ver o primeiro carrossel pronto,
          momento perfeito pra oferta. Só dispara pra plano free, 1x. */}
      <DiscountPopup trigger="post-first-carousel" />

      {pickerFor !== null && (
        <ImagePicker
          initialQuery={(() => {
            const s = slides[pickerFor];
            return (
              customImageQuery.trim() ||
              (s?.imageQuery && s.imageQuery.trim()) ||
              (s?.heading && s.heading.trim()) ||
              title ||
              ""
            );
          })()}
          session={session}
          onPick={(url) => {
            updateSlide(pickerFor, { imageUrl: url, imageFailed: false });
            setPickerFor(null);
            toast.success("Imagem aplicada.");
          }}
          onClose={() => setPickerFor(null)}
        />
      )}

      {/* Topbar do editor */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 mb-5"
        style={{
          padding: "14px 16px",
          border: "1.5px solid var(--sv-ink)",
          background: "var(--sv-white)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Slide{" "}
          <strong style={{ color: "var(--sv-ink)" }}>
            {String(activeIndex + 1).padStart(2, "0")}
          </strong>{" "}
          / {String(slides.length).padStart(2, "0")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="sv-btn sv-btn-outline"
            style={{ padding: "7px 12px", fontSize: 9 }}
            onClick={() => toast("Desfazer ainda vem por aí")}
          >
            ⌘Z Desfazer
          </button>
          <button
            type="button"
            className="sv-btn sv-btn-outline"
            style={{ padding: "7px 12px", fontSize: 9 }}
            onClick={() => router.push(`/app/create/${id}/templates`)}
          >
            Trocar template
          </button>
          <button
            type="button"
            className="sv-btn sv-btn-primary"
            style={{
              padding: "7px 12px",
              fontSize: 9,
              opacity:
                flushingToPreview || imagesPending > 0 ? 0.5 : 1,
              cursor:
                flushingToPreview || imagesPending > 0
                  ? "wait"
                  : "pointer",
            }}
            disabled={flushingToPreview || imagesPending > 0}
            onClick={() => void goToPreview()}
            title={
              imagesPending > 0
                ? `Aguarde ${imagesPending} ${imagesPending === 1 ? "imagem" : "imagens"} carregar antes de exportar`
                : undefined
            }
          >
            {flushingToPreview
              ? "Salvando…"
              : imagesPending > 0
                ? `Carregando imagens (${slides.length - imagesPending}/${slides.length})…`
                : "Preview & Export →"}
          </button>
        </div>
      </div>

      {/* Mobile tabs: Sidebar (tudo) · Canvas */}
      <div className="lg:hidden mb-4 flex" style={{ border: "1.5px solid var(--sv-ink)", boxShadow: "2px 2px 0 0 var(--sv-ink)" }}>
        {(["sidebar", "canvas"] as MobileTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMobileTab(t)}
            style={{
              flex: 1,
              padding: "9px 12px",
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              background: mobileTab === t ? "var(--sv-ink)" : "var(--sv-white)",
              color: mobileTab === t ? "var(--sv-paper)" : "var(--sv-ink)",
              borderRight: t !== "canvas" ? "1.5px solid var(--sv-ink)" : "none",
            }}
          >
            {t === "sidebar" ? "Controles" : "Canvas"}
          </button>
        ))}
      </div>

      {/* Desktop 2 colunas — sidebar esquerda full (variantes + camadas +
          background + branding + fonte + accent + scale + imagem), canvas
          flex-1 no centro. Nada à direita. */}
      <div
        className="hidden lg:grid"
        style={{
          gridTemplateColumns: "240px minmax(0, 1fr)",
          gap: 0,
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "4px 4px 0 0 var(--sv-ink)",
          background: "var(--sv-white)",
          minWidth: 0,
        }}
      >
        <aside
          style={{
            padding: "16px 14px",
            borderRight: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white)",
            minWidth: 0,
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {VariantsCol}
          <div
            style={{
              height: 1,
              background: "var(--sv-ink)",
              opacity: 0.15,
              margin: "2px 0",
            }}
          />
          {BrandingCol}
        </aside>
        <div style={{ minWidth: 0 }}>{CanvasCol}</div>
      </div>

      <div
        className="lg:hidden"
        style={{
          border: "1.5px solid var(--sv-ink)",
          boxShadow: "3px 3px 0 0 var(--sv-ink)",
          background: "var(--sv-white)",
          padding: "18px 16px",
        }}
      >
        {mobileTab === "canvas" && CanvasCol}
        {mobileTab === "sidebar" && (
          <div className="flex flex-col gap-5">
            {VariantsCol}
            <div
              style={{
                height: 1,
                background: "var(--sv-ink)",
                opacity: 0.15,
              }}
            />
            {BrandingCol}
          </div>
        )}
      </div>

      {(() => {
        const email = user?.email?.toLowerCase().trim() || "";
        const isAdmin = ADMIN_EMAILS.includes(email);
        if (!isAdmin) return null;
        const promptUsed = draft?.promptUsed || "";
        if (!promptUsed) {
          return (
            <AdminDebugPanel
              title="Debug IA"
              subtitle="Carrossel sem prompt_used registrado (gerado antes da feature). Novos carrosseis terão."
              emptyHint
            />
          );
        }
        return <AdminDebugPanel title="Debug IA" promptUsed={promptUsed} />;
      })()}

    </motion.div>
  );
}

/**
 * Painel só-admin que mostra o systemPrompt + userMessage enviado à IA
 * pra gerar o carrossel atual. Visibilidade travada em isAdmin (email).
 */
function AdminDebugPanel({
  title,
  subtitle,
  promptUsed,
  emptyHint,
}: {
  title: string;
  subtitle?: string;
  promptUsed?: string;
  emptyHint?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!promptUsed) return;
    try {
      await navigator.clipboard.writeText(promptUsed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }
  return (
    <div
      className="mt-6"
      style={{
        border: "1.5px dashed var(--sv-ink)",
        background: "var(--sv-paper)",
        padding: 14,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 16,
              color: "var(--sv-ink)",
            }}
          >
            {title}{" "}
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                color: "var(--sv-muted)",
                fontWeight: 700,
                marginLeft: 6,
              }}
            >
              · admin only
            </span>
          </div>
          {subtitle && (
            <div
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 12,
                color: "var(--sv-muted)",
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {!emptyHint && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="sv-btn sv-btn-outline"
              style={{ padding: "6px 10px", fontSize: 10 }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="sv-btn sv-btn-outline"
              style={{ padding: "6px 10px", fontSize: 10 }}
            >
              {expanded ? "Fechar" : "Expandir"}
            </button>
          </div>
        )}
      </div>
      {expanded && promptUsed && (
        <pre
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            lineHeight: 1.5,
            color: "var(--sv-ink)",
            background: "var(--sv-white)",
            border: "1px solid rgba(10,10,10,0.12)",
            padding: 12,
            marginTop: 10,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 500,
            overflow: "auto",
          }}
        >
          {promptUsed}
        </pre>
      )}
    </div>
  );
}
