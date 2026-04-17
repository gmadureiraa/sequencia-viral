import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractContentFromUrl } from "@/lib/url-extractor";

describe("extractContentFromUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("bloqueia localhost e IP privado", async () => {
    await expect(extractContentFromUrl("http://localhost:3000")).rejects.toThrow(
      "Localhost URLs are not allowed"
    );
    await expect(extractContentFromUrl("http://192.168.0.1/admin")).rejects.toThrow(
      "Private network URLs are not allowed"
    );
    await expect(extractContentFromUrl("http://[::1]/")).rejects.toThrow(
      "Non-public URLs are not allowed"
    );
  });

  it("extrai conteúdo básico de html público", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          "<html><head><title>Artigo</title><meta name=\"description\" content=\"Resumo\" /></head><body><article><h1>Titulo</h1><p>Conteudo principal</p></article></body></html>",
      })
    );

    const result = await extractContentFromUrl("https://postflow.app/blog/teste");
    expect(result).toContain("Title: Artigo");
    expect(result).toContain("Description: Resumo");
    expect(result).toContain("Conteudo principal");
  });
});
