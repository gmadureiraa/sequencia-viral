"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { trackLead } from "./meta-pixel";
import {
  captureReferralFromUrl,
  getStoredReferralCode,
  trackReferral,
  markReferralTracked,
  wasReferralTracked,
} from "./referral-client";
export interface BrandAnalysis {
  detected_niche: string[];
  tone_detected: string;
  top_topics: string[];
  posting_frequency: string;
  avg_engagement: { likes: number; comments: number };
  content_pillars: string[];
  audience_description: string;
  inspirations: string[];
  voice_preference: string;
  // Campos adicionais coletados no onboarding (opcionais pra retrocompat):
  voice_samples?: string[];
  tabus?: string[];
  content_rules?: string[];
  /** Posts de referência coletados no onboarding (step refs). URL + timestamp.
   *  Um extractor futuro le o texto desses posts pra alimentar a voz da IA. */
  __reference_posts?: {
    urls: string[];
    addedAt: string;
  };
  /** Aesthetic extraído por Gemini Vision dos brand_image_refs (step visual). */
  __image_aesthetic?: {
    description: string;
    palette?: string[];
    keywords?: string[];
    updatedAt?: string;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  twitter_handle: string;
  instagram_handle: string;
  linkedin_url: string;
  niche: string[];
  tone: string;
  language: string;
  carousel_style: string;
  plan: string;
  usage_count: number;
  usage_limit: number;
  onboarding_completed: boolean;
  brand_analysis?: BrandAnalysis;
  /** Cores de destaque do branding (hex), usadas como swatches no editor. */
  brand_colors?: string[];
  /** URLs (até 3) de imagens de referência visual da marca. A estética é
   *  extraída via Gemini Vision e aplicada na geração Imagen 4. */
  brand_image_refs?: string[];
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_KEYS = ["sequencia-viral_guest", "sequencia-viral_guest_profile"] as const;

function clearLegacyGuestStorage() {
  if (typeof window === "undefined") return;
  for (const k of GUEST_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    return data as UserProfile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) setProfile(p);
  }, [user, fetchProfile]);

  // Initialize auth — somente sessão Supabase; sem modo convidado.
  useEffect(() => {
    clearLegacyGuestStorage();
    // Captura ?ref= da URL antes de qualquer outra coisa — TTL 30 dias no
    // localStorage. Funciona mesmo sem sessao (visitante anonimo na landing).
    captureReferralFromUrl();

    if (!supabase) {
      console.warn(
        "[auth] Supabase client is null — configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Fallback absoluto: mesmo que a promise trave, libera UI em 6s pra
    // não deixar "Carregando sessão…" preso na tela.
    const hardTimeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const s = data.session;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          try {
            const p = await fetchProfile(s.user.id);
            if (!cancelled && p) setProfile(p);
          } catch (err) {
            console.warn("[auth] fetchProfile falhou:", err);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("[auth] getSession falhou:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        clearLegacyGuestStorage();
        void fetchProfile(s.user.id).then((p) => {
          if (!cancelled && p) setProfile(p);
        });
        // Welcome email é idempotente e fire-and-forget (não bloqueia auth).
        if (event === "SIGNED_IN") {
          void fetch("/api/email/welcome", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${s.access_token}`,
            },
          }).catch(() => {
            /* ignora */
          });

          // Programa Indique-e-Ganhe: se tem ref code no localStorage e
          // ainda nao foi trackeado, registra a indicacao agora. Tipicamente
          // dispara so na primeira vez que o user loga apos signup vindo de
          // ?ref=. Idempotente no backend, mas evitamos chamar se ja foi.
          try {
            const refCode = getStoredReferralCode();
            if (refCode && !wasReferralTracked() && s.access_token) {
              void trackReferral(s.access_token, refCode).then((ok) => {
                if (ok) markReferralTracked();
              });
            }
          } catch {
            /* ignora — referral e fire-and-forget */
          }

          // Meta Pixel `Lead` — só dispara em SIGNUP, não em login. Usa
          // localStorage flag por user.id pra não duplicar entre sessões.
          // OAuth (Google/X) não tem evento separado de signup, então
          // detectamos via `created_at` recente (<60s) na primeira vez que
          // vemos o user nesse browser. Email signup já dispara em
          // `app/app/login/page.tsx` e marca `sv_lead_tracked_email_<email>`
          // pra que essa branch não duplique no SIGNED_IN seguinte.
          try {
            if (typeof window !== "undefined") {
              const flagKey = `sv_lead_tracked_${s.user.id}`;
              const emailFlagKey = s.user.email
                ? `sv_lead_tracked_email_${s.user.email}`
                : null;
              const alreadyTracked =
                !!window.localStorage.getItem(flagKey) ||
                (emailFlagKey ? !!window.localStorage.getItem(emailFlagKey) : false);
              if (!alreadyTracked) {
                const createdAt = s.user.created_at
                  ? new Date(s.user.created_at).getTime()
                  : 0;
                const isFreshSignup =
                  createdAt > 0 && Date.now() - createdAt < 60_000;
                if (isFreshSignup) {
                  const provider =
                    (s.user.app_metadata?.provider as string | undefined) ??
                    "unknown";
                  trackLead(`free_signup_${provider}`);
                }
                // Marca de qualquer jeito pra nunca refazer detect nesse user.
                window.localStorage.setItem(flagKey, String(Date.now()));
              }
            }
          } catch {
            /* ignora — pixel é fire-and-forget */
          }
        }
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
        clearLegacyGuestStorage();
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return { error: "Supabase não está configurado." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!supabase)
        return { error: "Supabase não está configurado.", needsEmailConfirmation: false };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) {
        return { error: error.message, needsEmailConfirmation: false };
      }
      const needsEmailConfirmation = !data.session;
      return { error: null, needsEmailConfirmation };
    },
    []
  );

  const signOut = useCallback(async () => {
    clearLegacyGuestStorage();
    try {
      localStorage.removeItem("sequencia-viral_onboarding");
    } catch {
      /* ignore */
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      if (!supabase) {
        console.error(
          "[updateProfile] Supabase client is null — NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing"
        );
        throw new Error("Supabase não está configurado. Verifique as variáveis de ambiente.");
      }
      if (!user) {
        console.error("[updateProfile] No authenticated user in context");
        throw new Error("Usuário não autenticado. Faça login novamente.");
      }
      const payload = {
        id: user.id,
        email: user.email,
        ...data,
      };
      const { data: updated, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select()
        .maybeSingle();
      if (error) {
        console.error(
          "[updateProfile] upsert failed:",
          error.message,
          error.details,
          error.hint,
          error.code
        );
        throw new Error(error.message || "Erro ao salvar perfil.");
      }
      if (!updated) {
        console.warn(
          "[updateProfile] Upsert returned no data (possible RLS block). Payload:",
          JSON.stringify(payload)
        );
      }
      if (updated) setProfile(updated as UserProfile);
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile,
      refreshProfile,
    }),
    [
      user,
      profile,
      session,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
