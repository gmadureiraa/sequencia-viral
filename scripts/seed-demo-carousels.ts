/**
 * Insere carrosséis de demonstração na biblioteca de um usuário (Supabase).
 * Não chama IA — só dados de exemplo para você ver layout, fontes e preview.
 *
 * Uso:
 *   cd postflow
 *   export $(grep -v '^#' .env.local | xargs)   # ou defina manualmente
 *   SEED_USER_ID=<uuid-do-auth> npx tsx scripts/seed-demo-carousels.ts
 *
 * Opcional: SEED_USER_EMAIL=seu@email.com (busca o UUID no Auth; exige service role)
 *
 * Obtém o UUID em: Supabase → Authentication → Users
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const explicitUserId = process.env.SEED_USER_ID?.trim();
const email = process.env.SEED_USER_EMAIL?.trim();

type Slide = {
  heading: string;
  body: string;
  imageQuery: string;
  imageUrl?: string;
};

type Demo = {
  title: string;
  variationStyle: "data" | "story" | "provocative";
  slideStyle: "white" | "dark";
  slides: Slide[];
};

const IMG = {
  capa: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1080&q=80",
  dados: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&q=80",
  pessoa: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&q=80",
  time: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1080&q=80",
};

const DEMOS: Demo[] = [
  {
    title: "Demo · Baseado em dados",
    variationStyle: "data",
    slideStyle: "white",
    slides: [
      {
        heading: "O que os números mostram em 2026",
        body: "Creators que postam **carrosséis** 3x por semana relatam mais alcance orgânico do que só Reels isolados — segundo levantamentos de mercado.",
        imageQuery: "analytics dashboard creative workspace",
        imageUrl: IMG.capa,
      },
      {
        heading: "Métrica que importa",
        body: "**Salvar** e **compartilhar** pesam mais que curtida solta para o algoritmo de descoberta. Foque em slides que as pessoas querem guardar.",
        imageQuery: "data charts growth",
        imageUrl: IMG.dados,
      },
      {
        heading: "Próximo passo",
        body: "Teste um gancho com número na capa e um CTA claro no último slide. Meça por uma semana e compare com o formato anterior.",
        imageQuery: "notebook planning coffee",
        imageUrl: IMG.time,
      },
    ],
  },
  {
    title: "Demo · Narrativa",
    variationStyle: "story",
    slideStyle: "dark",
    slides: [
      {
        heading: "Começou com um post que quase ninguém viu",
        body: "Eu achava que o problema era a frequência. Na verdade era **a história** — ninguém sabia por que deveria me seguir.",
        imageQuery: "writer desk night lamp",
        imageUrl: IMG.pessoa,
      },
      {
        heading: "O que mudou",
        body: "Passei a abrir com tensão (problema) e fechar com uma vitória pequena que o leitor pode copiar. O formato carrossel deu espaço pra respirar a narrativa.",
        imageQuery: "storytelling notebook",
        imageUrl: IMG.time,
      },
      {
        heading: "Se você leu até aqui",
        body: "Salva esse slide e testa o mesmo arco na sua próxima sequência. A consistência importa mais que a perfeição.",
        imageQuery: "community hands teamwork",
        imageUrl: IMG.capa,
      },
    ],
  },
  {
    title: "Demo · Provocativo",
    variationStyle: "provocative",
    slideStyle: "white",
    slides: [
      {
        heading: "Pare de pedir “engajamento”",
        body: "Se o conteúdo precisa de **“comenta SIM”** pra funcionar, o problema não é o algoritmo — é a ideia.",
        imageQuery: "bold minimal orange accent",
        imageUrl: IMG.dados,
      },
      {
        heading: "O carrossel não é desculpa pra enrolar",
        body: "Cada slide é um argumento. Se repete o mesmo de cinco jeitos, o público some antes do CTA.",
        imageQuery: "attention minimalist",
        imageUrl: IMG.capa,
      },
      {
        heading: "O que fazer hoje",
        body: "Corta uma ideia ao meio. Publica a parte mais incômoda na **capa** e entrega a solução no fechamento.",
        imageQuery: "decision crossroads",
        imageUrl: IMG.pessoa,
      },
    ],
  },
];

async function resolveUserId(): Promise<string | null> {
  if (explicitUserId) return explicitUserId;
  if (!email || !url || !serviceKey) return null;

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find(
      (x) => x.email?.toLowerCase() === email.toLowerCase()
    );
    if (u) return u.id;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}

async function main() {
  if (!url || !serviceKey) {
    console.error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: do .env.local)."
    );
    process.exit(1);
  }

  const userId = await resolveUserId();
  if (!userId) {
    console.error(
      "Passe SEED_USER_ID=<uuid> ou SEED_USER_EMAIL=... com usuário existente no Auth."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const demo of DEMOS) {
    const style = {
      slideStyle: demo.slideStyle,
      variation: {
        title: demo.title,
        style: demo.variationStyle,
      },
      design_template: "twitter",
      creation_mode: "quick",
    };

    const { data, error } = await supabase
      .from("carousels")
      .insert({
        user_id: userId,
        title: demo.title,
        slides: demo.slides,
        style,
        status: "draft",
      })
      .select("id, title")
      .single();

    if (error) {
      console.error(`Erro ao inserir "${demo.title}":`, error.message);
      process.exit(1);
    }
    console.log(`OK — ${data.title} (${data.id})`);
  }

  console.log("\nPronto. Abra /app/carousels logado como esse usuário.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
