"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquarePlus,
  Send,
  X,
} from "lucide-react";
import type { AIResponse, NodeCommand } from "@/lib/deepseek";
import { streamDeepSeek } from "@/lib/deepseek";
import { GenerativeUIRenderer } from "@/components/canvas/GenerativeUIRenderer";
import { ICONS } from "@/components/nodes/SharedNodeComponents";
import { useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";
import type { AppNode, GenerativeComponent } from "@/lib/flow-types";

const EMPTY_NODES: AppNode[] = [];

function getDisplayContent(content: string) {
  try {
    const parsed = JSON.parse(content);
    return parsed.message ?? content;
  } catch {
    return content;
  }
}

function normalizeNodeRef(value: string) {
  return value.trim().toLowerCase();
}

function buildNodeReferenceMap(existingNodes: AppNode[], createdNodes: AppNode[], response: AIResponse) {
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
  return referenceMap.get(reference) ?? referenceMap.get(normalizeNodeRef(reference)) ?? null;
}

function extractEdgeCommands(commands?: NodeCommand[]) {
  return (commands ?? [])
    .filter((command) => command.command === "create_edge" && command.source && command.target)
    .map((command) => ({
      source: command.source!,
      target: command.target!,
      sourceHandle: command.sourceHandle ?? null,
      targetHandle: command.targetHandle ?? null,
    }));
}

export function AIChatPanel() {
  const activeWorkflow = useActiveWorkflow();
  const chatThreads = useFlowStore((state) => state.chatThreads);
  const activeChatId = useFlowStore((state) => state.activeChatId);
  const chatExpanded = useFlowStore((state) => state.chatExpanded);
  const setChatExpanded = useFlowStore((state) => state.setChatExpanded);
  const setActiveChat = useFlowStore((state) => state.setActiveChat);
  const createChat = useFlowStore((state) => state.createChat);
  const deleteChat = useFlowStore((state) => state.deleteChat);
  const addUserMessage = useFlowStore((state) => state.addUserMessage);
  const appendStreamChunk = useFlowStore((state) => state.appendStreamChunk);
  const resolveAssistantMessage = useFlowStore((state) => state.resolveAssistantMessage);
  const failAssistantMessage = useFlowStore((state) => state.failAssistantMessage);
  const deepseekKey = useFlowStore((state) => state.deepseekKey);
  const contextNodeIds = useFlowStore((state) => state.contextNodeIds);
  const clearContextNodes = useFlowStore((state) => state.clearContextNodes);
  const toggleContextNode = useFlowStore((state) => state.toggleContextNode);
  const addAiNodes = useFlowStore((state) => state.addAiNodes);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const deleteNode = useFlowStore((state) => state.deleteNode);
  const onConnect = useFlowStore((state) => state.onConnect);
  const nodes = activeWorkflow?.nodes ?? EMPTY_NODES;
  const [input, setInput] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  const activeThread = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatId) ?? chatThreads[0],
    [activeChatId, chatThreads],
  );

  const contextNodes = useMemo(
    () =>
      contextNodeIds
        .map((id) => nodes.find((node) => node.id === id))
        .filter(Boolean)
        .map((node) => ({
          id: node!.id,
          label: node!.data.label,
          nodeType: node!.data.nodeType,
          icon: node!.data.icon,
          accent: node!.data.accent,
          parameters: node!.data.parameters,
          config: node!.data.config,
        })),
    [contextNodeIds, nodes],
  );

  useEffect(() => {
    if (!chatExpanded) return;

    const onMouseDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setChatExpanded(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [chatExpanded, setChatExpanded]);

  const handleSend = async () => {
    const value = input.trim();
    if (!value || !activeThread || activeThread.isStreaming) return;
    setInput("");

    const threadId = activeThread.id;
    const history = activeThread.messages
      .filter((message) => !message.streaming)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    addUserMessage(value, threadId);

    await streamDeepSeek(
      deepseekKey,
      value,
      history,
      contextNodes,
      activeWorkflow,
      (chunk) => appendStreamChunk(threadId, chunk),
      (parsed) => {
        resolveAssistantMessage(threadId, parsed.message, (parsed.ui as GenerativeComponent[]) ?? []);

        let createdNodes: AppNode[] = [];
        if (parsed.nodes?.length) {
          createdNodes = addAiNodes(parsed.nodes);
        }

        const referenceMap = buildNodeReferenceMap(nodes, createdNodes, parsed);
        const explicitEdges = [...(parsed.edges ?? []), ...extractEdgeCommands(parsed.commands)];

        parsed.commands?.forEach((command) => {
          if (command.command === "update_node" && command.nodeId && command.data) {
            const resolvedNodeId = resolveNodeReference(referenceMap, command.nodeId);
            if (resolvedNodeId) {
              updateNodeData(resolvedNodeId, command.data);
            }
          }
          if (command.command === "delete_node" && command.nodeId) {
            const resolvedNodeId = resolveNodeReference(referenceMap, command.nodeId);
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
            onConnect({
              source: createdNodes[index - 1].id,
              target: node.id,
              sourceHandle: null,
              targetHandle: null,
            });
          });
        }
      },
      (error) => {
        failAssistantMessage(threadId, error);
      },
    );
  };

  const messageCount = activeThread?.messages.length ?? 0;
  const isStreaming = activeThread?.isStreaming ?? false;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-3 left-1/2 z-30 flex w-[760px] -translate-x-1/2 flex-col"
    >
      <AnimatePresence>
        {chatExpanded && activeThread ? (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 8 }}
            animate={{ height: 360, opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fc-panel mb-1 flex flex-col overflow-hidden"
            style={{ background: "rgba(13,17,23,0.96)", backdropFilter: "blur(16px)" }}
          >
            <div className="border-b border-[#30363d] px-2 py-2">
              <div className="flex items-center gap-2 overflow-x-auto">
                {chatThreads.map((thread) => {
                  const isActive = thread.id === activeThread.id;
                  return (
                    <div
                      key={thread.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveChat(thread.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveChat(thread.id);
                        }
                      }}
                      className="flex shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 transition-colors"
                      style={{
                        borderColor: isActive ? "#1f6feb" : "#30363d",
                        background: isActive ? "#0c1a2e" : "#161b22",
                      }}
                    >
                      <span
                        className="max-w-[160px] truncate text-[11px] font-medium"
                        style={{ color: isActive ? "#e6edf3" : "#7d8590" }}
                      >
                        {thread.title}
                      </span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteChat(thread.id);
                        }}
                        className="group relative flex h-5 min-w-5 items-center justify-center rounded border border-[#30363d] bg-[#0d1117] px-1 text-[10px] text-[#7d8590] transition-colors hover:border-[#f85149] hover:text-[#f85149]"
                      >
                        <span className="transition-opacity group-hover:opacity-0">
                          {thread.messages.length}
                        </span>
                        <span className="absolute opacity-0 transition-opacity group-hover:opacity-100">
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={() => {
                    createChat();
                    setInput("");
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-[#30363d] text-[#7d8590] transition-colors hover:border-[#1f6feb] hover:bg-[#0c1a2e] hover:text-[#58a6ff]"
                  title="Nova conversa"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-3">
                {activeThread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "flex flex-col items-end"
                        : "flex flex-col items-start"
                    }
                  >
                    <span className="mb-1 px-1 text-[9px] font-mono uppercase tracking-[0.14em] text-[#3d444d]">
                      {message.role === "user" ? "you" : "ai"}
                    </span>
                    {message.role === "user" ? (
                      <div
                        className="max-w-[84%] rounded-md border px-3 py-2 text-xs leading-relaxed"
                        style={{
                          background: "#0c1a2e",
                          borderColor: "#1f6feb33",
                        }}
                      >
                        <span className="whitespace-pre-wrap text-[#e6edf3]">
                          {getDisplayContent(message.content)}
                        </span>
                      </div>
                    ) : (
                      <div className="max-w-[84%] px-1 py-1 text-xs leading-relaxed text-[#c9d1d9]">
                        {message.streaming ? (
                          <span className="flex items-center gap-2 text-[#7d8590]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1f6feb]" />
                            Generating...
                          </span>
                        ) : (
                          <>
                            <span className="whitespace-pre-wrap">
                              {getDisplayContent(message.content)}
                            </span>
                            {message.generativeUI?.length ? (
                              <GenerativeUIRenderer components={message.generativeUI} />
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="fc-panel overflow-hidden"
        style={{ background: "rgba(22,27,34,0.97)", backdropFilter: "blur(16px)" }}
      >
        {contextNodes.length ? (
          <div className="flex flex-wrap items-center gap-1 px-3 pt-2">
            <span className="mr-1 text-[9px] font-mono uppercase tracking-[0.14em] text-[#3d444d]">
              context
            </span>
            {contextNodes.map((node) => (
              <span
                key={node.id}
                className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px]"
                style={{ background: "#1f6feb14", borderColor: "#1f6feb30", color: "#58a6ff" }}
              >
                {(() => {
                  const Icon = node.icon ? ICONS[node.icon as string] : undefined;
                  return Icon ? <Icon className="h-3 w-3" /> : null;
                })()}
                {node.label}
                <button
                  onClick={() => toggleContextNode(node.id)}
                  className="rounded p-0.5 transition-colors hover:bg-[#1f6feb22]"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {contextNodes.length > 1 ? (
              <button
                onClick={clearContextNodes}
                className="ml-1 text-[9px] text-[#3d444d] hover:text-[#f85149]"
              >
                clear all
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isStreaming ? "bg-[#d29922]" : "bg-[#a371f7]"}`}
            />
            <Bot className="h-3.5 w-3.5 text-[#3d444d]" />
          </div>

          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            onFocus={() => setChatExpanded(true)}
            placeholder={
              contextNodes.length
                ? `Pergunte sobre ${contextNodes.length} node${contextNodes.length > 1 ? "s" : ""} em contexto...`
                : "Peca para a IA montar um workflow, analisar dados ou editar o canvas..."
            }
            className="flex-1 border-none bg-transparent text-xs text-[#e6edf3] outline-none placeholder:text-[#3d444d]"
          />

          <span className="rounded border border-[#30363d] px-2 py-1 text-[10px] text-[#7d8590]">
            {messageCount} msgs
          </span>

          <button
            onClick={() => setChatExpanded(!chatExpanded)}
            className="rounded p-1 text-[#3d444d] transition-colors hover:bg-[#21262d] hover:text-[#7d8590]"
          >
            {chatExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            className="rounded p-1 text-[#1f6feb] transition-colors hover:bg-[#1f6feb14] disabled:opacity-30"
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
