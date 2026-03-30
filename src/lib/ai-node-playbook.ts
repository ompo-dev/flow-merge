import { nodeCatalogMap, parameterDefaults, type NodeTypeId } from "@/lib/node-catalog";
import type { Workflow } from "@/lib/flow-types";

type NodePlaybookEntry = {
  keywords: string[];
  summary: string;
  useWhen: string;
  avoidWhen: string;
  expects: string;
  emits: string;
  topology: string;
  programming: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const PLAYBOOK: Record<NodeTypeId, NodePlaybookEntry> = {
  trigger_manual: {
    keywords: ["manual", "test", "simulate", "button", "run"],
    summary: "Start a workflow manually for tests, demos, or operator-driven runs.",
    useWhen: "Use when the user wants to start the flow from the app without waiting for an external event.",
    avoidWhen: "Do not use as the main production ingress if events already exist in HTTP or scheduled form.",
    expects: "No upstream data.",
    emits: "The request payload as the first event.",
    topology: "trigger_manual -> any processing path.",
    programming: "Keep simple. Use Test mode to simulate realistic payloads.",
  },
  trigger_webhook: {
    keywords: ["webhook", "http", "frontend", "backend", "api", "event", "postback"],
    summary: "Ingress node for external JSON events over HTTP.",
    useWhen: "Use for product events, billing hooks, logs, leads, support events, CRM callbacks, and app telemetry.",
    avoidWhen: "Do not use for periodic jobs; use trigger_schedule for recurring execution.",
    expects: "Inbound JSON body. Optional Tag Field and Tag Value add a static source marker.",
    emits: "Event payload with semantic access to payload/body fields plus optional tag.",
    topology: "trigger_webhook -> normalize/filter/router/store/analyze.",
    programming: "Prefer one webhook per stable source or variant. Use Tag Field/Value to stamp source identity.",
  },
  trigger_schedule: {
    keywords: ["schedule", "cron", "daily", "weekly", "hourly", "report"],
    summary: "Recurring trigger for periodic syncs, summaries, health checks, and reports.",
    useWhen: "Use for weekly summaries, daily finance checks, uptime checks, or batch automations.",
    avoidWhen: "Do not use when an external system can already push real-time events.",
    expects: "No upstream data.",
    emits: "A synthetic schedule event plus optional request payload.",
    topology: "trigger_schedule -> fetch/aggregate/report/notify.",
    programming: "Use it to drive summaries and pull-based workflows.",
  },
  action_http: {
    keywords: ["http", "api", "fetch", "request", "call", "rest"],
    summary: "Call an external HTTP endpoint and continue with the response body.",
    useWhen: "Use for CRM, billing APIs, enrichment, pull syncs, and external lookups.",
    avoidWhen: "Do not use if the next step is purely local transformation.",
    expects: "Incoming event used as request body for non-GET methods.",
    emits: "status, ok, and body; semantic field access can read body.* directly.",
    topology: "trigger -> action_http -> set/filter/store/report.",
    programming: "Return compact payloads. Prefer normalized body fields for downstream rules.",
  },
  action_code: {
    keywords: ["code", "javascript", "script", "custom logic"],
    summary: "Programmable node for custom JavaScript transformations.",
    useWhen: "Use when builtin nodes are not enough and explicit code is required.",
    avoidWhen: "Do not use for simple mapping, routing, filtering, or aggregation that builtin nodes already cover.",
    expects: "Any upstream payload. Semantic input access is available.",
    emits: "Whatever the code returns as rows/items.",
    topology: "Any point where custom transformation is truly required.",
    programming: "Write focused code. Return clean rows for downstream nodes, not opaque blobs.",
  },
  action_set: {
    keywords: ["set", "map", "assign", "field", "normalize"],
    summary: "Create or overwrite a field on every incoming item.",
    useWhen: "Use to normalize source fields, derive flags, or stamp metadata before storage or routing.",
    avoidWhen: "Do not use for branching or filtering.",
    expects: "Any incoming items.",
    emits: "The same items plus the updated field.",
    topology: "trigger/http -> action_set -> filter/store/analyze.",
    programming: "Use exact field paths and semantic expressions like {{ input.first.amount }}.",
  },
  action_if: {
    keywords: ["if", "condition", "branch", "true", "false"],
    summary: "Boolean branch node with explicit true/false handles.",
    useWhen: "Use for yes/no decisions such as winner found, score threshold, paid vs unpaid, or overdue vs healthy.",
    avoidWhen: "Do not use for 3+ route fan-out; use action_switch.",
    expects: "A field expression in Value 1 and a comparison target in Value 2.",
    emits: "The same input through handle true or false.",
    topology: "upstream -> action_if -> true path / false path.",
    programming: "Always think about which downstream path is connected to true or false.",
  },
  action_switch: {
    keywords: ["switch", "route", "cases", "variant", "source", "segment"],
    summary: "Multi-route branch node with case_1..case_4 and default.",
    useWhen: "Use to route by variant, source, plan, segment, environment, or category.",
    avoidWhen: "Do not use for randomization. Do not use when a simple boolean branch is enough.",
    expects: "A value expression and concrete case values.",
    emits: "The same input to the matching case handle or default.",
    topology: "upstream -> action_switch -> case_n paths.",
    programming: "For experiments, route on static variant tags. For observability, route on source tags. If an upstream source is disabled, downstream dead cases must stop influencing the live branch semantics.",
  },
  action_merge: {
    keywords: ["merge", "combine", "join", "append"],
    summary: "Join multiple active inputs into one envelope.",
    useWhen: "Use when two branches must converge before the next step.",
    avoidWhen: "Do not use if there is only one branch or if append/aggregation can happen later.",
    expects: "Multiple incoming envelopes.",
    emits: "A merged envelope of all active inputs.",
    topology: "branch A + branch B -> action_merge -> downstream.",
    programming: "Connect all required upstream branches explicitly before using downstream analytics.",
  },
  action_split: {
    keywords: ["split", "batch", "chunk", "paginate"],
    summary: "Annotate items with batch metadata while keeping items usable downstream.",
    useWhen: "Use to process large collections in manageable chunks without losing item semantics.",
    avoidWhen: "Do not use to randomize experiment traffic.",
    expects: "A collection of incoming items.",
    emits: "The original items plus batchIndex, batchSize, and batchCount.",
    topology: "list source -> action_split -> any downstream logic.",
    programming: "Downstream nodes should still read item fields normally; batching is metadata, not a wrapper contract.",
  },
  action_email: {
    keywords: ["email", "notify", "resend", "message"],
    summary: "Prepare or send an email notification.",
    useWhen: "Use for founder summaries, alerts, churn recovery, or team notifications.",
    avoidWhen: "Do not use as a storage or analytics node.",
    expects: "Incoming data already shaped into a useful notification context.",
    emits: "The original input while sending or preparing an email side effect.",
    topology: "alert/report/winner -> action_email.",
    programming: "Prepare clean message fields upstream. Use Message with semantic expressions.",
  },
  action_slack: {
    keywords: ["slack", "notify", "alert", "channel"],
    summary: "Prepare or send a Slack notification.",
    useWhen: "Use for ops alerts, winner announcements, finance warnings, or founder updates.",
    avoidWhen: "Do not use for persistent storage.",
    expects: "Incoming data already reduced to a short operational summary.",
    emits: "The original input while sending or preparing a Slack payload.",
    topology: "alert/report/winner -> action_slack.",
    programming: "Use short, direct operational messages with semantic values.",
  },
  action_notion: {
    keywords: ["notion", "database", "page", "doc"],
    summary: "Create, update, or query Notion content.",
    useWhen: "Use for backlog sync, idea capture, incident logs, or CRM-like internal pages.",
    avoidWhen: "Do not use as general analytics storage.",
    expects: "Structured fields ready for Notion mapping.",
    emits: "The original input or remote response metadata.",
    topology: "normalized input -> action_notion -> optional report/notification.",
    programming: "Normalize title/body fields before sending to Notion.",
  },
  action_github: {
    keywords: ["github", "issue", "pr", "comment", "repo"],
    summary: "Interact with GitHub repos, pull requests, or issues.",
    useWhen: "Use for incident filing, bug triage, release notes, or automation against repos.",
    avoidWhen: "Do not use for generic notifications if no GitHub action is needed.",
    expects: "Owner, repo, and operation-specific context.",
    emits: "Response payload from GitHub or original input.",
    topology: "alert/feedback -> action_github.",
    programming: "Prepare a clean summary before opening issues or comments.",
  },
  action_openai: {
    keywords: ["openai", "ai", "summary", "classify", "insight"],
    summary: "Call an LLM with rows/columns from upstream data.",
    useWhen: "Use for text classification, founder summaries, incident explanations, or report enrichment.",
    avoidWhen: "Do not use when deterministic logic is enough.",
    expects: "Structured rows from upstream nodes.",
    emits: "AI insight plus report-compatible artifacts.",
    topology: "analytics/viz-ready data -> action_openai -> report/notification.",
    programming: "Ask for concise, structured output. Keep prompt specific to the business task.",
  },
  action_function: {
    keywords: ["function", "transform", "custom", "logic"],
    summary: "Short programmable transform similar to code node.",
    useWhen: "Use for compact custom logic when a small transform is enough.",
    avoidWhen: "Do not overuse for jobs already modeled by builtins.",
    expects: "Any incoming items.",
    emits: "Rows returned by the function.",
    topology: "Any step that needs small custom transformation.",
    programming: "Return plain objects that downstream analytics and viz nodes can read semantically.",
  },
  action_filter: {
    keywords: ["filter", "where", "match", "only", "keep"],
    summary: "Keep only items that match a rule.",
    useWhen: "Use for failures only, overdue only, paid only, low score only, etc.",
    avoidWhen: "Do not use when you need branching; use action_if or action_switch.",
    expects: "A field expression, rule, and comparison value.",
    emits: "Only matching items.",
    topology: "trigger/http/set -> action_filter -> store/analyze/notify.",
    programming: "Filter early when the rest of the workflow only needs a subset.",
  },
  action_wait: {
    keywords: ["wait", "delay", "pause", "retry later"],
    summary: "Delay the flow without changing the payload.",
    useWhen: "Use for grace periods, retry gaps, or timed follow-ups.",
    avoidWhen: "Do not use as scheduling replacement for recurring workflows.",
    expects: "Any incoming payload.",
    emits: "The same payload after the delay.",
    topology: "any node -> action_wait -> next action.",
    programming: "Use short waits inside flows; use trigger_schedule for recurring automation.",
  },
  action_respond: {
    keywords: ["respond", "webhook response", "http response"],
    summary: "Prepare the response back to a webhook caller.",
    useWhen: "Use in webhook flows when the caller expects a response body or status.",
    avoidWhen: "Do not use in schedule-only or manual-only workflows unless response semantics matter.",
    expects: "Upstream payload already shaped for response.",
    emits: "The same payload and a webhook response object.",
    topology: "webhook path -> action_respond near the end of request handling.",
    programming: "Set response only after validation/transformation is done.",
  },
  analytics_store: {
    keywords: ["store", "persist", "save", "events", "collection"],
    summary: "Persist events into a named collection while forwarding the same items.",
    useWhen: "Use before analytics_ab, analytics_compare, enrichment, or later reporting.",
    avoidWhen: "Do not use as a generic transform node.",
    expects: "Any items that should become historical records.",
    emits: "The same items while storing them in Store Name.",
    topology: "source-specific trigger/filter -> analytics_store -> compare/analyzer.",
    programming: "Use one store per source, variant, plan, or cohort when those are compared later. A store with no live upstream should remain visible but blocked, not deleted from the canvas.",
  },
  analytics_aggregate: {
    keywords: ["aggregate", "sum", "count", "avg", "group by"],
    summary: "Reduce raw events into totals or grouped buckets.",
    useWhen: "Use for revenue totals, event counts, grouped buckets, or KPI preparation.",
    avoidWhen: "Do not use when a side-by-side comparison between sources is needed; use analytics_compare.",
    expects: "Numeric field and optional group by key.",
    emits: "Metric or grouped rows plus metric/table/series artifacts.",
    topology: "events -> analytics_aggregate -> metric/chart/table/report.",
    programming: "Choose Count for event volume and Sum for money or totals.",
  },
  analytics_compare: {
    keywords: ["compare", "vs", "leader", "source", "channel", "gateway"],
    summary: "Compare active sources side by side and emit leader/total/delta/sources.",
    useWhen: "Use for frontend vs backend logs, gateway comparison, region comparison, plan comparison, channel comparison.",
    avoidWhen: "Do not use for winner logic in experiments; use analytics_ab there.",
    expects: "Prefer upstream analytics_store nodes per source, or events carrying source identity.",
    emits: "metric, total, delta, sourceCount, leader, leaderValue, sources plus chart/table/report artifacts.",
    topology: "store per source -> analytics_compare -> metric/chart/report/alert.",
    programming: "Use meaningful source labels. Compare active sources, never hardcode dead branches. If one source disappears, shared downstream nodes must adapt to the remaining live source.",
  },
  analytics_ab: {
    keywords: ["a/b", "experiment", "winner", "variant", "multivariate", "test"],
    summary: "Analyze variants for conversion/revenue and emit winner-oriented results.",
    useWhen: "Use for A/B or multivariate experiments with one store per variant.",
    avoidWhen: "Do not use for logs, uptime, support queues, or generic source comparison.",
    expects: "Variant-tagged items or variant stores, plus conversion and revenue fields.",
    emits: "winner, winningRate, winningConversions, winningUsers, variants rows and winner-compatible artifacts.",
    topology: "trigger per variant -> action_switch -> store per variant -> analytics_ab -> winner nodes.",
    programming: "Set Variant Field, Conversion Field, Revenue Field, and Minimum Sample correctly. If a variant disappears, do not delete the old branch blindly; keep blocked nodes visible and adapt shared downstream nodes to live variants.",
  },
  analytics_funnel: {
    keywords: ["funnel", "steps", "page view", "signup", "paid", "activation"],
    summary: "Count items across named funnel steps.",
    useWhen: "Use for onboarding, signup, checkout, activation, or waitlist progression.",
    avoidWhen: "Do not use for side-by-side source comparison.",
    expects: "Events with event/stage/name fields matching the configured steps.",
    emits: "Stage rows and funnel artifact.",
    topology: "event stream -> analytics_funnel -> viz_funnel/report/metric.",
    programming: "Keep steps ordered from broadest to narrowest conversion.",
  },
  analytics_segment: {
    keywords: ["segment", "cohort", "group", "plan", "tier", "region"],
    summary: "Bucket items by one field and emit grouped counts.",
    useWhen: "Use for plan mix, region distribution, source distribution, or cohort snapshots.",
    avoidWhen: "Do not use when you need numeric aggregation beyond counting; use analytics_aggregate.",
    expects: "A segment field and optional allowed values.",
    emits: "Rows and bar-series artifact by segment.",
    topology: "events -> analytics_segment -> chart/table/report.",
    programming: "Use when the question is 'how many items belong to each bucket?'",
  },
  analytics_enrich: {
    keywords: ["enrich", "join", "lookup", "augment", "context"],
    summary: "Join incoming events with a stored collection by key.",
    useWhen: "Use to attach account context, lead metadata, or prior event context.",
    avoidWhen: "Do not use if no stable join key exists.",
    expects: "Source collection and Join Field available on both sides.",
    emits: "Incoming items plus enrichment object.",
    topology: "store reference data -> analytics_enrich -> compare/report/notify.",
    programming: "Persist the reference dataset first, then enrich transactional events later.",
  },
  monitor_error: {
    keywords: ["error", "logs", "exceptions", "incident", "stack", "failure"],
    summary: "Classify error-like events by level/category/message.",
    useWhen: "Use before error dashboards, comparison, incident alerts, or error triage.",
    avoidWhen: "Do not use for revenue or conversion analysis.",
    expects: "Events carrying message/error/stack and level-like fields.",
    emits: "Classified error rows with level, category, message, fingerprint.",
    topology: "error events -> monitor_error -> store/compare/chart/report.",
    programming: "Use Level Filter and Pattern to narrow the error slice you care about.",
  },
  monitor_alert: {
    keywords: ["alert", "threshold", "spike", "guardrail", "limit"],
    summary: "Trigger an alert object when a numeric field crosses a threshold.",
    useWhen: "Use after compare, revenue monitor, aggregate totals, or error spikes.",
    avoidWhen: "Do not use before a numeric field exists.",
    expects: "A numeric field like total, leaderValue, amount, count, or error rate.",
    emits: "triggered, threshold, matches, channel and alert artifact.",
    topology: "aggregate/compare/monitor -> monitor_alert -> slack/email/report.",
    programming: "Point Field to a real numeric value; for compare flows {{ input.first.total }} is often the right choice.",
  },
  monitor_revenue: {
    keywords: ["revenue", "mrr", "arr", "money", "billing", "cash"],
    summary: "Track revenue-like totals and format them as a financial metric.",
    useWhen: "Use for MRR, ARR, revenue totals, or billing dashboards.",
    avoidWhen: "Do not use when the metric is not money-like.",
    expects: "Items with amount, revenue, value, or total.",
    emits: "metric, total, currency and metric artifact.",
    topology: "billing events/aggregate -> monitor_revenue -> metric/chart/report.",
    programming: "Use it after raw billing events or after an aggregate that already reduced the data.",
  },
  viz_metric: {
    keywords: ["metric", "kpi", "card", "leader", "total"],
    summary: "Render one KPI card from upstream artifacts or rows.",
    useWhen: "Use for MRR, total errors, winner, leader source, top plan, or pending state.",
    avoidWhen: "Do not use when a table or series is more informative.",
    expects: "Metric, comparison, analyzer, aggregate, or row-based input.",
    emits: "Metric artifact and config patch with value/trend/compareLabel.",
    topology: "analytics/monitor -> viz_metric.",
    programming: "Prefer one clear KPI per metric node.",
  },
  viz_chart: {
    keywords: ["chart", "bar", "line", "area", "trend", "series"],
    summary: "Render a chart from series, comparison, aggregate, or row data.",
    useWhen: "Use for trends, comparisons, segment mix, source volume, or variant conversion.",
    avoidWhen: "Do not use if a single KPI or raw table communicates better.",
    expects: "Series artifact or rows that can be turned into label/value pairs.",
    emits: "Series artifact and config patch with series.",
    topology: "analytics/monitor -> viz_chart.",
    programming: "Use bar for side-by-side comparisons and line/area for time-like progression.",
  },
  viz_table: {
    keywords: ["table", "rows", "columns", "list", "grid"],
    summary: "Render operational rows with adaptive columns.",
    useWhen: "Use for top events, invoice lists, error rows, plans, sources, or cohorts.",
    avoidWhen: "Do not use when no tabular view is needed.",
    expects: "Table artifact or row-like input.",
    emits: "Table artifact and config patch with columns/rows.",
    topology: "analytics/monitor -> viz_table.",
    programming: "Keep rows flat and human-readable. Let the node infer columns when possible.",
  },
  viz_report: {
    keywords: ["report", "summary", "insight", "digest"],
    summary: "Render a structured report with items and narrative insight.",
    useWhen: "Use for founder summaries, winner reports, error source reports, and financial snapshots.",
    avoidWhen: "Do not use for raw event streams without prior reduction.",
    expects: "Report artifact, AI summary, comparison output, or analyzer output.",
    emits: "Report artifact and config patch with reportItems and insight.",
    topology: "analytics/AI -> viz_report.",
    programming: "Use for condensed decision-ready summaries, not raw dumps.",
  },
  viz_funnel: {
    keywords: ["funnel chart", "stages", "dropoff", "conversion"],
    summary: "Render a funnel from ordered stage rows or funnel artifact.",
    useWhen: "Use after analytics_funnel or any stage-based rows.",
    avoidWhen: "Do not use for side-by-side source comparisons.",
    expects: "Funnel artifact or rows with label/value pairs.",
    emits: "Funnel artifact and config patch with stages.",
    topology: "analytics_funnel -> viz_funnel.",
    programming: "Feed it ordered stage data, not arbitrary rows.",
  },
  viz_dashboard: {
    keywords: ["dashboard", "canvas", "widgets", "panel"],
    summary: "Container-like dashboard node for composed visual states.",
    useWhen: "Use when the workflow needs a broader dashboard surface or widget grouping.",
    avoidWhen: "Do not use as the only viz node if a specific chart/table/metric is enough.",
    expects: "Any upstream context.",
    emits: "The same input with dashboard availability note.",
    topology: "analytics/viz -> viz_dashboard or dashboard-centric flows.",
    programming: "Think of it as a canvas surface, not a metric calculator.",
  },
};

function scoreNodeRelevance(
  nodeType: NodeTypeId,
  userMessage: string,
  workflowNodeTypes: Set<NodeTypeId>,
) {
  const normalizedMessage = normalize(userMessage);
  const nodeMeta = nodeCatalogMap[nodeType];
  const entry = PLAYBOOK[nodeType];
  let score = workflowNodeTypes.has(nodeType) ? 10 : 0;

  if (normalizedMessage.includes(normalize(nodeType))) score += 6;
  if (normalizedMessage.includes(normalize(nodeMeta.label))) score += 4;
  if (normalizedMessage.includes(normalize(nodeMeta.category))) score += 2;

  for (const keyword of entry.keywords) {
    if (normalizedMessage.includes(normalize(keyword))) score += 3;
  }

  return score;
}

function formatParameterList(nodeType: NodeTypeId) {
  const parameters = parameterDefaults[nodeType] ?? [];
  if (!parameters.length) return "none";
  return parameters.map((parameter) => parameter.label).join(", ");
}

export function formatNodePlaybookForPrompt(
  userMessage: string,
  workflow: Workflow | null | undefined,
  expandedLimit = 14,
) {
  const workflowNodeTypes = new Set<NodeTypeId>(
    workflow?.nodes.map((node) => node.data.nodeType) ?? [],
  );

  const allNodeTypes = Object.keys(nodeCatalogMap) as NodeTypeId[];
  const expandedNodeTypes = [...allNodeTypes]
    .sort(
      (left, right) =>
        scoreNodeRelevance(right, userMessage, workflowNodeTypes) -
        scoreNodeRelevance(left, userMessage, workflowNodeTypes),
    )
    .slice(0, expandedLimit);

  const indexBlock = allNodeTypes
    .map((nodeType) => {
      const entry = PLAYBOOK[nodeType];
      return `- ${nodeType}: ${entry.summary} Key params: ${formatParameterList(nodeType)}.`;
    })
    .join("\n");

  const expandedBlock = expandedNodeTypes
    .map((nodeType) => {
      const entry = PLAYBOOK[nodeType];
      return `${nodeType}
- Use when: ${entry.useWhen}
- Avoid when: ${entry.avoidWhen}
- Expects: ${entry.expects}
- Emits: ${entry.emits}
- Canonical topology: ${entry.topology}
- Programming note: ${entry.programming}`;
    })
    .join("\n\n");

  return `[Node capability index]
${indexBlock}

[Expanded node playbook]
${expandedBlock}

[Planner discipline]
- First classify the workflow goal: ingestion, routing, analytics, monitoring, finance, experiment, or automation.
- Then choose the minimum correct topology before writing nodes.
- Then assign exact parameters and programmable logic.
- Then validate that every downstream node receives fields or artifacts it can actually use.
- Distinguish manual disable from blocked-by-flow. Dead branches stay visible unless the user explicitly asked to delete them.
- Shared downstream nodes must adapt to live inputs; exclusive downstream nodes become blocked when their only upstream source disappears.
- Place nodes in readable left-to-right columns with generous spacing and no overlap.
- Prefer semantic correctness over generic flows.`;
}
