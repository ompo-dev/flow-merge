"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  ChartColumn,
  Check,
  LockKeyhole,
  Network,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

type AuthMode = "login" | "register";

const pillars = [
  {
    icon: Workflow,
    title: "One operating surface",
    body: "Workflow, observability and presentation live in one system instead of three disconnected tools.",
  },
  {
    icon: ChartColumn,
    title: "Interpretation built in",
    body: "Metrics, charts and dashboards sit on the same graph that generates them, so the operator can read impact immediately.",
  },
  {
    icon: Bot,
    title: "AI with real context",
    body: "The assistant works on selected nodes, current configuration and graph structure instead of generic prompts detached from the workspace.",
  },
];

const comparisonRows = [
  {
    label: "Automation runtime",
    flowMerge: "Yes",
    n8n: "Yes",
    posthog: "Partial",
  },
  {
    label: "Analytics in the same surface",
    flowMerge: "Native",
    n8n: "Weak",
    posthog: "Strong",
  },
  {
    label: "Operator-first graph view",
    flowMerge: "Core",
    n8n: "Secondary",
    posthog: "Secondary",
  },
  {
    label: "Contextual AI edits",
    flowMerge: "Native",
    n8n: "Add-on",
    posthog: "Add-on",
  },
  {
    label: "Desktop self-hosting",
    flowMerge: "Native",
    n8n: "No",
    posthog: "No",
  },
];

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#30363d] bg-[#11161d]">
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#0d1117] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#30363d]" />
          </div>
          <span className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-1 text-[11px] text-[#7d8590]">
            revenue-operator.flow
          </span>
        </div>
        <span className="rounded-full border border-[#30363d] bg-[#11161d] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
          operator workspace
        </span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Graph</div>
              <div className="mt-1 text-sm font-semibold text-[#e6edf3]">Revenue signal path</div>
            </div>
            <span className="rounded-full border border-[#2f6f3e] bg-[#12261a] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#3fb950]">
              live
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-[#6a4b08] bg-[#201706] px-3 py-2 text-xs text-[#d29922]">
                Trigger
              </div>
              <div className="h-px flex-1 bg-[#30363d]" />
              <div className="rounded-lg border border-[#1f4d8b] bg-[#0c1a2e] px-3 py-2 text-xs text-[#58a6ff]">
                Enrich
              </div>
              <div className="h-px flex-1 bg-[#30363d]" />
              <div className="rounded-lg border border-[#1f4d8b] bg-[#0c1a2e] px-3 py-2 text-xs text-[#58a6ff]">
                Aggregate
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#30363d] bg-[#11161d] p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Metric node</div>
                <div className="mt-2 text-2xl font-semibold text-[#e6edf3]">$46,866</div>
                <div className="mt-1 text-[11px] text-[#3fb950]">+12.4% this week</div>
              </div>
              <div className="rounded-lg border border-[#30363d] bg-[#11161d] p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Insight</div>
                <div className="mt-2 text-xs leading-6 text-[#c9d1d9]">
                  Mobile checkout degraded after enrichment latency increased.
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#30363d] bg-[#11161d] px-3 py-2 text-[11px] text-[#7d8590]">
              The same plane that runs the workflow also explains it.
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Live status</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs">
                <span className="text-[#7d8590]">Sync health</span>
                <span className="text-[#3fb950]">Healthy</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs">
                <span className="text-[#7d8590]">Items processed</span>
                <span className="text-[#e6edf3]">12.4k/min</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-xs">
                <span className="text-[#7d8590]">Alert pressure</span>
                <span className="text-[#d29922]">2 warnings</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">Why teams switch</div>
            <div className="mt-3 space-y-2 text-xs leading-6 text-[#c9d1d9]">
              <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                Automation no longer stops at execution.
              </div>
              <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                Analytics no longer starts after the fact.
              </div>
              <div className="rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2">
                The operator can move from issue to action without leaving context.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiverPreview({
  eyebrow,
  title,
  lines,
}: {
  eyebrow: string;
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#11161d] p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#7d8590]">{eyebrow}</div>
      <div className="mt-2 text-sm font-semibold text-[#e6edf3]">{title}</div>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <div
            key={line}
            className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs leading-6 text-[#c9d1d9]"
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionIntro({
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
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#f0f6fc] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-[16px] leading-8 text-[#8b949e]">{body}</p>
    </div>
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

  const formTitle = useMemo(() => {
    return mode === "register" ? "Create local access" : "Sign in to Flow Merge";
  }, [mode]);

  const formDescription = useMemo(() => {
    if (account) {
      return "Use the local account configured on this machine to open the workspace.";
    }

    return "Protect this desktop workspace with a local email and password.";
  }, [account]);

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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-[#21262d]" />
        <div className="absolute left-[12%] top-[-120px] h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,rgba(31,111,235,0.12),transparent_72%)]" />
        <div className="absolute right-[8%] top-[40px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(63,185,80,0.12),transparent_72%)]" />
      </div>

      <main className="relative mx-auto w-full max-w-[1280px] px-6 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#21262d] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2f6f3e] bg-[#12261a]">
              <Network className="h-4.5 w-4.5 text-[#3fb950]" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Flow Merge</div>
              <div className="text-sm font-semibold text-[#e6edf3]">
                Build workflows that explain themselves.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[#8b949e]">
            <a href="#why" className="transition-colors hover:text-[#e6edf3]">
              Why Flow Merge
            </a>
            <a href="#compare" className="transition-colors hover:text-[#e6edf3]">
              Compare
            </a>
            <a href="#access" className="transition-colors hover:text-[#e6edf3]">
              Access
            </a>
            <button
              onClick={scrollToAccess}
              className="inline-flex items-center gap-2 rounded-md border border-[#30363d] bg-[#11161d] px-3 py-2 text-sm text-[#e6edf3] transition-colors hover:bg-[#161b22]"
            >
              Open workspace
            </button>
          </div>
        </header>

        <section className="grid gap-10 border-b border-[#21262d] py-14 lg:grid-cols-[minmax(0,1fr)_400px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2f6f3e] bg-[#12261a] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#3fb950]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Local-first desktop runtime
            </div>
            <h1 className="mt-6 max-w-[11ch] text-5xl font-semibold tracking-[-0.05em] text-[#f0f6fc] sm:text-6xl lg:text-7xl">
              Build workflows that explain themselves.
            </h1>
            <p className="mt-6 max-w-3xl text-[18px] leading-8 text-[#8b949e]">
              Flow Merge sits between automation and analytics. It lets teams run a workflow,
              inspect impact, edit the graph and use AI on the same operating surface.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={scrollToAccess}
                className="inline-flex items-center gap-2 rounded-md bg-[#238636] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2ea043]"
              >
                Protect this workspace
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="rounded-md border border-[#30363d] bg-[#11161d] px-4 py-2.5 text-sm text-[#8b949e]">
                Workflow graph, dashboards, AI and local auth in one desktop product.
              </div>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#30363d] bg-[#11161d] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Position</div>
                <div className="mt-1 text-sm font-medium text-[#e6edf3]">Operator control plane</div>
              </div>
              <div className="rounded-lg border border-[#30363d] bg-[#11161d] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Security</div>
                <div className="mt-1 text-sm font-medium text-[#e6edf3]">Local account on device</div>
              </div>
              <div className="rounded-lg border border-[#30363d] bg-[#11161d] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Difference</div>
                <div className="mt-1 text-sm font-medium text-[#e6edf3]">Execution plus interpretation</div>
              </div>
            </div>
          </motion.div>

          <motion.aside
            id="access"
            ref={accessRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.08, ease: "easeOut" }}
            className="rounded-xl border border-[#30363d] bg-[#11161d] p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Access</div>
                <div className="mt-2 text-2xl font-semibold text-[#f0f6fc]">{formTitle}</div>
                <p className="mt-2 text-sm leading-7 text-[#8b949e]">{formDescription}</p>
              </div>
              <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#7d8590]">
                private
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
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

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-[0.14em] text-[#7d8590]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="operator@flowmerge.local"
                  className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-[#e6edf3] outline-none transition-colors placeholder:text-[#4f5964] focus:border-[#1f6feb]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-[0.14em] text-[#7d8590]">Password</label>
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
          </motion.aside>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.14, ease: "easeOut" }}
          className="py-12"
        >
          <ProductPreview />
        </motion.section>

        <section id="why" className="border-t border-[#21262d] py-14">
          <SectionIntro
            eyebrow="Why Flow Merge"
            title="Most tools help you run the system or read the system. Flow Merge is built for both."
            body="n8n is strong when you want to automate steps. PostHog is strong when you want to analyze product data. Flow Merge covers the missing middle: operating a running graph while understanding its business impact."
          />

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <motion.article
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: 0.18 + index * 0.04, ease: "easeOut" }}
                  className="rounded-xl border border-[#30363d] bg-[#11161d] p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117]">
                    <Icon className="h-4.5 w-4.5 text-[#58a6ff]" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-[#f0f6fc]">{pillar.title}</div>
                  <p className="mt-3 text-sm leading-7 text-[#8b949e]">{pillar.body}</p>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-[#21262d] py-14">
          <SectionIntro
            eyebrow="How it works"
            title="A landing page shaped like the product: clear hierarchy, dense information, minimal ornament."
            body="The workspace is designed for operators. The landing follows the same rule. Every section explains one capability, one tradeoff and one reason to exist."
          />

          <div className="mt-10 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border border-[#30363d] bg-[#11161d] p-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Compose</div>
                <div className="mt-3 text-2xl font-semibold text-[#f0f6fc]">
                  Model the operating system, not only the automation chain.
                </div>
                <p className="mt-4 text-sm leading-7 text-[#8b949e]">
                  Nodes do not stop at triggers and actions. They can also represent metrics,
                  dashboards, reports and shapes that document how the system should be read.
                </p>
              </div>
              <RiverPreview
                eyebrow="Preview"
                title="Graph and visual nodes share the same plane"
                lines={[
                  "Action nodes, metric nodes and dashboards coexist in one topology.",
                  "Configuration panels follow the same node model across the workspace.",
                  "The operator reads logic and output without changing products.",
                ]}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <RiverPreview
                eyebrow="Preview"
                title="Dashboards are attached to the workflow, not detached from it"
                lines={[
                  "Metrics come from the graph that generates them.",
                  "Comparisons and alerts stay close to the nodes that caused them.",
                  "The reading experience becomes operational, not passive.",
                ]}
              />
              <div className="rounded-xl border border-[#30363d] bg-[#11161d] p-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Observe</div>
                <div className="mt-3 text-2xl font-semibold text-[#f0f6fc]">
                  Read business impact inside the execution graph.
                </div>
                <p className="mt-4 text-sm leading-7 text-[#8b949e]">
                  Instead of sending operators to separate reporting tools, Flow Merge places
                  charts, tables and metrics where decisions actually happen.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border border-[#30363d] bg-[#11161d] p-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#7d8590]">Adapt</div>
                <div className="mt-3 text-2xl font-semibold text-[#f0f6fc]">
                  Use AI on the actual context, not on a generic description of it.
                </div>
                <p className="mt-4 text-sm leading-7 text-[#8b949e]">
                  Selected nodes, current configuration and local history travel with the request,
                  so the assistant can propose changes that fit the real graph.
                </p>
              </div>
              <RiverPreview
                eyebrow="Preview"
                title="The assistant sees the graph you are operating"
                lines={[
                  "Selected nodes become context automatically.",
                  "Suggested edits can create, connect or update nodes.",
                  "The workflow stays editable after the response lands.",
                ]}
              />
            </div>
          </div>
        </section>

        <section id="compare" className="border-t border-[#21262d] py-14">
          <SectionIntro
            eyebrow="Compare"
            title="Built for the space between automation and analytics."
            body="This is the position we are claiming. We are not trying to become a clone of n8n or PostHog. We are solving the operator workflow that appears when teams need both."
          />

          <div className="mt-10 overflow-hidden rounded-xl border border-[#30363d] bg-[#11161d]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#30363d] bg-[#0d1117]">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#7d8590]">
                      Capability
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#3fb950]">
                      Flow Merge
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#7d8590]">
                      n8n
                    </th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#7d8590]">
                      PostHog
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b border-[#21262d] last:border-b-0">
                      <td className="px-5 py-3 font-medium text-[#e6edf3]">{row.label}</td>
                      <td className="px-5 py-3 text-[#3fb950]">{row.flowMerge}</td>
                      <td className="px-5 py-3 text-[#8b949e]">{row.n8n}</td>
                      <td className="px-5 py-3 text-[#8b949e]">{row.posthog}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
