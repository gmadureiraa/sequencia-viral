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
import type { ImagePeopleMode } from "./carousel-templates";

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
  /** Preferência "pessoas na foto" para o template Spotlight (hero futurista). */
  spotlight_image_people_mode?: ImagePeopleMode | null;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
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

  // Initialize auth — somente sessão Supabase; sem modo convidado
  useEffect(() => {
    clearLegacyGuestStorage();

    if (!supabase) {
      console.warn(
        "[auth] Supabase client is null — configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).then((p) => {
          if (p) setProfile(p);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        clearLegacyGuestStorage();
        const p = await fetchProfile(s.user.id);
        if (p) setProfile(p);
      } else {
        setProfile(null);
        if (event === "SIGNED_OUT") {
          clearLegacyGuestStorage();
        }
      }
    });

    return () => subscription.unsubscribe();
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

  const signInWithTwitter = useCallback(async () => {
    if (!supabase) {
      console.warn("Supabase not configured");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "twitter",
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
      signInWithTwitter,
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
      signInWithTwitter,
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
