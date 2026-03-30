"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Network,
  Radar,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

type AuthMode = "login" | "register";
type NodeTone = "trigger" | "action" | "analytics" | "viz" | "monitor" | "neutral";

interface NodeCardData {
  badge: string;
  title: string;
  body: string;
  tone: NodeTone;
  chips?: string[];
  metric?: string;
  metricLabel?: string;
  footer?: string;
}

interface FlowLaneData {
  title: string;
  body: string;
  steps: NodeCardData[];
}

const NAV_ITEMS = [
  { id: "canvas-story", label: "Produto" },
  { id: "component-families", label: "Components" },
  { id: "use-cases", label: "Casos" },
  { id: "target-audience", label: "Publico" },
] as const;

const HERO_FLOW: NodeCardData[] = [
  {
    badge: "TRIGGER",
    title: "Webhook",
    body: "Recebe o evento real do produto sem sair do desktop.",
    tone: "trigger",
    footer: "Entrada operacional",
  },
  {
    badge: "ANALYTICS",
    title: "Enrich Data",
    body: "Adiciona plano, receita, canal e contexto antes da decisao.",
    tone: "analytics",
    footer: "Contexto real",
  },
  {
    badge: "ANALYTICS",
    title: "Compare",
    body: "Confronta variantes, cohortes ou fontes no mesmo fluxo.",
    tone: "analytics",
    footer: "Leitura comparativa",
  },
  {
    badge: "VIZ",
    title: "Metric Card",
    body: "Mostra impacto direto no canvas onde o operador esta trabalhando.",
    tone: "viz",
    metric: "+12.4%",
    metricLabel: "delta semanal",
  },
  {
    badge: "VIZ",
    title: "Report",
    body: "Transforma o run em leitura objetiva e proxima da decisao.",
    tone: "viz",
    footer: "Interpretacao embutida",
  },
];

const MERGE_NODES: NodeCardData[] = [
  {
    badge: "n8n DNA",
    title: "Automacao por grafo",
    body: "Fluxos explicitos, steps inspecionaveis, integracoes e controle node a node.",
    tone: "action",
    chips: ["workflow", "edges", "controle"],
  },
  {
    badge: "PostHog DNA",
    title: "Leitura de produto",
    body: "Metricas, funnels, comparacoes e interpretacao ligada ao comportamento do sistema.",
    tone: "analytics",
    chips: ["insight", "analytics", "funnel"],
  },
  {
    badge: "FLOW MERGE",
    title: "Operator surface",
    body: "O mesmo canvas executa, observa e ajuda a ajustar com IA contextual.",
    tone: "viz",
    chips: ["desktop-first", "local-first", "graph-native"],
    footer: "execucao + interpretacao + IA",
  },
];

const COMPONENT_NODES: NodeCardData[] = [
  {
    badge: "TRIGGER",
    title: "Nodes de entrada",
    body: "Manual Trigger, Webhook e Schedule abrem o fluxo com fonte explicita.",
    tone: "trigger",
  },
  {
    badge: "ACTION",
    title: "Nodes de acao",
    body: "If, HTTP, Code, Merge, Filter e integracoes fazem o trabalho operacional.",
    tone: "action",
  },
  {
    badge: "ANALYTICS",
    title: "Nodes analiticos",
    body: "Store, Aggregate, Compare, Segment, A/B Analyzer e Funnel Builder leem o sistema.",
    tone: "analytics",
  },
  {
    badge: "MONITOR",
    title: "Nodes de monitoramento",
    body: "Alert, Error Monitor e Revenue Tracker colocam sinais de pressao no proprio grafo.",
    tone: "monitor",
  },
  {
    badge: "VIZ",
    title: "Nodes visuais",
    body: "Metric Card, Chart, Table, Report, Funnel Chart e Dashboard Canvas mostram impacto.",
    tone: "viz",
  },
  {
    badge: "AI",
    title: "Chat contextual",
    body: "A IA enxerga nodes selecionados, configuracao atual e estrutura do workflow.",
    tone: "neutral",
  },
];

