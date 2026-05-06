import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de uso — Sequência Viral",
  description:
    "Termos de uso do Sequência Viral: jurisdição, propriedade intelectual dos carrosséis, cancelamento e responsabilidade.",
  alternates: { canonical: "https://viral.kaleidos.com.br/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] px-5 py-16 text-[#0A0A0A]">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#6B6960]">
          Legal
        </p>
        <h1
          className="mt-2 text-4xl"
          style={{ fontFamily: "Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}
        >
          Termos de uso
        </h1>
        <p className="mt-4 text-sm text-[#6B6960]">Última atualização: 22 de abril de 2026.</p>

        <Section title="1. Sobre o serviço">
          O Sequência Viral (&quot;Serviço&quot;) é um produto da Kaleidos Digital
          (&quot;Kaleidos&quot;, &quot;nós&quot;), CNPJ brasileiro, que oferece geração de
          carrosséis com IA via web app em{" "}
          <a className="underline" href="https://viral.kaleidos.com.br">
            viral.kaleidos.com.br
          </a>
          . Ao criar conta ou utilizar qualquer funcionalidade, você
          (&quot;Usuário&quot;) concorda com estes Termos.
        </Section>

        <Section title="2. Jurisdição e lei aplicável">
          O contrato é regido pelas leis da República Federativa do Brasil.
          Qualquer controvérsia será resolvida no foro da comarca de São José dos
          Campos/SP, salvo regra legal que atribua competência a outro juízo.
        </Section>

        <Section title="3. Propriedade intelectual do conteúdo gerado">
          <p>
            Todo carrossel, texto, imagem ou PNG exportado pelo Usuário através
            do Serviço é <b>de propriedade do Usuário</b>. Pode ser usado sem
            restrição para fins pessoais, clientes de agência, revenda ou
            qualquer outro uso lícito.
          </p>
          <p className="mt-3">
            A Kaleidos mantém a propriedade da ferramenta em si (software, marca,
            identidade visual &quot;Sequência Viral&quot; e &quot;Kaleidos&quot;). É
            vedado republicar o produto como se fosse seu ou utilizar nossas
            marcas sem autorização por escrito.
          </p>
        </Section>

        <Section title="4. Planos, cobrança e cancelamento">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Planos vigentes: Grátis, Creator (R$ 49,90/mês de lançamento,
              anchor R$ 99,90) e Pro (R$ 97,90/mês de lançamento, anchor
              R$ 199,90). Preços visíveis na{" "}
              <Link href="/#pricing" className="underline">
                página de pricing
              </Link>{" "}
              podem ser reajustados com aviso prévio de 30 dias a assinantes
              ativos.
            </li>
            <li>
              Sem fidelidade. O Usuário pode cancelar a qualquer momento pelo
              painel em 2 cliques.
            </li>
            <li>
              Cancelamento no plano <b>Max</b>: fazemos rateio proporcional dos
              dias não utilizados dentro do ciclo vigente.
            </li>
            <li>
              Cancelamento no plano <b>Pro</b>: o mês em curso segue ativo
              até o próximo ciclo, depois não renova.
            </li>
            <li>
              Cupons e descontos promocionais (como &quot;VIRAL50&quot;) são
              aplicados apenas ao primeiro pagamento, salvo indicação em
              contrário.
            </li>
          </ul>
        </Section>

        <Section title="5. Responsabilidade">
          <p>
            O Serviço é fornecido &quot;no estado em que se encontra&quot;.
            Empregamos esforços razoáveis para uptime, qualidade de geração e
            precisão, mas <b>não garantimos</b>:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Que o conteúdo gerado atingirá metas de engajamento, alcance ou conversão em qualquer rede social.</li>
            <li>Viralização, crescimento de seguidores ou resultados comerciais específicos.</li>
            <li>Disponibilidade ininterrupta de provedores externos (Google, OpenAI, Anthropic, Stripe, Supabase etc.).</li>
          </ul>
          <p className="mt-3">
            O Usuário é responsável pelo conteúdo que publica em redes sociais
            e pela conformidade com leis brasileiras de publicidade, direitos
            autorais, marcas e regras das plataformas de destino.
          </p>
        </Section>

        <Section title="6. Uso aceitável">
          <p>É vedado utilizar o Serviço para:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Gerar conteúdo ilícito, discurso de ódio, apologia à violência ou desinformação.</li>
            <li>Violar direitos autorais ou marca registrada de terceiros.</li>
            <li>Realizar engenharia reversa, scraping abusivo ou revender acesso à API sem contrato.</li>
          </ul>
          <p className="mt-3">
            Podemos suspender ou encerrar contas em caso de abuso, fraude,
            chargeback indevido ou violação destes Termos, sem reembolso quando
            a violação for comprovada.
          </p>
        </Section>

        <Section title="7. Dados pessoais">
          O tratamento de dados pessoais segue a{" "}
          <Link href="/privacy" className="underline">
            Política de Privacidade
          </Link>
          . Para excluir seus dados, acesse{" "}
          <Link href="/account/data-deletion" className="underline">
            /account/data-deletion
          </Link>{" "}
          ou envie pedido pelo WhatsApp de suporte.
        </Section>

        <Section title="8. Alterações destes Termos">
          Podemos atualizar estes Termos a qualquer momento. Alterações
          materiais serão comunicadas por email ao Usuário logado. O uso
          continuado após a comunicação implica concordância com a nova versão.
        </Section>

        <Section title="9. Contato">
          Dúvidas sobre estes Termos podem ser enviadas pelo WhatsApp de
          suporte:{" "}
          <a
            href="https://wa.me/5512936180547"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            +55 12 93618-0547
          </a>
          .
        </Section>

        <Link
          href="/"
          className="mt-12 inline-block text-sm font-bold text-[#0A0A0A] underline underline-offset-4"
        >
          ← Voltar ao site
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2
        className="text-xl"
        style={{ fontFamily: "Georgia, serif", fontWeight: 400, letterSpacing: "-0.015em" }}
      >
        {title}
      </h2>
      <div className="mt-3 text-sm leading-relaxed text-[#2A2A2A]">{children}</div>
    </section>
  );
}
