import type { MetadataRoute } from "next";

const BASE_URL = "https://viral.kaleidos.com.br";

const blogSlugs = [
  "sequencia-viral-novidades-abril-2026-image-picker-pdf-export",
  "algoritmo-instagram-2026-como-funciona-o-que-mudou",
  "12-hooks-primeiro-slide-carrossel-parar-scroll",
  "como-criar-carrosseis-virais-instagram-2026",
  "storytelling-em-carrosseis-como-contar-historias-que-engajam",
  "5-formatos-carrossel-mais-engajamento",
  "copywriting-para-redes-sociais-guia-definitivo-2026",
  "thread-vs-carrossel-qual-funciona-melhor",
  "como-transformar-artigos-em-carrosseis-repurposing",
  "como-usar-ia-criar-conteudo-redes-sociais",
  "guia-completo-tamanhos-instagram-twitter-linkedin",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/roadmap`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...blogEntries,
  ];
}
