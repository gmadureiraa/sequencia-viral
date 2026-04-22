export type RoadmapStatus = "now" | "next" | "later";

export type RoadmapItem = {
  n: string;
  title: string;
  body: string;
  bullets: string[];
  status: RoadmapStatus;
  tag: string;
  rotate: string;
  color: string;
  pin: string;
};

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    n: "01",
    title: "MVP — Gerador Manual",
    body:
      "Hoje. Cole um link ou tema, escolha o brand kit e gere um carrossel pronto para postar.",
    bullets: [
      "Input por URL, texto ou tópico",
      "Editor visual com templates",
      "Export PNG / PDF / Instagram-ready",
    ],
    status: "now",
    tag: "MVP — rodando hoje",
    rotate: "-rotate-[2.2deg]",
    color: "#FFE8B0",
    pin: "#EC6000",
  },
  {
    n: "02",
    title: "RSS + Gatilhos Automáticos",
    body:
      "Conecte feeds, newsletters e sites. Cada novidade vira um rascunho de post seguindo sua voz.",
    bullets: [
      "Feeds RSS, Atom e newsletters",
      "Regras: 'se tópico X, gere carrossel Y'",
      "Rascunhos automáticos na fila",
    ],
    status: "next",
    tag: "Em desenvolvimento",
    rotate: "rotate-[1.8deg]",
    color: "#FFD4B0",
    pin: "#0A0A0A",
  },
  {
    n: "03",
    title: "Publicação Multi-Rede",
    body:
      "Publique direto em Instagram, LinkedIn, X e Threads. Agendamento, fila e re-publicação inteligente.",
    bullets: [
      "OAuth nativo das redes",
      "Calendário editorial drag-and-drop",
      "Best-time scheduler",
    ],
    status: "next",
    tag: "Em desenvolvimento",
    rotate: "-rotate-[1.4deg]",
    color: "#FFC79A",
    pin: "#EC6000",
  },
  {
    n: "04",
    title: "Brand Kits & Voz da Marca",
    body:
      "A voz da marca a gente já segue hoje — a IA escreve no seu tom desde o onboarding. O próximo passo: templates visuais também personalizados, com seu brand kit (cores, fontes, formas) vivo em cada slide.",
    bullets: [
      "Voz da marca já aprendida no onboarding ✓",
      "Em breve: templates visuais adaptados ao brand kit",
      "Múltiplos brand kits por workspace (agência)",
      "Treinamento com posts de referência seus",
    ],
    status: "next",
    tag: "Próximo sprint",
    rotate: "rotate-[2.4deg]",
    color: "#F5E8D0",
    pin: "#0A0A0A",
  },
  {
    n: "05",
    title: "Repurpose Engine",
    body:
      "Um insight → thread no X → post no LinkedIn → carrossel no Insta → newsletter. Sem digitar duas vezes.",
    bullets: [
      "Grafo de conteúdo (pai → filhos)",
      "Tradução automática PT/EN",
      "Sugestões de cortes para reels",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "-rotate-[2deg]",
    color: "#FFE0C2",
    pin: "#EC6000",
  },
  {
    n: "06",
    title: "Analytics & Learning Loop",
    body:
      "Entenda o que performa e feche o ciclo: a IA aprende com seus posts reais e ajusta sozinha.",
    bullets: [
      "Métricas nativas de cada rede no dashboard",
      "Alcance, salvamentos, engajamento e melhor horário",
      "Score de hook por post e recomendações automáticas",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "rotate-[1.2deg]",
    color: "#FFD8A8",
    pin: "#0A0A0A",
  },
  {
    n: "07",
    title: "Team & Aprovação",
    body:
      "Workspace multi-usuário com papéis, revisão e aprovação antes da publicação. Feito para agências.",
    bullets: [
      "Roles: owner, editor, revisor, cliente",
      "Comentários em cada rascunho",
      "Link público de aprovação",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "-rotate-[1.6deg]",
    color: "#FFE8B0",
    pin: "#EC6000",
  },
  {
    n: "08",
    title: "API & Integrações",
    body:
      "Webhooks, API pública e integração com n8n, Zapier e Make. Sequência Viral vira peça do seu stack.",
    bullets: [
      "REST + Webhooks",
      "n8n / Zapier / Make",
      "MCP server para agentes",
    ],
    status: "later",
    tag: "Futuro",
    rotate: "rotate-[2deg]",
    color: "#FFC79A",
    pin: "#0A0A0A",
  },
  {
    n: "09",
    title: "Múltiplos perfis",
    body:
      "Hoje: 1 perfil por usuário. Em breve: workspace multi-perfil pra quem gerencia várias marcas no mesmo login.",
    bullets: [
      "Switcher de perfil no header",
      "Brand kit separado por perfil",
      "Assinatura única cobre todos",
    ],
    status: "later",
    tag: "Em breve",
    rotate: "-rotate-[1.8deg]",
    color: "#FFE8B0",
    pin: "#EC6000",
  },
  {
    n: "10",
    title: "Galeria pública de carrosséis",
    body:
      "Página dedicada com dezenas de carrosséis reais gerados por criadores — filtrável por nicho, voz e template. Quem usou, quanto converteu.",
    bullets: [
      "Filtro por nicho e template",
      "Métricas reais (likes, salvos, comments)",
      "Permissão opt-in do criador",
    ],
    status: "later",
    tag: "Planejado",
    rotate: "rotate-[1.6deg]",
    color: "#FFD8A8",
    pin: "#0A0A0A",
  },
  {
    n: "11",
    title: "Planejamento (Calendário editorial)",
    body:
      "Calendário de conteúdo drag-and-drop. Organize sua sequência inteira do mês e publique direto no Instagram nos dias e horários certos — sem sair do Sequência Viral.",
    bullets: [
      "Arrastar carrosseis pro dia/horário",
      "Best time por engajamento do seu feed",
      "Fila de publicação direto no Instagram",
    ],
    status: "next",
    tag: "Em breve",
    rotate: "-rotate-[2deg]",
    color: "#FFE0C2",
    pin: "#EC6000",
  },
  {
    n: "12",
    title: "Piloto automático",
    body:
      "A IA cuida de tudo sozinha: cria conteúdo no seu DNA, agenda e publica no seu Instagram. Você só revisa e aprova se quiser, ou deixa rodar no piloto 100% auto.",
    bullets: [
      "IA gera conteúdo diário no seu tom",
      "Publicação automática com aprovação opcional",
      "Alertas quando algo precisa da sua revisão",
    ],
    status: "next",
    tag: "Em breve",
    rotate: "rotate-[1.4deg]",
    color: "#FFD4B0",
    pin: "#0A0A0A",
  },
];

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  now: "Agora",
  next: "Próximo",
  later: "Futuro",
};
