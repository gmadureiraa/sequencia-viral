"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Hook leve pra landing/blog/marketing: consulta a session do Supabase no cliente
 * e devolve um flag `isLoggedIn`. Não precisa do `AuthProvider` (que está só no
 * shell `/app/*`) — usa o mesmo storage, então reconhece qualquer user logado.
 */
export function useLandingSession(): {
  isLoggedIn: boolean;
  email: string | null;
  loading: boolean;
} {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      if (mounted) setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user.email ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { isLoggedIn: !!email, email, loading };
}
