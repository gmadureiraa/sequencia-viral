/**
 * Helpers de spread de agendamento pra mass generation.
 *
 * Dado config.cadence + count, retorna array de Date com N timestamps
 * espaçados conforme regra:
 *   - 'daily':       1 carrossel/dia
 *   - 'alternating': 1 a cada 2 dias (dia sim, dia não)
 *   - 'weekly':      1 a cada 7 dias
 *   - 'custom':      1 a cada `intervalDays` dias
 *
 * Hora local: config.publishHour:publishMinute na timezone do user
 * (default America/Sao_Paulo). Datas são retornadas em UTC ISO.
 *
 * Start: amanhã (próximo dia útil às publishHour:00 local). Hoje fica
 * de fora pra dar tempo do worker rodar antes do agendamento bater.
 */

import type { Cadence } from "./types";

interface SpreadInput {
  count: number;
  cadence: Cadence;
  intervalDays?: number;
  publishHour: number;
  publishMinute: number;
  /** IANA tz name. Default 'America/Sao_Paulo'. */
  timezone?: string;
  /** Override do início (default: amanhã às publishHour local). */
  startAt?: Date;
}

const DEFAULT_TZ = "America/Sao_Paulo";

function intervalDaysFor(cadence: Cadence, customDays?: number): number {
  switch (cadence) {
    case "daily":
      return 1;
    case "alternating":
      return 2;
    case "weekly":
      return 7;
    case "custom":
      return Math.max(1, Math.min(customDays ?? 1, 30));
  }
}

/**
 * Converte hora local (em uma tz) pro instante UTC do mesmo dia.
 * Aproxima usando offset corrente — DST pode dar drift de 1h em datas
 * raras de transição. Aceitável pra agendamento de carrossel (não é
 * timing crítico de financeiro).
 */
function localTimeOnDateAsUtc(
  baseDay: Date,
  hour: number,
  minute: number,
  timezone: string
): Date {
  // Pega o offset da timezone hoje em ms.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  // Truque: cria timestamp UTC pro mesmo dia/hora e ajusta com offset
  // computando diff entre "agora UTC" e "agora local na tz".
  const yyyy = baseDay.getUTCFullYear();
  const mm = baseDay.getUTCMonth();
  const dd = baseDay.getUTCDate();

  // ms desde epoch UTC pra hora local na tz
  // 1) Cria date assumindo UTC
  const naiveUtc = Date.UTC(yyyy, mm, dd, hour, minute, 0);
  // 2) Mede a hora dessa date renderizada na tz alvo
  const renderedHour = parseInt(
    formatter.format(new Date(naiveUtc)),
    10
  );
  // 3) Ajusta: se na tz alvo essa date marcou hora X, e queremos hora Y,
  //    a diferença em ms é o offset.
  const hourDiff = renderedHour - hour;
  // Wrap: se renderedHour=23 e hour=0 → diff seria -23, mas na real é +1.
  let normalizedDiff = hourDiff;
  if (hourDiff > 12) normalizedDiff = hourDiff - 24;
  if (hourDiff < -12) normalizedDiff = hourDiff + 24;
  return new Date(naiveUtc - normalizedDiff * 60 * 60 * 1000);
}

export function computeScheduleSpread(input: SpreadInput): Date[] {
  const {
    count,
    cadence,
    intervalDays,
    publishHour,
    publishMinute,
    timezone = DEFAULT_TZ,
  } = input;

  if (count < 1) return [];

  const stepDays = intervalDaysFor(cadence, intervalDays);

  // Default start: amanhã
  let startDay: Date;
  if (input.startAt) {
    startDay = new Date(input.startAt);
  } else {
    const now = new Date();
    startDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
  }

  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const day = new Date(startDay);
    day.setUTCDate(day.getUTCDate() + i * stepDays);
    const scheduledUtc = localTimeOnDateAsUtc(
      day,
      publishHour,
      publishMinute,
      timezone
    );
    dates.push(scheduledUtc);
  }
  return dates;
}

/**
 * Helper amigável pra UI mostrar preview do spread antes do user confirmar.
 * Retorna strings tipo "Sex 09/05 às 09:00 BRT".
 */
export function formatScheduleSpreadPreview(
  dates: Date[],
  timezone: string = DEFAULT_TZ,
  locale: string = "pt-BR"
): string[] {
  return dates.map((d) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  );
}
