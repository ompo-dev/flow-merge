# Flow Merge Runtime Architecture

## Goal

Flow Merge is not only a canvas editor. It is a local operating runtime for SaaS and micro-SaaS creators that need to:

- ingest product and business events
- persist analytics collections locally
- transform and compare runtime data inside workflows
- enrich, segment, aggregate, monitor and alert on top of those events
- drive visual nodes from real outputs
- accept webhook traffic from external applications

## Layers

### 1. Editor layer

The canvas, node menu, config panel and visual nodes live in the editor layer.

Responsibilities:

- describe workflow topology
- edit node parameters and config
- render runtime status and latest visual output

Files:

- `src/components/canvas/*`
- `src/components/nodes/*`

### 2. Runtime engine

The runtime engine executes the graph.

Responsibilities:

- select the trigger node
- propagate payloads through edges
- route branching nodes using source handles
- merge multi-input nodes
- mutate local analytics stores
- produce patches for visual nodes
- produce webhook responses when `action_respond` is present

Files:

- `src/lib/runtime-engine.ts`
- `src/lib/runtime-types.ts`
- `src/lib/runtime-storage.ts`

### 3. State orchestration

The Zustand store connects editor and runtime.

Responsibilities:

- persist analytics stores per project
- persist node runtime snapshots per workflow
- apply visual patches to nodes after each execution
- store execution history
- expose runtime base URL to the UI

Files:

- `src/store/useFlowStore.ts`

### 4. Desktop runtime bridge

The Tauri side exposes a localhost webhook server and forwards deliveries to the frontend runtime.

Responsibilities:

- receive HTTP webhook calls on localhost
- validate route and optional shared secret
- emit delivery events into the desktop app
- wait for workflow completion
- send the resulting HTTP response back to the caller

Files:

- `src-tauri/src/lib.rs`
- `src/lib/tauri-runtime.ts`
- `src/components/runtime/WorkflowRuntimeBridge.tsx`

## Execution model

1. External app hits local webhook or the operator runs a workflow manually.
2. Runtime bridge turns that into a `WorkflowExecutionRequest`.
3. Runtime engine executes the graph node by node.
4. Each node handler returns:
   - output envelopes
   - runtime summary
   - optional node patch
   - optional webhook response
5. Store applies:
   - execution history
   - node runtime snapshots
   - visual node config updates
   - analytics store changes

## Important constraints

- This runtime is local-first.
- Code and function nodes execute locally.
- Integration nodes become real only when credentials and endpoints are configured on the node.
- Schedule triggers are currently driven by the open desktop session.
- Webhook triggers are desktop-native and use the embedded Tauri server.

## Next build-out blocks

1. Project-level secrets and connector profiles.
2. Dedicated visual rendering for runtime-backed dashboard widgets.
3. Retry, dead-letter and node-level error policies.
4. Background scheduling independent of the visible window.
5. Project installer snippets for JS, Node, Python and Go webhook clients.
