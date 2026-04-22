"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, PlayCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Admin Batch Test — roda N testes de geração em sequência pra Gabriel
 * validar qualidade em diferentes nichos. Salva os carrosseis gerados
 * na conta indicada em userId (default: self).
 */

const ADMIN_EMAILS = ["gf.madureiraa@gmail.com", "gf.madureira@hotmail.com"];

interface TestConfig {
  label: string;
  niche: string;
  tone: string;
  sourceType: "idea" | "link" | "video" | "instagram";
  sourceUrl?: string;
  topic?: string;
  language?: string;
}

// 15 testes de nichos variados com URLs reais.
const DEFAULT_TESTS: TestConfig[] = [
  {
    label: "Cripto · Investidor 4.20",
    niche: "crypto",
    tone: "analytical",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=obSImkBppFQ",
    language: "pt-br",
  },
  {
    label: "Marketing · Seth Godin Marketing Made Simple",
    niche: "marketing",
    tone: "didatico",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=9EzCi_b3GrE",
    language: "pt-br",
  },
  {
    label: "IA · Dwarkesh Patel + Dario Amodei",
    niche: "ai",
    tone: "analytical",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=Gi_t3v53XRU",
    language: "pt-br",
  },
  {
    label: "Fitness · HIIT workout science",
    niche: "fitness",
    tone: "direct",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=ml6cT4AZdqI",
    language: "pt-br",
  },
  {
    label: "Finanças · Primo Rico lições",
    niche: "finance",
    tone: "didatico",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=3b9sseMjvOQ",
    language: "pt-br",
  },
  {
    label: "Produtividade · Paul Graham essay",
    niche: "productivity",
    tone: "analytical",
    sourceType: "link",
    sourceUrl: "http://paulgraham.com/makersschedule.html",
    language: "pt-br",
  },
  {
    label: "Design · Refactoring UI principles",
    niche: "design",
    tone: "didatico",
    sourceType: "link",
    sourceUrl: "https://www.refactoringui.com/previews/building-your-color-palette",
    language: "pt-br",
  },
  {
    label: "Psicologia · Huberman podcast",
    niche: "psychology",
    tone: "analytical",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=H-XfCl-HpRM",
    language: "pt-br",
  },
  {
    label: "Empreendedorismo · Stripe Atlas Guides",
    niche: "business",
    tone: "direct",
    sourceType: "link",
    sourceUrl: "https://stripe.com/guides/atlas/startup-fundraising",
    language: "pt-br",
  },
  {
    label: "Carreira · Lenny Rachitsky",
    niche: "career",
    tone: "didatico",
    sourceType: "link",
    sourceUrl: "https://www.lennysnewsletter.com/p/how-to-make-the-jump-to-a-senior",
    language: "pt-br",
  },
  {
    label: "Educação · TEDx pt-BR",
    niche: "education",
    tone: "inspiring",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=8MTEeOs_LPk",
    language: "pt-br",
  },
  {
    label: "Ciência · Quanta Magazine",
    niche: "science",
    tone: "analytical",
    sourceType: "link",
    sourceUrl:
      "https://www.quantamagazine.org/the-computer-scientist-who-parries-with-paradoxes-20220629/",
    language: "pt-br",
  },
  {
    label: "Saúde mental · Andrew Huberman sleep",
    niche: "health",
    tone: "didatico",
    sourceType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=aXvDEmo6uS4",
    language: "pt-br",
  },
  {
    label: "Filosofia · Aeon essay",
    niche: "philosophy",
    tone: "analytical",
    sourceType: "link",
    sourceUrl: "https://aeon.co/essays/the-good-life-is-a-process-not-a-state-of-being",
    language: "pt-br",
  },
  {
    label: "Culinária · NYT Cooking guide",
    niche: "food",
    tone: "didatico",
    sourceType: "link",
    sourceUrl: "https://cooking.nytimes.com/guides/13-how-to-cook-pasta",
    language: "pt-br",
  },
];

interface TestResult {
  index: number;
  label: string;
  status: "ok" | "failed";
  carouselId?: string;
  title?: string;
  error?: string;
  durationMs: number;
  writerTokens?: { input: number; output: number; model: string };
  nerTokens?: { input: number; output: number };
  sourceChars?: number;
  factsPreview?: {
    entities: string[];
    dataPoints: string[];
    quotes: string[];
  };
}

