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
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getGuestProfile(): UserProfile {
  if (typeof window === "undefined") return createEmptyProfile("guest");
  const stored = localStorage.getItem("sequencia-viral_guest_profile");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return createEmptyProfile("guest");
}

function createEmptyProfile(id: string): UserProfile {
  return {
    id,
    name: "",
    email: "",
    avatar_url: "",
    twitter_handle: "",
    instagram_handle: "",
    linkedin_url: "",
    niche: [],
    tone: "professional",
    language: "pt-br",
    carousel_style: "white",
    plan: "free",
    usage_count: 0,
    usage_limit: 5,
    onboarding_completed: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

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
    if (isGuest) {
      setProfile(getGuestProfile());
      return;
    }
    if (user) {
      const p = await fetchProfile(user.id);
      if (p) setProfile(p);
    }
  }, [user, isGuest, fetchProfile]);

  // Initialize auth
  useEffect(() => {
    if (!supabase) {
      // Check if guest mode was previously active
      const wasGuest = typeof window !== "undefined" && localStorage.getItem("sequencia-viral_guest") === "true";
      if (wasGuest) {
        setIsGuest(true);
        setProfile(getGuestProfile());
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).then((p) => {
          if (p) setProfile(p);
          setLoading(false);
        });
      } else {
        const wasGuest = localStorage.getItem("sequencia-viral_guest") === "true";
        if (wasGuest) {
          setIsGuest(true);
          setProfile(getGuestProfile());
        }
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setIsGuest(false);
        localStorage.removeItem("sequencia-viral_guest");
        const p = await fetchProfile(s.user.id);
        if (p) setProfile(p);
      } else {
        setProfile(null);
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
      // If Supabase already returned a session, user is signed in (no email confirmation required).
      // Otherwise, user created but must confirm via email link.
      const needsEmailConfirmation = !data.session;
      return { error: null, needsEmailConfirmation };
    },
    []
  );

  const signOut = useCallback(async () => {
    if (isGuest) {
      setIsGuest(false);
      setProfile(null);
      localStorage.removeItem("sequencia-viral_guest");
      localStorage.removeItem("sequencia-viral_guest_profile");
      localStorage.removeItem("sequencia-viral_onboarding");
      return;
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, [isGuest]);

  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    const gp = getGuestProfile();
    setProfile(gp);
    localStorage.setItem("sequencia-viral_guest", "true");
    setLoading(false);
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      if (isGuest) {
        const updated = { ...getGuestProfile(), ...data };
        setProfile(updated as UserProfile);
        localStorage.setItem("sequencia-viral_guest_profile", JSON.stringify(updated));
        return;
      }
      if (!supabase || !user) {
        throw new Error("Supabase não está configurado ou usuário não autenticado.");
      }
      // Upsert handles both "profile exists" (update) and "profile doesn't exist yet"
      // (insert) in one call. The previous implementation used update().single() which
      // threw when no row matched, leaving the save button stuck in "Salvando…".
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
        console.error("[updateProfile] upsert error:", error);
        throw new Error(error.message || "Erro ao salvar perfil.");
      }
      if (updated) setProfile(updated as UserProfile);
    },
    [user, isGuest]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      loading,
      isGuest,
      signInWithGoogle,
      signInWithTwitter,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      continueAsGuest,
      updateProfile,
      refreshProfile,
    }),
    [
      user,
      profile,
      session,
      loading,
      isGuest,
      signInWithGoogle,
      signInWithTwitter,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      continueAsGuest,
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