const USE_CASE_LANES: FlowLaneData[] = [
  {
    title: "Revenue pulse",
    body: "Um fluxo que recebe eventos de pagamento, compara variacoes e rende KPI no proprio canvas.",
    steps: [
      {
        badge: "TRIGGER",
        title: "Webhook",
        body: "checkout events",
        tone: "trigger",
      },
      {
        badge: "ANALYTICS",
        title: "Enrich Data",
        body: "plano, canal, MRR",
        tone: "analytics",
      },
      {
        badge: "ANALYTICS",
        title: "Aggregate",
        body: "receita por segmento",
        tone: "analytics",
      },
      {
        badge: "VIZ",
        title: "Metric Card",
        body: "MRR e delta",
        tone: "viz",
      },
    ],
  },
  {
    title: "Experiment room",
    body: "Uma leitura simples de experimento em que o proprio workflow explica o vencedor.",
    steps: [
      {
        badge: "TRIGGER",
        title: "Webhook",
        body: "exposure + conversion",
        tone: "trigger",
      },
      {
        badge: "ANALYTICS",
        title: "A/B Analyzer",
        body: "controle vs variante",
        tone: "analytics",
      },
      {
        badge: "VIZ",
        title: "Funnel Chart",
        body: "queda por etapa",
        tone: "viz",
      },
      {
        badge: "VIZ",
        title: "Report",
        body: "winner + explanation",
        tone: "viz",
      },
    ],
  },
  {
    title: "Ops monitor",
    body: "Uma rotina de observabilidade que mistura schedule, alertas e dashboard operacional.",
    steps: [
      {
        badge: "TRIGGER",
        title: "Schedule",
        body: "run horario",
        tone: "trigger",
      },
      {
        badge: "MONITOR",
        title: "Error Monitor",
        body: "classifica sinais",
        tone: "monitor",
      },
      {
        badge: "MONITOR",
        title: "Alert",
        body: "dispara resposta",
        tone: "monitor",
      },
      {
        badge: "VIZ",
        title: "Dashboard Canvas",
        body: "sala de controle",
        tone: "viz",
      },
    ],
  },
];

const AUDIENCE_NODES: NodeCardData[] = [
  {
    badge: "PUBLICO",
    title: "Founders tecnicos",
    body: "Precisam operar integracoes, receita e produto sem montar um stack fragmentado logo no inicio.",
    tone: "neutral",
    chips: ["micro-SaaS", "B2B", "controle"],
  },
  {
    badge: "PUBLICO",
    title: "Growth e revenue ops",
    body: "Querem ligar eventos, leitura de impacto e acao sem saltar entre automacao e dashboard.",
    tone: "neutral",
    chips: ["growth", "revenue", "ops"],
  },
  {
    badge: "PUBLICO",
    title: "Product engineers",
    body: "Precisam de um plano unico para webhooks, agregacoes, observabilidade e explicacao do fluxo.",
    tone: "neutral",
    chips: ["events", "analytics", "runtime"],
  },
  {
    badge: "PUBLICO",
    title: "Agencias operacionais",
    body: "Podem transformar automacoes de clientes em command centers legiveis para operacao diaria.",
    tone: "neutral",
    chips: ["agencias", "operacao", "clientes"],
  },
];

const TONE_STYLES: Record<NodeTone, string> = {
  trigger: "border-[#6a4b08] bg-[#201706]",
  action: "border-[#1f4d8b] bg-[#0c1a2e]",
  analytics: "border-[#2f5d85] bg-[#102134]",
  viz: "border-[#2f6f3e] bg-[#12261a]",
  monitor: "border-[#8c6918] bg-[#201706]",
  neutral: "border-[#30363d] bg-[#11161d]",
};

