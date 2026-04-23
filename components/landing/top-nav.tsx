"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLandingSession } from "@/lib/use-landing-session";

// Menu encurtado: "Exemplos" foi removido porque a home nao tem `#exemplos`.
// Se a section voltar, reativar aqui.
const NAV_ITEMS = [
  { label: "Como funciona", href: "#como" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function TopNav() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn } = useLandingSession();
  const primaryHref = isLoggedIn ? "/app" : "/app/login";
  const primaryLabel = isLoggedIn ? "Ir pro app →" : "Criar grátis →";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--sv-paper) 92%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--sv-ink)",
      }}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center" aria-label="Sequência Viral">
          {/* Logo completa. WebP da identidade Kaleidos (fundo preto embedded
              já no asset). Usa largura generosa pra ser legível no nav. */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 42,
              background: "var(--sv-ink)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "2px 2px 0 0 var(--sv-ink)",
              overflow: "hidden",
              padding: "0 10px",
            }}
          >
            <Image
              src="/brand/logo-sv-full.webp"
              alt="Sequência Viral"
              width={1200}
              height={655}
              priority
              style={{
                height: 32,
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </span>
        </Link>

        <ul className="hidden items-center md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="block px-3 py-[7px] transition-colors hover:bg-[var(--sv-green)]"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--sv-ink)",
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {!isLoggedIn && (
            <Link
              href="/app/login"
              className="sv-btn sv-btn-ghost"
              style={{ padding: "8px 14px", fontSize: 11 }}
            >
              Entrar
            </Link>
          )}
          <Link
            href={primaryHref}
            className="sv-btn sv-btn-primary"
            style={{ padding: "8px 14px", fontSize: 11 }}
          >
            {primaryLabel}
          </Link>
        </div>

        <button
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="sv-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden"
          style={{
            border: "1.5px solid var(--sv-ink)",
            padding: 8,
            background: "var(--sv-white)",
            boxShadow: "2px 2px 0 0 var(--sv-ink)",
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="sv-mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden"
            style={{
              borderTop: "1px solid var(--sv-ink)",
              background: "var(--sv-paper)",
              overflow: "hidden",
            }}
          >
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block px-6 py-3"
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      borderBottom: "1px solid rgba(10,10,10,0.1)",
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="flex gap-2 px-6 py-4">
                {!isLoggedIn && (
                  <Link
                    href="/app/login"
                    className="sv-btn sv-btn-outline"
                    style={{ padding: "10px 16px", fontSize: 11 }}
                  >
                    Entrar
                  </Link>
                )}
                <Link
                  href={primaryHref}
                  className="sv-btn sv-btn-primary"
                  style={{ padding: "10px 16px", fontSize: 11 }}
                >
                  {primaryLabel}
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