export default function BatchTestPage() {
  const { user, session, loading } = useAuth();
  const [jsonText, setJsonText] = useState<string>(
    JSON.stringify(DEFAULT_TESTS, null, 2)
  );
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    ok: number;
    failed: number;
  } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase().trim();
    return email ? ADMIN_EMAILS.includes(email) : false;
  }, [user]);

  async function run() {
    if (!session || !user) return;
    setError(null);
    setResults(null);
    setSummary(null);
    let tests: TestConfig[];
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("JSON deve ser um array");
      tests = parsed;
    } catch (e) {
      setError("JSON inválido: " + (e instanceof Error ? e.message : "erro"));
      return;
    }
    if (tests.length === 0 || tests.length > 30) {
      setError("Passe entre 1 e 30 testes");
      return;
    }
    setFetching(true);
    try {
      const res = await fetch("/api/admin/generate-batch", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({ userId: user.id, tests }),
      });
      const txt = await res.text();
      let parsed: {
        results?: TestResult[];
        summary?: { total: number; ok: number; failed: number };
        error?: string;
      } = {};
      try {
        parsed = txt ? JSON.parse(txt) : {};
      } catch {
        throw new Error(`Resposta inválida HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(parsed.error || `HTTP ${res.status}`);
      }
      setResults(parsed.results || []);
      setSummary(parsed.summary || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setFetching(false);
    }
  }

  function resetDefault() {
    setJsonText(JSON.stringify(DEFAULT_TESTS, null, 2));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[600px] py-12 text-center">
        <Loader2
          size={18}
          className="animate-spin inline-block"
          style={{ color: "var(--sv-ink)" }}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[600px] py-12">
        <p style={{ fontFamily: "var(--sv-mono)", color: "var(--sv-muted)" }}>
          Sem acesso.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1200 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/app/admin"
          className="inline-flex items-center gap-1.5"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <ArrowLeft size={12} /> Admin
        </Link>
      </div>

      <span className="sv-eyebrow">
        <span className="sv-dot" /> Batch Generation · Admin
      </span>
      <h1
        className="sv-display mt-3"
        style={{
          fontSize: "clamp(24px, 4vw, 38px)",
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
        }}
      >
        Rodar <em>N testes</em>.
      </h1>
      <p className="mt-2" style={{ color: "var(--sv-muted)", fontSize: 13.5 }}>
        Gera carrosseis em lote com configs variadas. Salva tudo na sua conta
        ({user?.email}) como drafts pra você revisar.
      </p>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={fetching}
          className="sv-btn sv-btn-primary"
          style={{
            padding: "10px 14px",
            fontSize: 11.5,
            opacity: fetching ? 0.5 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {fetching ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <PlayCircle size={13} />
          )}
          Rodar batch
        </button>
        <button
          type="button"
          onClick={resetDefault}
          className="sv-btn sv-btn-outline"
          style={{ padding: "10px 14px", fontSize: 11 }}
        >
          Resetar 15 defaults
        </button>
        <span
          className="uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--sv-muted)",
            fontWeight: 700,
          }}
        >
          {jsonText ? (() => {
            try {
              const arr = JSON.parse(jsonText);
              return Array.isArray(arr) ? `${arr.length} teste(s)` : "JSON inválido";
            } catch {
              return "JSON inválido";
            }
          })() : ""}
        </span>
      </div>

      {error && (
        <div
          className="mt-4 p-3"
          style={{
            border: "1.5px solid #c94f3b",
            background: "#fdf0ed",
            color: "#7a2a1a",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div
            className="uppercase mb-2"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              fontWeight: 700,
              color: "var(--sv-ink)",
            }}
          >
            Configuração (JSON)
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="sv-input"
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 500,
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              lineHeight: 1.5,
              padding: 12,
              whiteSpace: "pre",
            }}
          />
        </div>

        <div>
          <div
            className="uppercase mb-2 flex items-center justify-between"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              fontWeight: 700,
              color: "var(--sv-ink)",
            }}
          >
            <span>Resultados</span>
            {summary && (
              <span
                style={{ color: "var(--sv-muted)", letterSpacing: "0.12em" }}
              >
                {summary.ok}/{summary.total} ok · {summary.failed} falha(s)
              </span>
            )}
          </div>
          <div
            style={{
              background: "var(--sv-white)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
              minHeight: 500,
              maxHeight: 620,
              overflow: "auto",
            }}
          >
            {!results && !fetching && (
              <p
                className="p-4"
                style={{ color: "var(--sv-muted)", fontSize: 12.5 }}
              >
                Clique em &ldquo;Rodar batch&rdquo; pra gerar os carrosseis.
                Tempo esperado: ~30s por teste (15 testes = ~7-10min).
              </p>
            )}
            {fetching && (
              <p
                className="p-4 flex items-center gap-2"
                style={{ color: "var(--sv-muted)", fontSize: 12.5 }}
              >
                <Loader2 size={14} className="animate-spin" />
                Gerando... pode demorar vários minutos, não feche a aba.
              </p>
            )}
            {results && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {results.map((r) => (
                  <li
                    key={r.index}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(10,10,10,0.1)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                        padding: "2px 6px",
                        background:
                          r.status === "ok" ? "var(--sv-green)" : "#c94f3b",
                        color:
                          r.status === "ok"
                            ? "var(--sv-ink)"
                            : "var(--sv-paper)",
                        textTransform: "uppercase",
                        alignSelf: "flex-start",
                      }}
                    >
                      {r.status}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: "var(--sv-ink)",
                        }}
                      >
                        {r.label}
                      </div>
                      {r.status === "ok" ? (
                        <>
                          <Link
                            href={`/app/create/${r.carouselId}/edit`}
                            style={{
                              fontFamily: "var(--sv-mono)",
                              fontSize: 10.5,
                              color: "var(--sv-ink)",
                              textDecoration: "underline",
                            }}
                          >
                            {r.title?.slice(0, 70) || "Editar"}
                          </Link>
                          <div
                            style={{
                              fontFamily: "var(--sv-mono)",
                              fontSize: 9.5,
                              color: "var(--sv-muted)",
                              letterSpacing: "0.1em",
                              marginTop: 4,
                            }}
                          >
                            {(r.durationMs / 1000).toFixed(1)}s ·{" "}
                            {r.writerTokens?.input}+{r.writerTokens?.output}tok (
                            {r.writerTokens?.model}) · source {r.sourceChars}ch
                          </div>
                          {r.factsPreview && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--sv-ink)",
                                marginTop: 6,
                                lineHeight: 1.4,
                              }}
                            >
                              {r.factsPreview.entities.length > 0 && (
                                <div>
                                  <strong>Entities:</strong>{" "}
                                  {r.factsPreview.entities.join(", ")}
                                </div>
                              )}
                              {r.factsPreview.dataPoints.length > 0 && (
                                <div>
                                  <strong>Data:</strong>{" "}
                                  {r.factsPreview.dataPoints.join(" · ")}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "#7a2a1a",
                            marginTop: 2,
                          }}
                        >
                          {r.error}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
