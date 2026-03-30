"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Controls,
  type Edge,
  MiniMap,
  type NodeTypes,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import { AddNodePanel } from "@/components/canvas/AddNodePanel";
import { AIChatPanel } from "@/components/canvas/AIChatPanel";
import { ContextNodeMenu } from "@/components/canvas/ContextNodeMenu";
import { DrawingTools } from "@/components/canvas/DrawingTools";
import { FloatingToolbar } from "@/components/canvas/FloatingToolbar";
import { NodeConfigPanel } from "@/components/canvas/NodeConfigPanel";
import { WorkflowRuntimeBridge } from "@/components/runtime/WorkflowRuntimeBridge";
import ActionNode from "@/components/nodes/ActionNode";
import DashboardNode from "@/components/nodes/DashboardNode";
import {
  LandingAccessNode,
  LandingAudienceNode,
  LandingComponentsNode,
  LandingDifferenceNode,
  LandingFooterNode,
  LandingHeroNode,
  LandingPageMapNode,
  LandingProofNode,
  LandingSectionNode,
  LandingUseCaseNode,
  LandingWorkflowNode,
} from "@/components/nodes/LandingNodes";
import ShapeNode from "@/components/nodes/ShapeNode";
import TriggerNode from "@/components/nodes/TriggerNode";
import VizNode from "@/components/nodes/VizNode";
import type { AppNode, ToolMode, WorkflowNodeData } from "@/lib/flow-types";
import { useActiveWorkflow, useFlowStore } from "@/store/useFlowStore";

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  vizNode: VizNode,
  dashboardNode: DashboardNode,
  shapeNode: ShapeNode,
  landingHeroNode: LandingHeroNode,
  landingSectionNode: LandingSectionNode,
  landingPageMapNode: LandingPageMapNode,
  landingDifferenceNode: LandingDifferenceNode,
  landingWorkflowNode: LandingWorkflowNode,
  landingComponentsNode: LandingComponentsNode,
  landingUseCaseNode: LandingUseCaseNode,
  landingAudienceNode: LandingAudienceNode,
  landingProofNode: LandingProofNode,
  landingFooterNode: LandingFooterNode,
  landingAccessNode: LandingAccessNode,
} as unknown as NodeTypes;

const drawingTools: ToolMode[] = ["rect", "ellipse", "diamond", "arrow", "text"];
const EMPTY_NODES: AppNode[] = [];
const EMPTY_EDGES: Edge[] = [];

interface DrawState {
  startScreen: { x: number; y: number };
  startFlow: { x: number; y: number };
  currentScreen: { x: number; y: number };
  tool: ToolMode;
}

type NavigationDirection = "up" | "down" | "left" | "right";

export interface CanvasAppProps {
  mode?: "app" | "landing";
  onAccessClick?: () => void;
}

function isCandidateInDirection(dx: number, dy: number, direction: NavigationDirection) {
  const threshold = 8;

  if (direction === "left") return dx < -threshold;
  if (direction === "right") return dx > threshold;
  if (direction === "up") return dy < -threshold;
  return dy > threshold;
}

function getDirectionScore(dx: number, dy: number, direction: NavigationDirection) {
  if (direction === "left" || direction === "right") {
    return Math.abs(dx) + Math.abs(dy) * 0.45;
  }

  return Math.abs(dy) + Math.abs(dx) * 0.45;
}

