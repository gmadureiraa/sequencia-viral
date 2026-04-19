import { createClient, type User } from "@supabase/supabase-js";

/**
 * Emails com acesso ao painel admin (/app/admin). Lista hardcoded pra
 * MVP — quando crescer, migrar pra coluna profiles.is_admin.
 */
export const ADMIN_EMAILS: readonly string[] = [
  "gf.madureiraa@gmail.com",
  "gf.madureira@hotmail.com",
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

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
  if (!url || !serviceRoleKey) {
    if (!url) console.warn("[auth] createServiceRoleSupabaseClient: NEXT_PUBLIC_SUPABASE_URL is missing");
    if (!serviceRoleKey) console.warn("[auth] createServiceRoleSupabaseClient: SUPABASE_SERVICE_ROLE_KEY is missing");
    return null;
  }
  return createClient(url, serviceRoleKey);
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Valida o bearer token bateando no Auth Server da Supabase via service
 * role (auth.admin.getUser). Diferente de anon_client.auth.getUser que
 * só valida assinatura local, isso rejeita tokens de usuários que foram
 * DELETADOS ou BANIDOS — fundamental pra /api/auth/delete fechar o loop.
 */
async function validateTokenServerSide(token: string): Promise<User | null> {
  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    // Fallback: se service role não estiver configurado, cai no anon.
    // (não ideal, mas evita quebrar totalmente em ambientes dev incompletos).
    const anon = createServerSupabaseClient();
    if (!anon) return null;
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  return validateTokenServerSide(token);
}

/**
 * APIs custosas: exigem sessão Supabase válida (Authorization: Bearer).
 * Usa validação server-side via service role — sessão revogada é detectada.
 */
export async function requireAuthenticatedUser(
  request: Request
): Promise<
  { ok: true; user: User } | { ok: false; response: Response }
> {
  const token = getBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: Response.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 }
      ),
    };
  }

  const user = await validateTokenServerSide(token);
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "Sessão inválida ou expirada. Faça logout e login novamente." },
        { status: 401 }
      ),
    };
  }

  return { ok: true, user };
}

/**
 * Gate pra rotas admin. Requer usuário autenticado COM email na lista
 * ADMIN_EMAILS. Qualquer outro retorna 403. Uso:
 *
 *   const admin = await requireAdmin(request);
 *   if (!admin.ok) return admin.response;
 *   const { user } = admin;
 */
export async function requireAdmin(
  request: Request
): Promise<{ ok: true; user: User } | { ok: false; response: Response }> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;
  if (!isAdminEmail(auth.user.email ?? null)) {
    return {
      ok: false,
      response: Response.json({ error: "Acesso negado." }, { status: 403 }),
    };
  }
  return { ok: true, user: auth.user };
}
