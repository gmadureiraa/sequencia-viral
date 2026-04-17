# Editor do carrossel — Super Plano

> O que está funcionando, o que tá ruim, e exatamente como deixar incrível.
> Referência visual: **Defiverso** (avatar circular + nome + verified + heading bold + body + imagem grande).
> Canva: https://canva.link/w7zs8fjarxlr0m3

---

## ✅ O que já está pronto (verificado nesta sessão)

- **Claude 4.6 funcionando** — model ID corrigido (`claude-sonnet-4-6`), créditos validados end-to-end
- **Saída em português brasileiro forçada** — `languageInstruction` dinâmico no system prompt, bloqueia inglês se `language: pt-br`
- **Auto-fetch de imagens durante geração** — `POST /api/generate` agora chama `/api/images` em paralelo (Promise.allSettled, dedupe de queries) e injeta `imageUrl` em cada slide antes de retornar. Usuário não precisa mais clicar "buscar imagens" depois de gerar
- **Slide visual atualizado** — padrão Defiverso:
  - Avatar 48×48 circular laranja gradient (ou branco em dark mode)
  - Nome bold 16px + verified blue Twitter ✓ + handle em cinza
  - Heading com **suporte a markdown bold** (`**texto**` → `<strong>`)
  - Body respeita bold inline também
  - Imagem full-width rounded 14px sem framing cream
  - Footer compacto com wordmark POSTFLOW + arrow circular preto
  - Font stack: SF Pro Display + Helvetica Neue + Inter
- **Loader laranja + AI text loading laranja** enquanto gera
- **Novo login** two-column card v0 template, OAuth Google + X funcionando

---

## 🚧 Problemas atuais do editor (confirmados pelo usuário)

1. **Editor não puxa imagens automaticamente** → ✅ resolvido nesta sessão (auto-fetch)
2. **Gerava conteúdo em inglês** → ✅ resolvido (languageInstruction PT-BR)
3. **Não dá pra subir imagem custom** → 🔴 pendente
4. **Não dá pra remover imagem** → 🔴 pendente
5. **Edição inline travada** — título e body não editáveis diretamente
6. **Slide não seguia padrão Defiverso** → ✅ resolvido (novo `carousel-slide.tsx`)
7. **Regerar só uma slide** — não existe
8. **Regerar só uma imagem** — não existe (mas agora puxa no auto-fetch)
9. **Reordenar slides** — parcial (existe mas ruim de usar)
10. **Preview não atualiza em tempo real** — usuário edita e precisa clicar "salvar"

---

## 🎯 P0 — Funcionalidades que tornam o editor incrível

### 1. Edição inline de texto (título + body)
**Como:**
- Transformar o heading + body em `contentEditable="true"` OU usar um `<textarea>` escondido com estilo idêntico
- `onBlur` → atualiza state local → debounce 800ms → `upsertUserCarousel(supabase, user.id, ...)` pra persistir
- Suporte a **markdown bold inline** (`**texto**`): o componente `CarouselSlide` já suporta renderização, basta salvar o texto raw com `**`
- Atalho visual: quando clicar no heading, mostrar um mini-toolbar flutuante com botão "B" pra wrap em `**...**`

**Arquivos:**
- `app/app/create/page.tsx` — step `"edit"` tem o loop dos slides
- Extrair `<EditableSlide>` pra `components/app/editable-slide.tsx` (wrapper de `CarouselSlide` com estado local)
- `lib/carousel-storage.ts` — já tem `upsertUserCarousel`, só chamar com debounce

**Granularidade:**
- Heading: input inline com placeholder "Toque pra editar"
- Body: textarea inline com autosize (react-textarea-autosize ou `style={{ resize: "none", field-sizing: "content" }}`)
- Persistência: a cada 800ms de idle, toast sutil "Salvo" no canto

### 2. Upload de imagem custom
**Backend:**
- Criar rota `POST /api/upload` que recebe `multipart/form-data` com `file` + `slot` (ex: `slide-3`)
- Upload pro Supabase Storage bucket `carousel-images` (criar bucket se não existir, policy "authenticated write")
- Retorna `{ url: string }` — usa `supabase.storage.from('carousel-images').getPublicUrl(path)`
- Rate limit 20 uploads/hora por user

**Frontend:**
- No slide, hover mostra overlay: ícones **Upload** + **Swap** + **Remove** + **Regenerate**
- Click em Upload → `<input type="file" accept="image/*">` invisível → POST pro `/api/upload` → troca `imageUrl` do slide → persiste
- **Drag-and-drop** direto na área da imagem (usando `react-dropzone` ou handlers nativos `onDragOver`/`onDrop`)
- Progress bar durante upload

### 3. Remover imagem
- Mesmo overlay do hover, ícone X
- Ao remover: `slide.imageUrl = undefined` → re-render mostra placeholder com prompt "Clique pra adicionar imagem"