function CanvasInner({ mode = "app", onAccessClick }: CanvasAppProps) {
  const activeWorkflow = useActiveWorkflow();
  const onNodesChange = useFlowStore((state) => state.onNodesChange);
  const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
  const onConnect = useFlowStore((state) => state.onConnect);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);
  const contextNodeIds = useFlowStore((state) => state.contextNodeIds);
  const toggleContextNode = useFlowStore((state) => state.toggleContextNode);
  const clearContextNodes = useFlowStore((state) => state.clearContextNodes);
  const rightClickCtx = useFlowStore((state) => state.rightClickCtx);
  const setRightClickCtx = useFlowStore((state) => state.setRightClickCtx);
  const activeTool = useFlowStore((state) => state.activeTool);
  const setActiveTool = useFlowStore((state) => state.setActiveTool);
  const addNode = useFlowStore((state) => state.addNode);
  const deleteNode = useFlowStore((state) => state.deleteNode);
  const deleteNodes = useFlowStore((state) => state.deleteNodes);
  const isAddNodePanelOpen = useFlowStore((state) => state.isAddNodePanelOpen);
  const { fitBounds, fitView, getViewport, screenToFlowPosition, setViewport } = useReactFlow();
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const restoreViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const focusedNodeIdRef = useRef<string | null>(null);
  const initialViewportWorkflowRef = useRef<string | null>(null);

  const nodes = activeWorkflow?.nodes ?? EMPTY_NODES;
  const edges = activeWorkflow?.edges ?? EMPTY_EDGES;
  const isDrawingMode = drawingTools.includes(activeTool);
  const isLandingMode = mode === "landing";

  const getNodeDimensions = useCallback((node: AppNode) => {
    const measuredWidth =
      "measured" in node && typeof node.measured?.width === "number"
        ? node.measured.width
        : undefined;
    const measuredHeight =
      "measured" in node && typeof node.measured?.height === "number"
        ? node.measured.height
        : undefined;

    if (measuredWidth && measuredHeight) {
      return { width: measuredWidth, height: measuredHeight };
    }

    if (typeof node.width === "number" && typeof node.height === "number") {
      return { width: node.width, height: node.height };
    }

    if (node.type === "dashboardNode") return { width: 540, height: 320 };
    if (node.type === "shapeNode") {
      return {
        width: typeof node.data.width === "number" ? node.data.width : 200,
        height: typeof node.data.height === "number" ? node.data.height : 120,
      };
    }
    if (node.type === "vizNode") {
      if (node.data.nodeType === "viz_metric") return { width: 220, height: 124 };
      if (node.data.nodeType === "viz_chart") return { width: 320, height: 154 };
      if (node.data.nodeType === "viz_table") return { width: 340, height: 168 };
      if (node.data.nodeType === "viz_report") return { width: 300, height: 292 };
      return { width: 280, height: 188 };
    }

    return { width: 240, height: 120 };
  }, []);

  const getNodeById = useCallback(
    (id: string) => nodes.find((node) => node.id === id),
    [nodes],
  );

  const getNodeCenter = useCallback(
    (node: AppNode) => {
      const { width, height } = getNodeDimensions(node);
      return {
        x: node.position.x + width / 2,
        y: node.position.y + height / 2,
      };
    },
    [getNodeDimensions],
  );

  const getNodesBounds = useCallback(
    (targetNodes: AppNode[]) => {
      if (targetNodes.length === 0) return null;

      const firstNode = targetNodes[0];
      const firstSize = getNodeDimensions(firstNode);
      const initialBounds = {
        minX: firstNode.position.x,
        minY: firstNode.position.y,
        maxX: firstNode.position.x + firstSize.width,
        maxY: firstNode.position.y + firstSize.height,
      };

      const bounds = targetNodes.slice(1).reduce((accumulator, node) => {
        const { width, height } = getNodeDimensions(node);
        return {
          minX: Math.min(accumulator.minX, node.position.x),
          minY: Math.min(accumulator.minY, node.position.y),
          maxX: Math.max(accumulator.maxX, node.position.x + width),
          maxY: Math.max(accumulator.maxY, node.position.y + height),
        };
      }, initialBounds);

      return {
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      };
    },
    [getNodeDimensions],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = getNodeById(nodeId);
      if (!node) return;

      if (!restoreViewportRef.current) {
        restoreViewportRef.current = getViewport();
      }

      focusedNodeIdRef.current = nodeId;
      const { width, height } = getNodeDimensions(node);
      fitBounds(
        {
          x: node.position.x,
          y: node.position.y,
          width,
          height,
        },
        {
          padding: 0.28,
          duration: 220,
        },
      );
    },
    [fitBounds, getNodeById, getNodeDimensions, getViewport],
  );

  const restoreFocusedViewport = useCallback(() => {
    if (restoreViewportRef.current) {
      setViewport(restoreViewportRef.current, { duration: 220 });
    }
    restoreViewportRef.current = null;
    focusedNodeIdRef.current = null;
  }, [setViewport]);

  const navigateToConnectedNode = useCallback(
    (direction: NavigationDirection) => {
      if (!selectedNodeId || !restoreViewportRef.current) return;

      const currentNode = getNodeById(selectedNodeId);
      if (!currentNode) return;

      const from = getNodeCenter(currentNode);
      const candidateIds = Array.from(
        new Set(
          edges.flatMap((edge) => {
            if (edge.source === selectedNodeId) return [edge.target];
            if (edge.target === selectedNodeId) return [edge.source];
            return [];
          }),
        ),
      );

      const nextNode = candidateIds
        .map((id) => getNodeById(id))
        .filter((node): node is AppNode => Boolean(node))
        .map((node) => {
          const center = getNodeCenter(node);
          const dx = center.x - from.x;
          const dy = center.y - from.y;
          return {
            node,
            dx,
            dy,
            score: getDirectionScore(dx, dy, direction),
          };
        })
        .filter(({ dx, dy }) => isCandidateInDirection(dx, dy, direction))
        .sort((left, right) => left.score - right.score)[0]?.node;

      if (!nextNode) return;

      setRightClickCtx(null);
      setSelectedNodeId(nextNode.id);
      focusNode(nextNode.id);
    },
    [edges, focusNode, getNodeById, getNodeCenter, selectedNodeId, setRightClickCtx, setSelectedNodeId],
  );

  useEffect(() => {
    if (!activeWorkflow?.id) return;
    if (initialViewportWorkflowRef.current === activeWorkflow.id) return;

    initialViewportWorkflowRef.current = activeWorkflow.id;
    restoreViewportRef.current = null;
    focusedNodeIdRef.current = null;

    const frameId = window.requestAnimationFrame(() => {
      if (isLandingMode) {
        const topSectionBounds = getNodesBounds(
          nodes.filter((node) => node.type !== "shapeNode" && node.position.y < 620),
        );

        if (topSectionBounds) {
          fitBounds(topSectionBounds, { padding: 0.12, duration: 320 });
          return;
        }
      }

      fitView({ padding: 0.22, duration: 300 });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeWorkflow?.id, fitBounds, fitView, getNodesBounds, isLandingMode, nodes]);

  useEffect(() => {
    if (!isLandingMode) return;

    const onFocusLandingNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId?: string }>;
      const nextNodeId = customEvent.detail?.nodeId;
      if (!nextNodeId) return;

      clearContextNodes();
      setRightClickCtx(null);
      setSelectedNodeId(nextNodeId);
      focusNode(nextNodeId);
    };

    window.addEventListener("flow-merge-focus-node", onFocusLandingNode);
    return () => window.removeEventListener("flow-merge-focus-node", onFocusLandingNode);
  }, [clearContextNodes, focusNode, isLandingMode, setRightClickCtx, setSelectedNodeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      const directionMap: Partial<Record<KeyboardEvent["key"], NavigationDirection>> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const direction = directionMap[event.key];

      if ((event.ctrlKey || event.metaKey) && direction) {
        event.preventDefault();
        navigateToConnectedNode(direction);
        return;
      }

      if (isLandingMode && event.key === "Escape") {
        setRightClickCtx(null);
        if (isDrawingMode) setActiveTool("select");
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (contextNodeIds.length) {
          if (contextNodeIds.includes(focusedNodeIdRef.current ?? "")) {
            restoreFocusedViewport();
          }
          deleteNodes(contextNodeIds);
          clearContextNodes();
          return;
        }
        if (selectedNodeId) {
          if (focusedNodeIdRef.current === selectedNodeId) {
            restoreFocusedViewport();
          }
          deleteNode(selectedNodeId);
        }
      }

      if (event.key === "Escape") {
        setRightClickCtx(null);
        if (isDrawingMode) setActiveTool("select");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearContextNodes,
    contextNodeIds,
    deleteNode,
    deleteNodes,
    isDrawingMode,
    navigateToConnectedNode,
    restoreFocusedViewport,
    selectedNodeId,
    setActiveTool,
    setRightClickCtx,
    isLandingMode,
  ]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: AppNode) => {
      if (activeTool === "eraser") {
        deleteNode(node.id);
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        restoreFocusedViewport();
        toggleContextNode(node.id);
        setSelectedNodeId(null);
        return;
      }

      clearContextNodes();
      setRightClickCtx(null);
      setSelectedNodeId(node.id);
      focusNode(node.id);
    },
    [
      activeTool,
      clearContextNodes,
      deleteNode,
      focusNode,
      isLandingMode,
      restoreFocusedViewport,
      setRightClickCtx,
      setSelectedNodeId,
      toggleContextNode,
    ],
  );

  const onPaneClick = useCallback(() => {
    restoreFocusedViewport();
    setSelectedNodeId(null);
    clearContextNodes();
    setRightClickCtx(null);
  }, [clearContextNodes, restoreFocusedViewport, setSelectedNodeId, setRightClickCtx]);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      if (isLandingMode) return;
      const clientX = "clientX" in event ? event.clientX : 0;
      const clientY = "clientY" in event ? event.clientY : 0;
      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
      setRightClickCtx({
        screenX: clientX,
        screenY: clientY,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    [isLandingMode, screenToFlowPosition, setRightClickCtx],
  );

  const handleDrawStart = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (activeTool === "text") {
        addNode({
          id: uuidv4(),
          type: "shapeNode",
          zIndex: -1,
          position: flowPosition,
          data: {
            label: "Text",
            nodeType: "viz_report",
            shapeType: "text",
            width: 180,
            height: 60,
            text: "",
          } as WorkflowNodeData,
        });
        setActiveTool("select");
        return;
      }

      setDrawState({
        startScreen: { x: event.clientX, y: event.clientY },
        startFlow: flowPosition,
        currentScreen: { x: event.clientX, y: event.clientY },
        tool: activeTool,
      });
    },
    [activeTool, addNode, screenToFlowPosition, setActiveTool],
  );

  const handleDrawMove = useCallback((event: React.MouseEvent) => {
    setDrawState((current) =>
      current
        ? { ...current, currentScreen: { x: event.clientX, y: event.clientY } }
        : current,
    );
  }, []);

  const handleDrawEnd = useCallback(
    (event: React.MouseEvent) => {
      if (!drawState) return;
      const endFlow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const width = Math.abs(endFlow.x - drawState.startFlow.x);
      const height = Math.abs(endFlow.y - drawState.startFlow.y);
      const position = {
        x: Math.min(drawState.startFlow.x, endFlow.x),
        y: Math.min(drawState.startFlow.y, endFlow.y),
      };
      const shapeType =
        drawState.tool === "rect"
          ? "rect"
          : drawState.tool === "ellipse"
            ? "ellipse"
            : drawState.tool === "diamond"
              ? "diamond"
              : "arrow";

      if (width > 6 || height > 6) {
        addNode({
          id: uuidv4(),
          type: "shapeNode",
          zIndex: -1,
          position,
          data: {
            label: shapeType,
            nodeType: "viz_report",
            shapeType,
            width: Math.max(width, 40),
            height: Math.max(height, 30),
          } as WorkflowNodeData,
        });
      }

      setDrawState(null);
      setActiveTool("select");
    },
    [addNode, drawState, screenToFlowPosition, setActiveTool],
  );

  const preview = useMemo(() => {
    if (!drawState) return null;
    const x = Math.min(drawState.startScreen.x, drawState.currentScreen.x);
    const y = Math.min(drawState.startScreen.y, drawState.currentScreen.y);
    const width = Math.abs(drawState.currentScreen.x - drawState.startScreen.x);
    const height = Math.abs(drawState.currentScreen.y - drawState.startScreen.y);
    const fill = "rgba(31,111,235,0.08)";
    const stroke = "#1f6feb";

    return (
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        {drawState.tool === "rect" ? (
          <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} stroke={stroke} strokeDasharray="4 3" />
        ) : null}
        {drawState.tool === "ellipse" ? (
          <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={fill} stroke={stroke} strokeDasharray="4 3" />
        ) : null}
        {drawState.tool === "diamond" ? (
          <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} fill={fill} stroke={stroke} strokeDasharray="4 3" />
        ) : null}
        {drawState.tool === "arrow" ? (
          <line x1={drawState.startScreen.x} y1={drawState.startScreen.y} x2={drawState.currentScreen.x} y2={drawState.currentScreen.y} stroke={stroke} strokeDasharray="4 3" />
        ) : null}
      </svg>
    );
  }, [drawState]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        key={activeWorkflow?.id}
        nodes={nodes.map((node) =>
          contextNodeIds.includes(node.id)
            ? {
                ...node,
                dragHandle: node.type === "dashboardNode" ? ".dashboard-node-drag-handle" : node.dragHandle,
                selected: true,
                style: {
                  ...(node.style ?? {}),
                  boxShadow: "0 0 0 2px rgba(88,166,255,0.5)",
                },
              }
            : selectedNodeId === node.id
              ? {
                  ...node,
                  dragHandle: node.type === "dashboardNode" ? ".dashboard-node-drag-handle" : node.dragHandle,
                  selected: true,
                }
              : {
                  ...node,
                  dragHandle: node.type === "dashboardNode" ? ".dashboard-node-drag-handle" : node.dragHandle,
                  selected: false,
                },
        )}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        selectionMode={SelectionMode.Partial}
        panOnDrag={activeTool === "hand" ? [0, 1, 2] : isDrawingMode ? false : [1, 2]}
        panOnScroll={isLandingMode || activeTool === "hand"}
        panOnScrollMode={isLandingMode ? PanOnScrollMode.Vertical : PanOnScrollMode.Free}
        zoomOnScroll={!isLandingMode}
        minZoom={0.1}
        maxZoom={3}
        fitView={!isLandingMode}
        fitViewOptions={isLandingMode ? undefined : { padding: 0.22 }}
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          animated: activeWorkflow?.active,
          style: { stroke: "#30363d", strokeWidth: 1.5 },
        }}
        nodesDraggable={!isDrawingMode}
        nodesConnectable={activeTool === "select"}
        elementsSelectable={!isDrawingMode}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
          nodeColor={(node) => {
            if (node.type === "triggerNode") return "#d29922";
            if (node.type === "vizNode" || node.type === "dashboardNode") return "#3fb950";
            if (node.type === "shapeNode") return "#30363d";
            return "#1f6feb";
          }}
          maskColor="rgba(13,17,23,0.65)"
        />
      </ReactFlow>

      {isDrawingMode ? (
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: activeTool === "text" ? "text" : "crosshair" }}
          onMouseDown={handleDrawStart}
          onMouseMove={handleDrawMove}
          onMouseUp={handleDrawEnd}
          onMouseLeave={() => setDrawState(null)}
        >
          {preview}
        </div>
      ) : null}

      <FloatingToolbar mode={mode} onAccessClick={onAccessClick} />
      {!isLandingMode ? <WorkflowRuntimeBridge /> : null}
      <DrawingTools />
      {!isLandingMode ? <AIChatPanel /> : null}
      {!isLandingMode ? <AddNodePanel /> : null}
      {!isLandingMode && !isAddNodePanelOpen ? <NodeConfigPanel /> : null}
      {!isLandingMode && rightClickCtx ? <ContextNodeMenu /> : null}
    </div>
  );
}

export default function CanvasApp({ mode = "app", onAccessClick }: CanvasAppProps) {
  return (
    <ReactFlowProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-[#0d1117]">
        <CanvasInner mode={mode} onAccessClick={onAccessClick} />
      </div>
    </ReactFlowProvider>
  );
}
