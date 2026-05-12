"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import posthog from "posthog-js";
import { trackLead } from "@/lib/meta-pixel";

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    session,
    loading: authLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth();

  // Se veio um `?coupon=VIRAL50` do popup, salva em localStorage
  // pra o /app/checkout recuperar depois (sobrevive ao signup+redirect).
  // Lemos via window.location pra não depender de useSearchParams (que
  // obrigaria Suspense wrapping — mais complexo pra uma feature lateral).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("coupon");
      if (c && c.trim()) {
        window.localStorage.setItem("sv_pending_coupon", c.trim());
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Se usuário já tem sessão, redireciona direto pro app.
  useEffect(() => {
    if (!authLoading && user && session?.access_token) {
      router.replace("/app");
    }
  }, [authLoading, user, session, router]);

  // Default mode lido de ?mode=signup pra CTAs da landing chegarem direto
  // no formulário de cadastro (sem fricção extra pro tráfego frio do Meta).
  const [mode, setMode] = useState<"signin" | "signup">(() => {
    if (typeof window === "undefined") return "signin";
    try {
      const m = new URLSearchParams(window.location.search).get("mode");
      return m === "signup" ? "signup" : "signin";
    } catch {
      return "signin";
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) {
      return "Email ou senha incorretos.";
    }
    if (m.includes("email not confirmed")) {
      return "Confirme seu email antes de entrar. Procure o link de confirmação na caixa de entrada.";
    }
    if (m.includes("already registered") || m.includes("user already")) {
      return "Já existe uma conta com esse email. Tente entrar em vez de criar.";
    }
    if (m.includes("password") && m.includes("6")) {
      return "A senha precisa ter no mínimo 6 caracteres.";
    }
    if (m.includes("rate limit")) {
      return "Muitas tentativas seguidas. Espere alguns segundos e tente de novo.";
    }
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "signin") {
      const result = await signInWithEmail(email, password);
      if (result.error) {
        setError(friendlyError(result.error));
        setLoading(false);
        return;
      }
      posthog.identify(email, { email });
      posthog.capture("user_signed_in", { method: "email" });
      router.push("/app");
      return;
    }

    const result = await signUpWithEmail(email, password);
    if (result.error) {
      setError(friendlyError(result.error));
      setLoading(false);
      return;
    }
    if (result.needsEmailConfirmation) {
      posthog.identify(email, { email });
      posthog.capture("user_signed_up", { method: "email", needs_confirmation: true });
      // Meta Pixel `Lead` — email cadastrado (signup). Marca flag genérica
      // por email aqui pra que o auth-context (que monitora SIGNED_IN) não
      // duplique o evento quando o user confirmar e logar.
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(`sv_lead_tracked_email_${email}`, String(Date.now()));
        }
      } catch {
        /* ignore */
      }
      trackLead("free_signup_email");
      setSuccess("Conta criada! Verifique seu email pra confirmar antes de entrar.");
      setLoading(false);
      return;
    }
    posthog.identify(email, { email });
    posthog.capture("user_signed_up", { method: "email", needs_confirmation: false });
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`sv_lead_tracked_email_${email}`, String(Date.now()));
      }
    } catch {
      /* ignore */
    }
    trackLead("free_signup_email");
    router.push("/app");
  }

  const isSignin = mode === "signin";

  return (
    <div
      className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2"
      style={{ background: "var(--sv-paper)" }}
    >
      {/* ============ LEFT — editorial black panel ============ */}
      <div
        className="relative flex flex-col justify-between overflow-hidden px-8 py-10 md:px-12 md:py-12 min-h-[38vh] md:min-h-screen"
        style={{
          background: "var(--sv-ink)",
          color: "var(--sv-paper)",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,.08) 1px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      >
        {/* Decorations */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute rounded-full"
            style={{
              width: 400,
              height: 400,
              top: -120,
              right: -120,
              border: "1.5px solid rgba(245,243,236,.3)",
              background: "rgba(124,240,103,.08)",
              opacity: 0.4,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 220,
              height: 220,
              bottom: -40,
              left: "40%",
              border: "1.5px solid rgba(210,98,178,.4)",
              background: "rgba(210,98,178,.05)",
              opacity: 0.5,
            }}
          />
          <span
            className="absolute italic"
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 48,
              color: "rgba(245,243,236,.18)",
              top: "38%",
              left: "18%",
              transform: "rotate(-12deg)",
            }}
          >
            ✺
          </span>
          <span
            className="absolute italic"
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 38,
              color: "rgba(124,240,103,.35)",
              top: "10%",
              right: "28%",
              transform: "rotate(8deg)",
            }}
          >
            ✦
          </span>
          <span
            className="absolute italic"
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 34,
              color: "rgba(210,98,178,.4)",
              bottom: "22%",
              right: "14%",
              transform: "rotate(-4deg)",
            }}
          >
            ❋
          </span>
        </div>

        {/* Brand */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: "var(--sv-green)",
              border: "1.5px solid var(--sv-paper)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 12l3 3 5-6"
                stroke="#0A0A0A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            <span
              className="block"
              style={{
                fontFamily: "var(--sv-display)",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              Sequência <em className="italic">Viral</em>
            </span>
            <span
              className="mt-1 block uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "rgba(245,243,236,.55)",
              }}
            >
              By Kaleidos Digital
            </span>
          </span>
        </Link>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 mt-10 md:mt-0"
        >
          <p
            className="max-w-[560px]"
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: "clamp(32px, 4.4vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 400,
            }}
          >
            Carrosséis que{" "}
            <span
              className="italic"
              style={{
                background: "var(--sv-green)",
                color: "var(--sv-ink)",
                padding: "0 6px",
              }}
            >
              engajam
            </span>{" "}
            — escritos <em className="italic">por você,</em> diagramados pela Sequência.
          </p>
        </motion.div>

        {/* Legal footer on left, desktop only */}
        <p
          className="relative z-10 hidden md:block uppercase"
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9,
            letterSpacing: "0.18em",
            color: "rgba(245,243,236,.4)",
          }}
        >
          © 2026 · Kaleidos Digital
        </p>
      </div>

      {/* ============ RIGHT — form ============ */}
      <div className="relative flex min-h-[62vh] items-center justify-center px-6 py-12 md:min-h-screen md:px-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex w-full max-w-[460px] flex-col"
        >
          {/* Eyebrow */}
          <span className="sv-eyebrow mb-5 self-start">
            <span className="sv-dot" />
            {isSignin ? "Entrar no app" : "Criar conta"}
          </span>

          {/* Tabs */}
          <div
            className="mb-7 flex"
            style={{ borderBottom: "1.5px solid var(--sv-ink)" }}
          >
            {(["signin", "signup"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError("");
                    setSuccess("");
                  }}
                  className="flex-1 uppercase transition-colors"
                  style={{
                    padding: "10px 0",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    fontWeight: 700,
                    color: active ? "var(--sv-ink)" : "var(--sv-muted)",
                    borderBottom: active
                      ? "3px solid var(--sv-green)"
                      : "3px solid transparent",
                    marginBottom: "-1.5px",
                    background: "transparent",
                  }}
                >
                  {m === "signin" ? "Entrar" : "Criar conta"}
                </button>
              );
            })}
          </div>

          {/* Headline */}
          <motion.h1
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: "clamp(36px, 4vw, 48px)",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              fontWeight: 400,
              color: "var(--sv-ink)",
              marginBottom: 12,
            }}
          >
            {isSignin ? (
              <>
                Bem-vindo de <em className="italic">volta.</em>
              </>
            ) : (
              <>
                Crie sua <em className="italic">conta.</em>
              </>
            )}
          </motion.h1>
          <p
            className="mb-7"
            style={{
              color: "var(--sv-muted)",
              fontFamily: "var(--sv-sans)",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            {isSignin
              ? "Entre para continuar criando carrosséis com a identidade da sua marca."
              : "Comece a gerar carrosséis editoriais em 60 segundos."}
          </p>

          {/* OAuth */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                posthog.capture("user_signed_in_with_google");
                signInWithGoogle();
              }}
              className="sv-btn sv-btn-outline"
              aria-label="Entrar com Google"
              style={{ padding: "12px 14px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
          </div>

          {/* Divider */}
          <div
            className="my-4 flex items-center gap-3 uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9,
              letterSpacing: "0.22em",
              color: "var(--sv-muted)",
            }}
          >
            <div
              className="h-px flex-1"
              style={{ background: "var(--sv-ink)", opacity: 0.15 }}
            />
            ou com email
            <div
              className="h-px flex-1"
              style={{ background: "var(--sv-ink)", opacity: 0.15 }}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  color: "var(--sv-muted)",
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="sv-input w-full"
                style={{ padding: "12px 14px", fontSize: 14 }}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="uppercase"
                  style={{
                    fontFamily: "var(--sv-mono)",
                    fontSize: 9,
                    letterSpacing: "0.2em",
                    color: "var(--sv-muted)",
                  }}
                >
                  Senha
                </label>
                {isSignin && (
                  <a
                    href="mailto:madureira@kaleidosdigital.com?subject=Esqueci%20minha%20senha"
                    className="uppercase"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      color: "var(--sv-muted)",
                      borderBottom: "1.5px solid transparent",
                    }}
                  >
                    Esqueceu?
                  </a>
                )}
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete={isSignin ? "current-password" : "new-password"}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="sv-input w-full"
                style={{ padding: "12px 14px", fontSize: 14 }}
              />
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  style={{
                    fontFamily: "var(--sv-sans)",
                    background: "#FFE8E4",
                    border: "1.5px solid #C23A1E",
                    color: "#7A1D0D",
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    boxShadow: "2px 2px 0 0 #0A0A0A",
                  }}
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  key="success"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  style={{
                    fontFamily: "var(--sv-sans)",
                    background: "var(--sv-green)",
                    border: "1.5px solid var(--sv-ink)",
                    color: "var(--sv-ink)",
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    boxShadow: "2px 2px 0 0 #0A0A0A",
                  }}
                >
                  {success}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="sv-btn sv-btn-primary mt-2 w-full justify-center"
              style={{ padding: "14px 18px", fontSize: 12, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {isSignin ? "Entrando…" : "Criando…"}
                </>
              ) : (
                <>{isSignin ? "Entrar →" : "Criar agora →"}</>
              )}
            </button>
          </form>

          {/* Toggle */}
          <p
            className="mt-7 text-center uppercase"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "var(--sv-muted)",
            }}
          >
            {isSignin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignin ? "signup" : "signin");
                setError("");
                setSuccess("");
              }}
              style={{
                color: "var(--sv-ink)",
                borderBottom: "1.5px solid var(--sv-green)",
                fontWeight: 700,
                cursor: "pointer",
                background: "transparent",
                padding: 0,
              }}
            >
              {isSignin ? "Criar agora" : "Entrar"}
            </button>
          </p>

          {/* Legal */}
          <p
            className="mt-8 text-center"
            style={{
              fontFamily: "var(--sv-sans)",
              fontSize: 11,
              color: "var(--sv-muted)",
            }}
          >
            Ao continuar você concorda com os{" "}
            <Link
              href="/terms"
              style={{
                color: "var(--sv-ink)",
                borderBottom: "1px solid var(--sv-ink)",
              }}
            >
              Termos
            </Link>{" "}
            e a{" "}
            <Link
              href="/privacy"
              style={{
                color: "var(--sv-ink)",
                borderBottom: "1px solid var(--sv-ink)",
              }}
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}
