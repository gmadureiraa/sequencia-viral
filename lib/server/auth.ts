import { createClient, type User } from "@supabase/supabase-js";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

export function createServerSupabaseClient() {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export function createServiceRoleSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey);
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

/**
 * APIs custosas: exigem sessão Supabase válida (Authorization: Bearer).
 */
export async function requireAuthenticatedUser(
  request: Request
): Promise<
  { ok: true; user: User } | { ok: false; response: Response }
> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        {
          error:
            "Não autorizado. Envie o header Authorization: Bearer <access_token> da sua sessão.",
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user };
}
