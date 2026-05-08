/**
 * Tipos compartilhados pra geração em massa do Piloto Automático.
 *
 * Job lifecycle:
 *   pending → running → completed | failed | cancelled
 *
 * Item lifecycle:
 *   pending → generating → completed | failed
 *
 * Worker (cron + on-demand) puxa items pending de jobs running, processa em
 * paralelo limitado (2 por user), atualiza progresso. UI faz polling.
 */

export type Cadence = "daily" | "alternating" | "weekly" | "custom";
export type ThemesMode = "explicit" | "auto-suggest";

export interface MassGenerationConfig {
  themesMode: ThemesMode;
  /** Quando themesMode='auto-suggest' inicia vazio e o creator do job preenche
   *  via suggestThemes(). Quando 'explicit' já vem com user input. */
  themes: string[];
  /** URLs IG/Twitter como contexto compartilhado por todos os carrosseis. */
  refs: string[];
  autoSchedule: boolean;
  cadence: Cadence;
  /** Usado quando cadence='custom'. Intervalo em dias entre carrosseis. */
  intervalDays?: number;
  /** Hora local de publicação. */
  publishHour: number;
  publishMinute: number;
  timezone: string;
  /** Default 'twitter' (único template estável em piloto auto hoje). */
  designTemplate: "twitter" | "manifesto";
  editorialLine?: string;
  niche?: string;
  tone?: string;
  language?: string;
  /** Plataformas alvo (Zernio). Default ['instagram','linkedin']. */
  targetPlatforms?: ("instagram" | "linkedin")[];
}

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ItemStatus = "pending" | "generating" | "completed" | "failed";

export interface MassGenerationJob {
  id: string;
  user_id: string;
  status: JobStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  config: MassGenerationConfig;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface MassGenerationItem {
  id: string;
  job_id: string;
  user_id: string;
  item_index: number;
  theme: string;
  status: ItemStatus;
  carousel_id: string | null;
  scheduled_post_id: string | null;
  scheduled_at: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface CreateJobInput {
  userId: string;
  totalCount: number;
  config: MassGenerationConfig;
}

export interface CreateJobResult {
  jobId: string;
  itemIds: string[];
}

/** Status retornado pelo GET pra UI polling. */
export interface JobProgressResponse {
  job: {
    id: string;
    status: JobStatus;
    totalCount: number;
    completedCount: number;
    failedCount: number;
    progressPct: number;
    error: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    config: Pick<
      MassGenerationConfig,
      "themesMode" | "autoSchedule" | "cadence" | "designTemplate"
    >;
  };
  items: Array<{
    id: string;
    index: number;
    theme: string;
    status: ItemStatus;
    carouselId: string | null;
    scheduledAt: string | null;
    error: string | null;
  }>;
}

export const MAX_BATCH_SIZE = 30;
export const DEFAULT_CONCURRENCY = 2;
