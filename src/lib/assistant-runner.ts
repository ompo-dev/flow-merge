import { streamDeepSeek, type AIResponse, type NodeCommand } from "@/lib/deepseek";
import type {
  AppNode,
  GenerativeComponent,
  Workflow,
} from "@/lib/flow-types";

export interface AssistantContextNode {
  id: string;
  label: string;
  nodeType: AppNode["data"]["nodeType"];
  icon?: unknown;
  accent?: unknown;
  parameters?: Record<string, string>;
  config?: Record<string, unknown>;
}

interface AssistantMutationApi {
  addAiNodes: (nodes: NonNullable<AIResponse["nodes"]>) => AppNode[];
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  onConnect: (connection: {
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
  }) => void;
}

export interface AssistantExecutionInput extends AssistantMutationApi {
  prompt: string;
  apiKey: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  contextNodes: AssistantContextNode[];
  workflow: Workflow | null | undefined;
  existingNodes: AppNode[];
  applyChanges?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface AssistantExecutionResult {
  response: AIResponse;
  createdNodes: AppNode[];
  appliedEdges: number;
  generativeUI: GenerativeComponent[];
}

function normalizeNodeRef(value: string) {
  return value.trim().toLowerCase();
}

function buildNodeReferenceMap(
  existingNodes: AppNode[],
  createdNodes: AppNode[],
  response: AIResponse,
) {
  const references = new Map<string, string>();

  [...existingNodes, ...createdNodes].forEach((node) => {
    references.set(node.id, node.id);
    references.set(normalizeNodeRef(node.id), node.id);
    references.set(normalizeNodeRef(String(node.data.label)), node.id);
  });

  response.nodes?.forEach((spec, index) => {
    const createdNode = createdNodes[index];
    if (!createdNode) return;
    if (spec.alias) {
      references.set(normalizeNodeRef(spec.alias), createdNode.id);
    }
  });

  return references;
}

function resolveNodeReference(referenceMap: Map<string, string>, reference?: string) {
  if (!reference) return null;
  return (
    referenceMap.get(reference) ??
    referenceMap.get(normalizeNodeRef(reference)) ??
    null
  );
}

function extractEdgeCommands(commands?: NodeCommand[]) {
  return (commands ?? [])
    .filter(
      (command) =>
        command.command === "create_edge" && command.source && command.target,
    )
    .map((command) => ({
      source: command.source!,
      target: command.target!,
      sourceHandle: command.sourceHandle ?? null,
      targetHandle: command.targetHandle ?? null,
    }));
}

export async function runFlowMergeAssistant({
  prompt,
  apiKey,
  history = [],
  contextNodes,
  workflow,
  existingNodes,
  applyChanges = true,
  addAiNodes,
  updateNodeData,
  deleteNode,
  onConnect,
  onChunk,
}: AssistantExecutionInput): Promise<AssistantExecutionResult> {
  return new Promise((resolve, reject) => {
    void streamDeepSeek(
      apiKey,
      prompt,
      history,
      contextNodes,
      workflow,
      (chunk) => {
        onChunk?.(chunk);
      },
      (parsed) => {
        let createdNodes: AppNode[] = [];
        let appliedEdges = 0;

        if (applyChanges && parsed.nodes?.length) {
          createdNodes = addAiNodes(parsed.nodes);
        }

        if (applyChanges) {
          const referenceMap = buildNodeReferenceMap(
            existingNodes,
            createdNodes,
            parsed,
          );
          const explicitEdges = [
            ...(parsed.edges ?? []),
            ...extractEdgeCommands(parsed.commands),
          ];

          parsed.commands?.forEach((command) => {
            if (
              command.command === "update_node" &&
              command.nodeId &&
              command.data
            ) {
              const resolvedNodeId = resolveNodeReference(
                referenceMap,
                command.nodeId,
              );
              if (resolvedNodeId) {
                updateNodeData(resolvedNodeId, command.data);
              }
            }

            if (command.command === "delete_node" && command.nodeId) {
              const resolvedNodeId = resolveNodeReference(
                referenceMap,
                command.nodeId,
              );
              if (resolvedNodeId) {
                deleteNode(resolvedNodeId);
              }
            }
          });

          if (explicitEdges.length) {
            explicitEdges.forEach((edge) => {
              const source = resolveNodeReference(referenceMap, edge.source);
              const target = resolveNodeReference(referenceMap, edge.target);
              if (!source || !target || source === target) return;

              appliedEdges += 1;
              onConnect({
                source,
                target,
                sourceHandle: edge.sourceHandle ?? null,
                targetHandle: edge.targetHandle ?? null,
              });
            });
          } else if (createdNodes.length) {
            createdNodes.forEach((node, index) => {
              if (index === 0) return;

              appliedEdges += 1;
              onConnect({
                source: createdNodes[index - 1].id,
                target: node.id,
                sourceHandle: null,
                targetHandle: null,
              });
            });
          }
        }

        resolve({
          response: parsed,
          createdNodes,
          appliedEdges,
          generativeUI:
            (parsed.ui as GenerativeComponent[] | undefined) ?? [],
        });
      },
      (error) => {
        reject(new Error(error));
      },
    );
  });
}
