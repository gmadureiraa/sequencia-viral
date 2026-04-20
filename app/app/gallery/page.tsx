"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Trash2, Upload, Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Galeria do usuário — tabela `user_images`. Lista todas as imagens geradas
 * (Imagen) ou upadas pelo user. Pode ser reusada no editor de carrossel.
 */

type Source = "generated" | "uploaded" | "unsplash" | "search";
type FilterSource = "all" | Source;

interface GalleryItem {
  id: string;
  url: string;
  source: Source;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

const FILTERS: { id: FilterSource; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "generated", label: "Geradas por IA" },
  { id: "uploaded", label: "Minhas fotos" },
];

export default function GalleryPage() {
  const { user, session } = useAuth();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState<FilterSource>("all");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGallery = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const qs = filter === "all" ? "" : `?source=${filter}`;
      const res = await fetch(`/api/gallery${qs}`, {
        headers: jsonWithAuth(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setImages(data.images ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [session, filter]);

  useEffect(() => {
    void fetchGallery();
  }, [fetchGallery]);

  const counts = useMemo(() => {
    const c = { all: images.length, generated: 0, uploaded: 0 };
    for (const img of images) {
      if (img.source === "generated") c.generated += 1;
      if (img.source === "uploaded") c.uploaded += 1;
    }
    return c;
  }, [images]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !user || !supabase || !session) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`"${file.name}" não é imagem.`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`"${file.name}" maior que 8MB.`);
          continue;
        }
        const form = new FormData();
        form.set("file", file);
        form.set("carouselId", "gallery");
        form.set("slideIndex", "0");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Upload falhou.");
          continue;
        }
      }
      await fetchGallery();
      toast.success("Galeria atualizada.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!session) return;
    if (!confirm("Apagar essa imagem da galeria? (o arquivo fica no storage se outro carrossel estiver usando)")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/gallery?id=${id}`, {
        method: "DELETE",
        headers: jsonWithAuth(session),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha");
      }
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao apagar.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada.");
    } catch {
      toast.error("Falha ao copiar.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1100 }}
    >
      <span className="sv-eyebrow">
        <span className="sv-dot" /> Nº 00 · Galeria
      </span>

      <h1
        className="sv-display mt-3"
        style={{
          fontSize: "clamp(26px, 3.6vw, 40px)",
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
        }}
      >
        Sua{" "}
        <span
          style={{
            background: "var(--sv-green)",
            padding: "0 8px",
            fontStyle: "italic",
          }}
        >
          galeria
        </span>
        .
      </h1>
      <p
        className="mt-1.5"
        style={{
          color: "var(--sv-muted)",
          fontSize: 13.5,
          lineHeight: 1.5,
          maxWidth: 620,
        }}
      >
        Todas as imagens que você gerou com IA ou subiu ficam aqui. Podem ser
        reusadas em carrosséis futuros direto pelo editor.
      </p>

      {/* Filtros + Upload */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist">
          {FILTERS.map((f) => {
            const count =
              f.id === "all"
                ? counts.all
                : f.id === "generated"
                  ? counts.generated
                  : f.id === "uploaded"
                    ? counts.uploaded
                    : 0;
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className="uppercase"
                style={{
                  padding: "8px 14px",
                  border: "1.5px solid var(--sv-ink)",
                  background: on ? "var(--sv-ink)" : "var(--sv-white)",
                  color: on ? "var(--sv-paper)" : "var(--sv-ink)",
                  boxShadow: "2px 2px 0 0 var(--sv-ink)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="sv-btn sv-btn-primary"
          style={{ padding: "9px 16px", fontSize: 11 }}
        >
          {uploading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Subindo...
            </>
          ) : (
            <>
              <Upload size={12} strokeWidth={2.5} />
              Subir imagens
            </>
          )}
        </button>
      </div>

      {/* Grid */}
      <div className="mt-6">
        {loading ? (
          <div
            className="flex items-center justify-center py-20"
            style={{ color: "var(--sv-muted)" }}
          >
            <Loader2 className="animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{
              border: "1.5px dashed var(--sv-ink)",
              color: "var(--sv-muted)",
              padding: 40,
            }}
          >
            <p style={{ fontSize: 15, marginBottom: 10 }}>
              Ainda sem imagens nessa categoria.
            </p>
            <p style={{ fontSize: 12 }}>
              Gere um carrossel (as imagens do Imagen entram aqui) ou suba as suas.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  position: "relative",
                  aspectRatio: "1 / 1",
                  background: "var(--sv-white)",
                  border: "1.5px solid var(--sv-ink)",
                  boxShadow: "3px 3px 0 0 var(--sv-ink)",
                  overflow: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.title || "Imagem"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />
                {/* Badge source */}
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    padding: "2px 6px",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 8,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    background:
                      img.source === "generated"
                        ? "var(--sv-green)"
                        : "var(--sv-white)",
                    border: "1px solid var(--sv-ink)",
                    color: "var(--sv-ink)",
                  }}
                >
                  {img.source === "generated" ? "IA" : img.source === "uploaded" ? "Minha" : img.source}
                </span>
                {/* Usage counter */}
                {img.usage_count > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      padding: "2px 6px",
                      fontFamily: "var(--sv-mono)",
                      fontSize: 8,
                      letterSpacing: "0.12em",
                      background: "rgba(10,10,10,0.85)",
                      color: "var(--sv-paper)",
                    }}
                  >
                    {img.usage_count}× usada
                  </span>
                )}
                {/* Action overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 6,
                    display: "flex",
                    gap: 4,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(img.url)}
                    title="Copiar URL"
                    style={{
                      padding: "4px 8px",
                      border: "1px solid rgba(255,255,255,0.3)",
                      background: "rgba(10,10,10,0.6)",
                      color: "var(--sv-paper)",
                      fontSize: 10,
                      fontFamily: "var(--sv-mono)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    <CopyIcon size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    disabled={deletingId === img.id}
                    title="Apagar"
                    className="ml-auto"
                    style={{
                      padding: "4px 8px",
                      border: "1px solid rgba(255,255,255,0.3)",
                      background: "rgba(224,107,107,0.9)",
                      color: "var(--sv-paper)",
                      fontSize: 10,
                      fontFamily: "var(--sv-mono)",
                      cursor: deletingId === img.id ? "wait" : "pointer",
                    }}
                  >
                    {deletingId === img.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Trash2 size={10} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
