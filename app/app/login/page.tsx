"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import CarouselSlide from "@/components/app/carousel-slide";

export default function LoginPage() {
  const router = useRouter();
  const {
    signInWithGoogle,
    signInWithTwitter,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      setSuccess("Conta criada! Verifique seu email pra confirmar antes de entrar.");
      setLoading(false);
      return;
    }
    router.push("/app");
  }

  const isSignin = mode === "signin";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF8] px-4 py-10">
      {/* Logo top */}
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF8534] to-[#EC6000] text-white shadow-[0_4px_12px_-2px_rgba(236,96,0,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]">
          <Sparkles size={16} />
        </span>
        <span className="text-lg font-black tracking-tight text-zinc-900">
          Sequência Viral
        </span>
      </Link>

      {/* Two-column card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(10,10,10,0.04),0_32px_80px_-16px_rgba(236,96,0,0.12)]"
      >
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* LEFT — Form */}
          <div className="flex flex-col justify-center px-8 py-12 md:px-12">
            <div className="mx-auto w-full max-w-sm">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h1 className="text-3xl font-black tracking-[-0.02em] text-zinc-900">
                  {isSignin ? "Bem-vindo de volta" : "Crie sua conta"}
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  {isSignin
                    ? "Entre na sua conta Sequência Viral"
                    : "Comece a gerar carrosséis em 30 segundos"}
                </p>
              </motion.div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-zinc-900"
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
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-zinc-900"
                    >
                      Senha
                    </label>
                    {isSignin && (
                      <a
                        href="mailto:hi@sequencia-viral.app?subject=Esqueci%20minha%20senha"
                        className="text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                      >
                        Esqueceu a senha?
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
                    className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.p
                      key="error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
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
                      className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700"
                    >
                      {success}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0A0A0A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Entrando…
                    </>
                  ) : isSignin ? (
                    "Entrar"
                  ) : (
                    "Criar conta"
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="text-xs text-zinc-400">Ou entre com</span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>

              {/* OAuth row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                  aria-label="Entrar com Google"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
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
                <button
                  type="button"
                  onClick={signInWithTwitter}
                  className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                  aria-label="Entrar com X"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X / Twitter
                </button>
              </div>

              {/* Signup / Signin toggle */}
              <p className="mt-6 text-center text-sm text-zinc-500">
                {isSignin ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(isSignin ? "signup" : "signin");
                    setError("");
                    setSuccess("");
                  }}
                  className="font-bold text-zinc-900 underline underline-offset-2 hover:text-[var(--accent)]"
                >
                  {isSignin ? "Criar conta" : "Entrar"}
                </button>
              </p>

            </div>
          </div>

          {/* RIGHT — Visual panel */}
          <div className="relative hidden overflow-hidden md:block">
            {/* Background */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 70% 30%, rgba(255, 133, 52, 0.22) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(236, 96, 0, 0.18) 0%, transparent 55%), #FFFAF3",
              }}
            />
            {/* Grid pattern overlay */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #0A0A0A 1px, transparent 1px), linear-gradient(to bottom, #0A0A0A 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />

            {/* Floating carousel slide */}
            <div className="relative flex h-full items-center justify-center p-10">
              <motion.div
                initial={{ opacity: 0, y: 28, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: -3 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
                style={{
                  filter:
                    "drop-shadow(0 24px 48px rgba(10, 10, 10, 0.12)) drop-shadow(0 6px 12px rgba(236, 96, 0, 0.15))",
                }}
              >
                <CarouselSlide
                  heading="1. Cole uma ideia"
                  body={
                    "Link, PDF, texto ou vídeo.\n\nO Sequência Viral transforma em carrossel com a voz da sua marca, em 30 segundos."
                  }
                  slideNumber={1}
                  totalSlides={4}
                  profile={{
                    name: "Sequência Viral",
                    handle: "@sequencia-viral",
                    photoUrl: "",
                  }}
                  style="white"
                />
              </motion.div>

              {/* Floating decoration chips */}
              <motion.div
                initial={{ opacity: 0, y: -10, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: 8 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="absolute right-8 top-12"
              >
                <div className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-900 shadow-[0_8px_24px_-4px_rgba(236,96,0,0.25)]">
                  <span className="text-[var(--accent)]">✨</span> Gerado em 28s
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: -6 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="absolute bottom-10 left-8"
              >
                <div className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-700 shadow-[0_8px_24px_-4px_rgba(10,10,10,0.12)]">
                  Editável · clique e edite
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Legal footer */}
      <p className="mt-6 text-center text-[12px] text-zinc-500">
        Ao continuar você concorda com os{" "}
        <Link href="#" className="underline underline-offset-2 hover:text-zinc-900">
          Termos de Serviço
        </Link>{" "}
        e a{" "}
        <Link href="#" className="underline underline-offset-2 hover:text-zinc-900">
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  );
}
