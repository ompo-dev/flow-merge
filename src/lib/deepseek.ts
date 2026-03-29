import { allowedAiNodeTypes, type NodeTypeId } from "@/lib/node-catalog";
import type { AiNodeSpec, GenerativeComponent } from "@/lib/flow-types";

export interface NodeCommand {
  command: "update_node" | "delete_node" | "create_edge";
  nodeId?: string;
  data?: Record<string, unknown>;
  source?: string;
  target?: string;
}

export interface AIResponse {
  action: "create_nodes" | "show_analysis" | "chat" | "modify";
  message: string;
  nodes?: AiNodeSpec[];
  commands?: NodeCommand[];
  ui?: GenerativeComponent[];
}

const SYSTEM_PROMPT = `You are Flow Merge AI, an embedded workflow automation and analytics assistant.

You operate a canvas-based app for indie hackers and SaaS founders.
Respond ONLY with valid JSON. No markdown. No code fences.

Allowed nodeType values:
${allowedAiNodeTypes.join(", ")}

Response format:
{
  "action": "create_nodes" | "show_analysis" | "chat" | "modify",
  "message": "Short explanation",
  "nodes": [
    {
      "nodeType": "trigger_webhook",
      "label": "Webhook",
      "description": "optional",
      "notes": "optional",
      "parameters": { "Path": "/webhook" },
      "chartType": "line",
      "vizVariant": "revenue"
    }
  ],
  "commands": [
    { "command": "update_node", "nodeId": "node-id", "data": { "label": "New label" } },
    { "command": "delete_node", "nodeId": "node-id" },
    { "command": "create_edge", "source": "node-a", "target": "node-b" }
  ],
  "ui": [
    { "component": "metric", "props": { "label": "MRR", "value": "$12,450", "trend": "+5.2%" } },
    { "component": "chart", "props": { "type": "line", "title": "Revenue", "data": [{ "name": "Mon", "value": 12 }] } },
    { "component": "table", "props": { "title": "Top events", "columns": ["Event", "Count"], "rows": [["signup", "142"]] } },
    { "component": "text", "props": { "content": "Short insight" } }
  ]
}

When context nodes are provided, you may modify them using commands.
If the user asks to build a workflow, prefer action="create_nodes".
If the user asks to analyze something, prefer action="show_analysis".
If the user asks to edit existing nodes, prefer action="modify".`;

function normalizeRawJson(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractJsonStringField(raw: string, field: string) {
  const fieldToken = `"${field}"`;
  const fieldIndex = raw.indexOf(fieldToken);
  if (fieldIndex === -1) return null;

  const colonIndex = raw.indexOf(":", fieldIndex + fieldToken.length);
  if (colonIndex === -1) return null;

  const firstQuoteIndex = raw.indexOf('"', colonIndex + 1);
  if (firstQuoteIndex === -1) return null;

  let value = "";
  let escaped = false;

  for (let index = firstQuoteIndex + 1; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return value
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }

    value += char;
  }

  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseMaybeJson(value: string): AIResponse {
  const cleaned = normalizeRawJson(value);

  try {
    return JSON.parse(cleaned) as AIResponse;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as AIResponse;
      } catch {
        // continue to structured field extraction
      }
    }

    const action = extractJsonStringField(cleaned, "action");
    const message = extractJsonStringField(cleaned, "message");

    if (message) {
      return {
        action:
          action === "create_nodes" ||
          action === "show_analysis" ||
          action === "modify" ||
          action === "chat"
            ? action
            : "chat",
        message,
      };
    }

    return { action: "chat", message: cleaned };
  }
}

export async function streamDeepSeek(
  apiKey: string,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  contextNodes: Array<{
    id: string;
    label: string;
    nodeType: NodeTypeId;
    parameters?: Record<string, string>;
    config?: Record<string, unknown>;
  }>,
  onChunk: (chunk: string) => void,
  onDone: (response: AIResponse) => void,
  onError: (error: string) => void,
) {
  if (!apiKey) {
    onError("DeepSeek API key não configurada. Abra Settings no header e adicione a chave.");
    return;
  }

  const contextPrefix = contextNodes.length
    ? `[Context nodes]\n${contextNodes
        .map(
          (node) =>
            `- ${node.label} (id: ${node.id}, nodeType: ${node.nodeType}, parameters: ${JSON.stringify(node.parameters ?? {})}, config: ${JSON.stringify(node.config ?? {})})`,
        )
        .join("\n")}\n\n`
    : "";

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-8),
    { role: "user", content: `${contextPrefix}${userMessage}` },
  ];

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        stream: true,
        max_tokens: 1800,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      onError(`DeepSeek retornou ${response.status}.`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("Não foi possível abrir o stream da resposta.");
      return;
    }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));
      for (const line of lines) {
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        } catch {
          continue;
        }
      }
    }

    onDone(parseMaybeJson(fullText));
  } catch (error) {
    onError(error instanceof Error ? error.message : "Erro de rede ao chamar DeepSeek.");
  }
}
