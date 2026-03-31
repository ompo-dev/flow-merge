import type { Metadata } from "next";
import {
  DEFAULT_LANDING_WORKFLOW_ID,
  LEGAL_LANDING_WORKFLOW_ID,
} from "@/lib/public-pages";

const DEFAULT_SITE_URL = "https://flow-merge.vercel.app";

export const SITE_NAME = "Flow Merge";
export const SITE_TAGLINE = "Automacao e analytics no mesmo canvas.";
export const SITE_DESCRIPTION =
  "Capture qualquer dado, transforme em workflow e entenda impacto real no negocio sem trocar de ferramenta. Flow Merge une automacao, analytics e operacao para founders tecnicos, indie hackers e micro-SaaS.";
export const SITE_KEYWORDS = [
  "automation analytics",
  "posthog alternative",
  "n8n alternative",
  "indie hacker analytics",
  "micro saas analytics",
  "workflow automation",
  "product analytics",
  "growth loops",
  "funnel analytics",
  "desktop automation",
  "local first analytics",
  "saas command center",
];

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getSiteUrl() {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_FLOW_MERGE_SITE_URL) ??
    normalizeUrl(process.env.BETTER_AUTH_URL) ??
    normalizeUrl(process.env.NEXT_PUBLIC_FLOW_MERGE_API_BASE_URL) ??
    DEFAULT_SITE_URL
  );
}

export function absoluteUrl(path = "/") {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export const PUBLIC_ROUTE_COPY = {
  home: {
    path: "/",
    title: `${SITE_TAGLINE} | ${SITE_NAME}`,
    description:
      "Flow Merge e o command center local-first para founders tecnicos que precisam executar automacoes, ler impacto em negocio e agir no mesmo canvas.",
  },
  legal: {
    path: "/legal",
    title: `Termos de Uso | ${SITE_NAME}`,
    description:
      "Termos de uso, responsabilidade operacional, billing e politica de privacidade do Flow Merge para web e desktop.",
  },
} as const;

export function getLandingRouteByWorkflowId(workflowId: string) {
  if (workflowId === LEGAL_LANDING_WORKFLOW_ID)
    return PUBLIC_ROUTE_COPY.legal.path;
  if (workflowId === DEFAULT_LANDING_WORKFLOW_ID)
    return PUBLIC_ROUTE_COPY.home.path;
  return null;
}

export function getLandingWorkflowIdByPathname(pathname: string) {
  return pathname === PUBLIC_ROUTE_COPY.legal.path
    ? LEGAL_LANDING_WORKFLOW_ID
    : DEFAULT_LANDING_WORKFLOW_ID;
}

export function buildRouteMetadata(
  route: keyof typeof PUBLIC_ROUTE_COPY,
): Metadata {
  const copy = PUBLIC_ROUTE_COPY[route];
  const url = absoluteUrl(copy.path);
  const image = absoluteUrl("/opengraph-image");

  return {
    title: copy.title,
    description: copy.description,
    keywords: SITE_KEYWORDS,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      url,
      title: copy.title,
      description: copy.description,
      siteName: SITE_NAME,
      locale: "pt_BR",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - ${SITE_TAGLINE}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [image],
    },
  };
}