function scrollToSection(id: string) {
  if (typeof window === "undefined") return;
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function LandingToolbar({ onAccess }: { onAccess: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
      <div className="pointer-events-auto fc-panel flex w-full max-w-[1280px] flex-wrap items-center overflow-hidden">
        <div className="flex items-center gap-2 border-r border-[#30363d] px-3 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#2f6f3e] bg-[#12261a]">
            <Network className="h-3.5 w-3.5 text-[#3fb950]" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">
              Flow Merge
            </div>
            <div className="text-xs font-medium text-[#e6edf3]">Operator canvas</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="shrink-0 border-r border-[#30363d] px-3 py-2 text-xs text-[#7d8590] transition-colors hover:bg-[#21262d] hover:text-[#e6edf3]"
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onAccess}
          className="shrink-0 px-3 py-2 text-xs text-[#58a6ff] transition-colors hover:bg-[#21262d]"
        >
          Abrir acesso
        </button>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#f0f6fc] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-[15px] leading-7 text-[#8b949e]">{body}</p>
    </div>
  );
}

function InfoNode({
  badge,
  title,
  body,
  tone,
  chips,
  metric,
  metricLabel,
  footer,
  className = "",
}: NodeCardData & { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={`rounded-xl border p-4 ${TONE_STYLES[tone]} ${className}`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">{badge}</div>
      <div className="mt-2 text-lg font-semibold text-[#f0f6fc]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[#c9d1d9]">{body}</div>

      {metric ? (
        <div className="mt-4 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2">
          <div className="text-xl font-semibold text-[#f0f6fc]">{metric}</div>
          <div className="mt-1 text-[11px] text-[#7d8590]">{metricLabel}</div>
        </div>
      ) : null}

      {chips?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#7d8590]"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {footer ? <div className="mt-4 text-[11px] text-[#7d8590]">{footer}</div> : null}
    </motion.div>
  );
}

function FlowLane({ title, body, steps }: FlowLaneData) {
  return (
    <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-4">
      <div className="flex flex-col gap-1 border-b border-[#21262d] pb-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">{title}</div>
        <div className="text-sm leading-6 text-[#8b949e]">{body}</div>
      </div>

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-stretch">
        {steps.map((step, index) => (
          <div key={`${title}-${step.title}`} className="flex min-w-0 items-center gap-3 xl:flex-1">
            <InfoNode {...step} className="min-w-0 flex-1" />
            {index < steps.length - 1 ? (
              <div className="hidden xl:flex xl:w-10 xl:shrink-0 xl:items-center">
                <div className="h-px w-full bg-[#30363d]" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CanvasBoard({
  id,
  eyebrow,
  title,
  body,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-[22px] border border-[#30363d] bg-[#11161d]">
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#0d1117] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
          </div>
          <span className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-1 text-[11px] text-[#7d8590]">
            {eyebrow}
          </span>
        </div>
        <span className="rounded-full border border-[#30363d] bg-[#11161d] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
          canvas board
        </span>
      </div>

      <div className="px-4 py-5">
        <SectionHeading eyebrow={eyebrow} title={title} body={body} />
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function AccessPanel({
  account,
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  pending,
  error,
  onSubmit,
}: {
  account: { email: string } | null;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  pending: boolean;
  error: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const formTitle = mode === "register" ? "Create local access" : "Sign in to Flow Merge";
  const formDescription = account
    ? "Use the local account configured on this machine to open the workspace."
    : "Protect this desktop workspace with a local email and password.";

  return (
    <motion.aside
      id="access-panel"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: 0.08, ease: "easeOut" }}
      className="fc-panel lg:sticky lg:top-24"
    >
      <div className="border-b border-[#30363d] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Access</div>
            <div className="mt-2 text-2xl font-semibold text-[#f0f6fc]">{formTitle}</div>
            <p className="mt-2 text-sm leading-7 text-[#8b949e]">{formDescription}</p>
          </div>
          <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
            private
          </span>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            disabled={!account}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              mode === "login"
                ? "border-[#1f6feb] bg-[#0c1a2e] text-[#e6edf3]"
                : "border-[#30363d] bg-[#0d1117] text-[#7d8590]"
            } ${account ? "hover:text-[#e6edf3]" : "cursor-not-allowed opacity-45"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            disabled={Boolean(account)}
            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
              mode === "register"
                ? "border-[#1f6feb] bg-[#0c1a2e] text-[#e6edf3]"
                : "border-[#30363d] bg-[#0d1117] text-[#7d8590]"
            } ${account ? "cursor-not-allowed opacity-45" : "hover:text-[#e6edf3]"}`}
          >
            Create access
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-[#7d8590]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@flowmerge.local"
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-[#e6edf3] outline-none transition-colors placeholder:text-[#4f5964] focus:border-[#1f6feb]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-[#7d8590]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-[#e6edf3] outline-none transition-colors placeholder:text-[#4f5964] focus:border-[#1f6feb]"
            />
          </div>

          {mode === "register" ? (
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-[0.14em] text-[#7d8590]">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat the password"
                className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-[#e6edf3] outline-none transition-colors placeholder:text-[#4f5964] focus:border-[#1f6feb]"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-[#f8514933] bg-[#2d1518] px-3 py-2.5 text-sm text-[#ffb1af]">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Validating..." : formTitle}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-5 rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-[#58a6ff]" />
            <div className="text-sm font-medium text-[#e6edf3]">Local security model</div>
          </div>
          <div className="mt-3 space-y-2 text-sm text-[#8b949e]">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
              Email and password stay on this device.
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
              Password is stored as a derived hash.
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3fb950]" />
              The canvas opens only after local sign-in.
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export function LandingPage() {
  const account = useAuthStore((state) => state.account);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const [mode, setMode] = useState<AuthMode>(account ? "login" : "register");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const accessRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(account ? "login" : "register");
    if (account?.email) {
      setEmail(account.email);
    }
  }, [account]);

  const targetMarketCopy = useMemo(
    () => [
      "Tese do produto: workflow graph + analytics reading surface + contextual AI.",
      "Posicao: entre a execucao tipo n8n e a leitura tipo PostHog.",
      "Ideal para operadores tecnicos que precisam decidir dentro do proprio fluxo.",
    ],
    [],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");

    const result =
      mode === "register"
        ? await register({ email, password, confirmPassword })
        : await login({ email, password });

    setPending(false);

    if (!result.success) {
      setError(result.error ?? "Could not validate access right now.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
  };

  const scrollToAccess = () => {
    accessRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="relative h-screen overflow-y-auto bg-[#0d1117] text-[#e6edf3]">
      <LandingToolbar onAccess={scrollToAccess} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(48,54,61,0.52) 1px, transparent 1px), linear-gradient(90deg, rgba(48,54,61,0.52) 1px, transparent 1px), linear-gradient(rgba(48,54,61,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(48,54,61,0.18) 1px, transparent 1px)",
            backgroundSize: "80px 80px, 80px 80px, 20px 20px, 20px 20px",
          }}
        />
        <div className="absolute left-[8%] top-[90px] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(31,111,235,0.12),transparent_72%)]" />
        <div className="absolute right-[10%] top-[180px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(63,185,80,0.12),transparent_72%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <section className="grid min-h-[calc(100svh-7rem)] gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <motion.div
            id="canvas-story"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
            className="rounded-[22px] border border-[#30363d] bg-[#11161d]"
          >
            <div className="flex items-center justify-between border-b border-[#30363d] bg-[#0d1117] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
                </div>
                <span className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-1 text-[11px] text-[#7d8590]">
                  flow-merge.canvas
                </span>
              </div>
              <span className="rounded-full border border-[#30363d] bg-[#11161d] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                desktop-first
              </span>
            </div>

            <div className="grid gap-6 px-4 py-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#2f6f3e] bg-[#12261a] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#3fb950]">
                    <Radar className="h-3.5 w-3.5" />
                    Operator command center
                  </div>
                  <h1 className="mt-5 max-w-[13ch] text-5xl font-semibold tracking-[-0.05em] text-[#f0f6fc] sm:text-6xl">
                    The canvas where automation explains itself.
                  </h1>
                  <p className="mt-5 max-w-3xl text-[17px] leading-8 text-[#8b949e]">
                    Flow Merge pega o raciocinio visual da automacao, junta com leitura operacional
                    de analytics e entrega uma superficie unica para executar, entender e ajustar.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={scrollToAccess}
                      className="inline-flex items-center gap-2 rounded-md bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
                    >
                      Entrar no workspace
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <div className="rounded-md border border-[#30363d] bg-[#11161d] px-4 py-2.5 text-sm text-[#8b949e]">
                      Feito para founders tecnicos, growth ops e product engineers.
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {targetMarketCopy.map((item) => (
                      <div
                        key={item}
                        className="rounded-lg border border-[#30363d] bg-[#11161d] px-3 py-3 text-sm leading-6 text-[#c9d1d9]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <FlowLane
                  title="Exemplo de fluxo narrativo"
                  body="Aqui esta a tese do produto em nodes reais: o evento entra, o sistema ganha contexto, a comparacao acontece e o impacto aparece no mesmo plano."
                  steps={HERO_FLOW}
                />
              </div>

              <div className="space-y-4">
                {MERGE_NODES.map((node) => (
                  <InfoNode key={node.title} {...node} />
                ))}

                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">
                    <Sparkles className="h-3.5 w-3.5 text-[#58a6ff]" />
                    Why this matters
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[#c9d1d9]">
                    Em vez de empurrar o operador para outro dashboard, outro chat e outro documento,
                    o Flow Merge transforma o proprio workflow em superficie de leitura e decisao.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div ref={accessRef}>
            <AccessPanel
              account={account ? { email: account.email } : null}
              mode={mode}
              setMode={setMode}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              pending={pending}
              error={error}
              onSubmit={handleSubmit}
            />
          </div>
        </section>

        <CanvasBoard
          id="component-families"
          eyebrow="Component families"
          title="A landing mostra as mesmas familias que existem no app."
          body="Em vez de falar do produto com secoes de marketing genericas, usamos o proprio vocabulrio do canvas. O usuario ja aprende a ler o sistema antes de entrar."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {COMPONENT_NODES.map((node) => (
              <InfoNode key={node.title} {...node} />
            ))}
          </div>
        </CanvasBoard>

        <CanvasBoard
          id="use-cases"
          eyebrow="Simple use cases"
          title="Fluxos curtos, ideia clara e impacto visivel."
          body="Esses exemplos nao precisam ser reais em todos os detalhes. Eles existem para ensinar como o produto pensa: trigger, processamento, leitura e decisao no mesmo canvas."
        >
          <div className="space-y-4">
            {USE_CASE_LANES.map((lane) => (
              <FlowLane key={lane.title} {...lane} />
            ))}
          </div>
        </CanvasBoard>

        <CanvasBoard
          id="target-audience"
          eyebrow="Target audience"
          title="Quem mais sente a dor de trocar de contexto entre automacao e analytics."
          body="Flow Merge faz mais sentido para equipes pequenas e tecnicas que precisam operar rapido, entender impacto logo e manter tudo proximo do grafo."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {AUDIENCE_NODES.map((node) => (
              <InfoNode key={node.title} {...node} />
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#30363d] bg-[#0d1117] p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">
              Positioning note
            </div>
            <div className="mt-3 max-w-4xl text-sm leading-7 text-[#c9d1d9]">
              O Flow Merge nao precisa prometer que substitui tudo o que n8n ou PostHog fazem.
              A narrativa certa e mais forte: pegamos o poder de modelagem visual da automacao,
              somamos a leitura operacional de analytics e entregamos uma superficie unica para o
              operador tecnico trabalhar sem perder contexto.
            </div>
          </div>
        </CanvasBoard>
      </main>
    </div>
  );
}