### 4. Trocar imagem (re-buscar ou gerar nova)
Popup menu "Substituir imagem" com 3 opções:
- **Buscar de novo** (Serper): usa o mesmo `imageQuery` mas retorna 10 opções — modal com grid 3×3 pra escolher uma
- **Gerar com IA** (Gemini): input editável com o prompt pré-preenchido → usuário ajusta → chama `/api/images/generate` (criar rota) → recebe URL do Gemini → troca
- **Fazer upload** (mesmo fluxo do item 2)

### 5. Regerar só um slide
- Botão "Regenerar slide" no overlay de cada slide
- Chama `/api/generate/slide` (criar rota nova) passando: `variation`, `slideIndex`, `previousSlides` (pra contexto), `keepImage` (bool)
- Backend chama Claude com prompt focado nesse slide específico + contexto

### 6. Reordenar slides (drag-and-drop)
- Usar `@dnd-kit/sortable` (mais leve que react-beautiful-dnd e mantido)
- Cards ficam "agarráveis" pelo handle (grip icon top-left)
- Persiste nova ordem com debounce

### 7. Adicionar slide novo
- Botão "+" entre slides (aparece no hover do gap)
- Gera slide vazio OU chama Claude com contexto "adicione um slide entre o X e o Y"

### 8. Deletar slide
- Botão trash no overlay → confirmação inline → remove do array

### 9. Undo/Redo
- `useHistory` hook com pilha de estados (max 50)
- Atalhos Cmd+Z / Cmd+Shift+Z

### 10. Preview ao vivo
- Todas as edições já atualizam state local imediatamente — preview reage
- Debounce 800ms só pra PERSISTÊNCIA, não pra UI

---

## 🎨 P1 — Refinamento visual do slide

Já implementado nesta sessão, mas vale revisar depois:

- [ ] Se o user tiver `profile.avatar_url` real, puxar e exibir no avatar do slide
- [ ] Nome dinâmico: usar `profile.name || "Seu nome"`
- [ ] Handle dinâmico: `profile.twitter_handle ? "@" + handle : "@seuhandle"`
- [ ] Opção de **esconder o verified check** nas settings (nem todo mundo tem Twitter verificado)
- [ ] Opção de **trocar cor do avatar** (gradient laranja padrão, mas custom pode ser preto, roxo, etc)
- [ ] **Estilos de slide** pré-definidos (como já existem: white/dark) — adicionar: twitter-light, twitter-dark, tiktok, linkedin
- [ ] Toggle "mostrar POSTFLOW footer" — usuário pode esconder pra feed mais clean

---

## 🧩 P1.5 — Melhorias no prompt do Claude

Pra outputs ainda melhores em português:
- [ ] Passar **profile real** do usuário (bio, últimos posts, nicho REAL) no system prompt, não só as flags
- [ ] **Few-shot examples** com 2-3 carrosseis brasileiros bem feitos (Defiverso, Madureira) direto no prompt
- [ ] Instruir pra **usar `**bold**`** em palavras chave do heading, igual Defiverso faz
- [ ] Cap de 25 palavras por body pra forçar concisão
- [ ] `imageQuery` deve vir em **inglês SEMPRE** (Serper performa melhor em inglês)

---

## 📦 P2 — Polish que impressiona

- [ ] **Templates salvos** — usuário pode salvar o layout/estilo atual como template reusável
- [ ] **Histórico de versões** — cada save cria um snapshot, user pode reverter
- [ ] **Comentários** (futuro multi-user) — quando tiver Business com seats
- [ ] **Agendamento integrado** — escolher data/hora e fica na fila (depende do P0 de publicação real)
- [ ] **Analytics inline** — quando o post for publicado, mostrar métricas direto no card (P2 do roadmap)
- [ ] **Export PDF** — botão além de PNG
- [ ] **Export zip** — zip com todos os slides em alta
- [ ] **Copy to clipboard** — botão "copiar texto" por slide (útil pra colar em legendas)
- [ ] **Preview instagram real** — tela cheia simulando feed do Instagram (swipe horizontal like the real app)

---

## 🏗 Ordem de execução recomendada

**Sprint 1 (2 horas):** Edição inline de texto + persistência com debounce
**Sprint 2 (2 horas):** Upload + remove + drag-drop de imagens
**Sprint 3 (1.5 hora):** Trocar imagem (Serper re-search + Gemini generate)
**Sprint 4 (1.5 hora):** Reordenar + adicionar + deletar slide + undo/redo
**Sprint 5 (1 hora):** Refinar prompt Claude com profile real + few-shot
**Sprint 6 (1 hora):** Export PDF + zip + copy to clipboard

Total: ~9 horas pra editor incrível end-to-end.

---

## 🔌 Dependências novas a instalar

```bash
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
bun add react-textarea-autosize
```

Opcional (pra PDF):
```bash
bun add jspdf html2canvas
```

---

## 🗄 Estrutura Supabase necessária

```sql
-- Storage bucket
insert into storage.buckets (id, name, public)
values ('carousel-images', 'carousel-images', true);

-- Policy: authenticated can upload to their own folder
create policy "Users can upload own carousel images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'carousel-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: public read
create policy "Carousel images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'carousel-images');
```

Path convention: `{user_id}/{carousel_id}/{slide_index}-{timestamp}.{ext}`