export function buildHomeStructuredData() {
  const homeUrl = absoluteUrl("/");
  const legalUrl = absoluteUrl("/legal");
  const image = absoluteUrl("/opengraph-image");

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: SITE_TAGLINE,
      url: homeUrl,
      description: PUBLIC_ROUTE_COPY.home.description,
      inLanguage: "pt-BR",
      primaryImageOfPage: image,
      about: [
        "automation analytics",
        "local-first product analytics",
        "workflow automation for indie hackers",
      ],
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: homeUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: homeUrl,
      logo: absoluteUrl("/icon-light.png"),
      sameAs: [homeUrl],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: homeUrl,
      description: SITE_DESCRIPTION,
      inLanguage: "pt-BR",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Windows, macOS, Linux",
      description: SITE_DESCRIPTION,
      url: homeUrl,
      image,
      offers: [
        {
          "@type": "Offer",
          price: "89",
          priceCurrency: "BRL",
          category: "Pro Mensal",
        },
        {
          "@type": "Offer",
          price: "1068",
          priceCurrency: "BRL",
          category: "Founder Lifetime",
        },
      ],
      audience: {
        "@type": "Audience",
        audienceType: "Founders tecnicos, indie hackers e micro-SaaS",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Casos de uso principais do Flow Merge",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Logs e erros com impacto em R$",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Funil e A/B no mesmo fluxo de decisao",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Padrao comportamental virando acao comercial",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "O que e o Flow Merge?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Flow Merge e uma superficie unica para automacao, analytics e resposta operacional no mesmo canvas.",
          },
        },
        {
          "@type": "Question",
          name: "Onde os dados do workspace ficam?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "O workspace e local-first. Workflows, nodes e runtime ficam na sua maquina; o backend guarda apenas identidade, licenca e metadata minima de billing.",
          },
        },
        {
          "@type": "Question",
          name: "Como funciona a cobranca?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "O trial dura 14 dias. O plano mensal custa R$89 via PIX manual e o Founder Lifetime custa R$1.068 em pagamento unico via PIX.",
          },
        },
        {
          "@type": "Question",
          name: "Onde estao os termos de uso?",
          acceptedAnswer: {
            "@type": "Answer",
            text: `Os termos de uso, responsabilidade operacional e politica de privacidade ficam em ${legalUrl}.`,
          },
        },
      ],
    },
  ];
}

export function buildLegalStructuredData() {
  const legalUrl = absoluteUrl("/legal");
  const homeUrl = absoluteUrl("/");

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Termos de Uso",
      url: legalUrl,
      description: PUBLIC_ROUTE_COPY.legal.description,
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: homeUrl,
      },
      inLanguage: "pt-BR",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Quando os termos de uso passam a valer?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Os termos passam a valer no momento em que a conta Google e usada para criar ou iniciar sessao no Flow Merge.",
          },
        },
        {
          "@type": "Question",
          name: "O backend guarda o workspace do usuario?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Nao. O produto e local-first e o backend comercial guarda apenas identidade, sessao, licenca e metadata minima de billing.",
          },
        },
        {
          "@type": "Question",
          name: "Como funciona bloqueio e delecao?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Depois do prazo comercial, a conta entra em payment_pending, pode ser bloqueada e, se nao houver regularizacao, entra em deleted com limpeza do estado comercial e do workspace local desta instalacao.",
          },
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Landing Page",
          item: homeUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Termos de Uso",
          item: legalUrl,
        },
      ],
    },
  ];
}

export const LLMS_TEXT = `# Flow Merge

Flow Merge e um command center local-first para founders tecnicos, indie hackers e micro-SaaS.

## Core thesis
- Automacao e analytics no mesmo canvas
- Produto local-first com web e desktop na mesma linguagem
- Workspace, workflows, nodes e runtime ficam locais
- Backend guarda apenas identidade, sessao, licenca e metadata minima de billing

## Best-fit use cases
- Logs e erros -> impacto em R$
- Funil e A/B -> decisao operacional
- Padrao comportamental -> acao comercial contextual

## Live public pages
- / : landing principal e tese do produto
- /legal : termos de uso, responsabilidade operacional e privacidade

## Commercial model
- Trial de 14 dias
- Pro Mensal: R$89 por ciclo com PIX manual
- Founder Lifetime: R$1.068 em pagamento unico via PIX
- Vencimento: 7 dias para pagar
- Bloqueio: mais 7 dias antes da delecao total

## Audience
- founders tecnicos
- indie hackers
- operadores de growth, revenue e produto em times pequenos
`;
