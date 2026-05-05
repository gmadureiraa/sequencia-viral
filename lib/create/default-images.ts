/**
 * Imagens curadas por template visual. Quando o usuário seleciona um template
 * no passo `/app/create/[id]/templates`, pré-popula `slide.imageUrl` com uma
 * rotação round-robin destas URLs pra slides que não têm imagem ainda.
 *
 * Fonte: Unsplash (hotlink direto, sem key necessária). Cada URL já vem com
 * parâmetros pra tamanho razoável (w=1600) e cover.
 */

import type { TemplateId } from "@/components/app/templates/types";

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=75`;

/**
 * Manifesto — editorial preto/branco, jornal vintage, texturas, abstrato
 * dramático.
 */
const MANIFESTO: string[] = [
  IMG("photo-1506784365847-bbad939e9335"), // livros empilhados b&w
  IMG("photo-1519681393784-d120267933ba"), // paisagem dramática b&w
  IMG("photo-1499856871958-5b9627545d1a"), // newspaper close
  IMG("photo-1481627834876-b7833e8f5570"), // typography
  IMG("photo-1495020689067-958852a7765e"), // jornal antigo
  IMG("photo-1527689368864-3a821dbccc34"), // cidade noturna b&w
  IMG("photo-1475938476802-32a7e851dad1"), // arquitetura abstrata
  IMG("photo-1470093851219-69951fcbb533"), // abstract dark
  IMG("photo-1518779578993-ec3579fee39f"), // matte texture
  IMG("photo-1453928582365-b6ad33cbcf64"), // typography grande
];

/**
 * Futurista — tech, neon, abstract data, chips, geometria digital.
 */
const FUTURISTA: string[] = [
  IMG("photo-1451187580459-43490279c0fa"), // cyan data globe
  IMG("photo-1518770660439-4636190af475"), // circuit board
  IMG("photo-1550751827-4bd374c3f58b"), // neon abstract
  IMG("photo-1635070041078-e363dbe005cb"), // circuit macro
  IMG("photo-1526374965328-7f61d4dc18c5"), // code lines
  IMG("photo-1639762681485-074b7f938ba0"), // tech glow
  IMG("photo-1620712943543-bcc4688e7485"), // server green
  IMG("photo-1558494949-ef010cbdcc31"), // data viz teal
  IMG("photo-1581091226825-a6a2a5aee158"), // hands on laptop dark
  IMG("photo-1531746790731-6c087fecd65a"), // neon grid
];

/**
 * Autoral — fotografias artísticas, lifestyle editorial, polaroid/analogue feel.
 */
const AUTORAL: string[] = [
  IMG("photo-1502691876148-a84978e59af8"), // polaroid feel
  IMG("photo-1501785888041-af3ef285b470"), // natureza cinemática
  IMG("photo-1516302752625-fcc3c50ae61f"), // retrato autoral
  IMG("photo-1519682337058-a94d519337bc"), // street editorial
  IMG("photo-1490730141103-6cac27aaab94"), // cena artística rosa
  IMG("photo-1445205170230-053b83016050"), // livro+flores
  IMG("photo-1469334031218-e382a71b716b"), // sombra editorial
  IMG("photo-1511671782779-c97d3d27a1d4"), // moda editorial
  IMG("photo-1491933382434-500287f9b54b"), // collage
  IMG("photo-1500964757637-c85e8a162699"), // texturas pasteis
];

/**
 * Twitter v2 — minimalista, cores suaves, gráficos simples, palettes claras.
 */
const TWITTER: string[] = [
  IMG("photo-1551288049-bebda4e38f71"), // dashboard limpo
  IMG("photo-1559526324-4b87b5e36e44"), // grafo azul suave
  IMG("photo-1460925895917-afdab827c52f"), // analytics
  IMG("photo-1543286386-713bdd548da4"), // laptop + café
  IMG("photo-1522252234503-e356532cafd5"), // workspace claro
  IMG("photo-1571171637578-41bc2dd41cd2"), // stat card
  IMG("photo-1498050108023-c5249f4df085"), // code minimalista
  IMG("photo-1556761175-5973dc0f32e7"), // social graphics
  IMG("photo-1504868584819-f8e8b4b6d7e3"), // pastel editorial
  IMG("photo-1587440871875-191322ee64b0"), // blue minimal
];

/**
 * Ambitious — fotografia cinemática/lifestyle moody inspirando disciplina,
 * foco, rotina premium noturna (ref: @anajords).
 */
const AMBITIOUS: string[] = [
  IMG("photo-1498049794561-7780e7231661"), // keyboard close warm
  IMG("photo-1504196606672-aef5c9cefc92"), // coffee + laptop dark
  IMG("photo-1491497895121-1334fc14d8c9"), // book reading mood
  IMG("photo-1519682337058-a94d519337bc"), // street editorial
  IMG("photo-1522071820081-009f0129c71c"), // people focus work
  IMG("photo-1523240795612-9a054b0db644"), // watch detail macro
  IMG("photo-1483389127117-b6a2102724ae"), // city lights night
  IMG("photo-1507842217343-583bb7270b66"), // luxury notebook
  IMG("photo-1526045478516-99145907023c"), // espresso + paper
  IMG("photo-1511376777868-611b54f68947"), // gym / training low light
];

/**
 * Blank Editorial — revista intelectual, cabana, escrita, livros, natureza,
 * sessão de estudo (ref: @blankschoolbr).
 */
const BLANK: string[] = [
  IMG("photo-1519681393784-d120267933ba"), // landscape mountain mood
  IMG("photo-1455390582262-044cdead277a"), // notebook + handwritten
  IMG("photo-1481627834876-b7833e8f5570"), // editorial typography
  IMG("photo-1456513080510-7bf3a84b82f8"), // man outdoor portrait
  IMG("photo-1516979187457-637abb4f9353"), // notebook writing
  IMG("photo-1499209974431-9dddcece7f88"), // log cabin editorial
  IMG("photo-1589395937772-f67057e233df"), // cozy study
  IMG("photo-1505063366573-38928ae5567e"), // camera tripod
  IMG("photo-1486329819088-9bc2ee5c1f50"), // man reading cabin
  IMG("photo-1513623935135-c896b59073c1"), // field creative
];

/**
 * Bohdan — fotografia design-forward B&W contraste alto: designer no
 * estúdio, mockups, esboços, retratos editoriais (ref: @jeremybohdan).
 */
const BOHDAN: string[] = [
  IMG("photo-1494389945381-d9b18b9a2cef"), // dramatic portrait B&W
  IMG("photo-1542038784456-1ea8e935640e"), // designer hands sketching
  IMG("photo-1455849318743-b2233052fcff"), // editorial portrait
  IMG("photo-1517649763962-0c623066013b"), // model contrast shadow
  IMG("photo-1453928582365-b6ad33cbcf64"), // creative studio detail
  IMG("photo-1491895200222-0fc4a4c35e18"), // designer at desk B&W
  IMG("photo-1542736667-069246bdbc6d"), // mockups flat lay
  IMG("photo-1503342217505-b0a15ec3261c"), // intense portrait close
  IMG("photo-1516214104703-d870798883c5"), // hands typing dramatic
  IMG("photo-1517363898874-737b62a7db91"), // creative lab B&W
];

/**
 * Paper Mono — fotos B&W documentais, intimistas, candid.
 * Cadeira vazia, mão no teclado, founder de costas, bastidor real.
 */
const PAPER_MONO: string[] = [
  IMG("photo-1455849318743-b2233052fcff"), // editorial portrait B&W
  IMG("photo-1542038784456-1ea8e935640e"), // hands sketching
  IMG("photo-1494389945381-d9b18b9a2cef"), // dramatic portrait B&W
  IMG("photo-1516214104703-d870798883c5"), // hands typing dramatic
  IMG("photo-1453928582365-b6ad33cbcf64"), // creative studio detail
  IMG("photo-1481627834876-b7833e8f5570"), // editorial typography
  IMG("photo-1499856871958-5b9627545d1a"), // newspaper close
  IMG("photo-1517363898874-737b62a7db91"), // creative lab B&W
];

const POOLS: Record<TemplateId, string[]> = {
  manifesto: MANIFESTO,
  futurista: FUTURISTA,
  autoral: AUTORAL,
  twitter: TWITTER,
  ambitious: AMBITIOUS,
  blank: BLANK,
  bohdan: BOHDAN,
  "paper-mono": PAPER_MONO,
  // Madureira reaproveita pool do Futurista — paleta navy + accent verde
  // gera prompts com o mesmo style guide cinematográfico.
  madureira: FUTURISTA,
};

/**
 * Retorna as URLs padrão pra um template em round-robin, com `count` imagens.
 */
export function defaultImagesForTemplate(
  templateId: TemplateId,
  count: number
): string[] {
  const pool = POOLS[templateId] ?? MANIFESTO;
  if (pool.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[i % pool.length]);
  }
  return out;
}

export function firstDefaultImage(templateId: TemplateId): string | undefined {
  return POOLS[templateId]?.[0];
}
