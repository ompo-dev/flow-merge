import { PUBLIC_ROUTE_COPY, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

interface PublicSemanticContentProps {
  route: keyof typeof PUBLIC_ROUTE_COPY;
}

const HOME_SECTIONS = [
  {
    title: "O que e o Flow Merge",
    body: "Flow Merge une automacao, analytics e resposta operacional no mesmo canvas para founders tecnicos, indie hackers e micro-SaaS.",
  },
  {
    title: "Como o produto funciona",
    body: "O workspace e local-first. Workflows, nodes, runtime stores e artefatos ficam locais no browser ou no desktop; o backend guarda apenas identidade, sessao, licenca e metadata minima de billing.",
  },
  {
    title: "Casos de uso principais",
    body: "Os loops centrais do produto cobrem logs e erros com impacto em receita, funil e A/B na mesma superficie de decisao, e padroes comportamentais que viram acao comercial contextual.",
  },
  {
    title: "Modelo comercial",
    body: "O trial dura 14 dias. O Pro Mensal custa R$89 por ciclo com PIX manual e o Founder Lifetime custa R$1.068 em pagamento unico via PIX.",
  },
];

const LEGAL_SECTIONS = [
  {
    title: "Aceite e acesso",
    body: "Ao entrar com Google e iniciar sessao no Flow Merge, o usuario aceita os termos de uso para a versao web e para a versao desktop.",
  },
  {
    title: "Privacidade e dados",
    body: "O produto e local-first por padrao. O backend comercial recebe somente identidade, sessao, licenca, estado de acesso e metadata minima das cobrancas.",
  },
  {
    title: "Responsabilidade operacional",
    body: "Sugestoes de IA, automacoes, cupons, alertas e acoes seguem sob revisao e responsabilidade do operador que configurou o workflow.",
  },
  {
    title: "Billing, bloqueio e delecao",
    body: "O ciclo comercial do v1 segue trial, cobranca, payment_pending, bloqueio e delecao final do estado comercial e do workspace local desta instalacao.",
  },
];

export function PublicSemanticContent({
  route,
}: PublicSemanticContentProps) {
  const copy = PUBLIC_ROUTE_COPY[route];
  const sections = route === "legal" ? LEGAL_SECTIONS : HOME_SECTIONS;

  return (
    <section
      aria-label={`Resumo semantico da pagina ${copy.title}`}
      className="sr-only"
    >
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
      <p>
        {SITE_NAME} {SITE_TAGLINE}
      </p>
      {sections.map((section) => (
        <article key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </article>
      ))}
    </section>
  );
}
