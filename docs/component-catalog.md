# Component Catalog

## Estrutura de diretorios

### `src/app`

- `layout.tsx`
  - shell global do App Router
- `page.tsx`
  - entrada principal da home
- `globals.css`
  - tokens, skin do canvas e estilos globais

### `src/components/app`

- `FlowMergeShell.tsx`
  - boot, hydrate auth e roteamento entre landing e canvas
- `LandingPage.tsx`
  - experiencia de entrada e acesso local

### `src/components/canvas`

- `CanvasApp.tsx`
  - superficie principal do editor e React Flow
- `CanvasEntry.tsx`
  - carregamento dinamico do canvas
- `FloatingToolbar.tsx`
  - navega projeto, workflow e acoes centrais
- `AddNodePanel.tsx`
  - catalogo navegavel de nodes
- `NodeConfigPanel.tsx`
  - configuracao do node selecionado
- `AIChatPanel.tsx`
  - chat contextual com IA
- `DrawingTools.tsx`
  - ferramentas de desenho e anotacao
- `ContextNodeMenu.tsx`
  - menu de clique direito
- `ProgrammableEditor.tsx`
  - experiencia de programacao inline
- `SettingsModalView.tsx`
  - configuracoes locais do app, updater e sessao
- `GenerativeUIRenderer.tsx`
  - render de blocos gerados pela IA

### `src/components/nodes`

- `TriggerNode.tsx`
- `ActionNode.tsx`
- `VizNode.tsx`
- `DashboardNode.tsx`
- `ShapeNode.tsx`
- `SharedNodeComponents.tsx`

Esses arquivos implementam as cascas visuais do catalogo.

### `src/components/runtime`

- `WorkflowRuntimeBridge.tsx`
  - liga runtime Rust ao store e ao frontend
- `DesktopUpdateBridge.tsx`
  - liga updater desktop ao frontend

### `src/lib`

Arquivos de dominio e infraestrutura:

- `node-catalog.ts`
- `node-config.ts`
- `node-docs.ts`
- `node-programming.ts`
- `runtime-engine.ts`
- `runtime-storage.ts`
- `runtime-types.ts`
- `tauri-runtime.ts`
- `desktop-updater.ts`
- `deepseek.ts`
- `workflow-intelligence.ts`
- `local-auth.ts`
- `mock-data.ts`
- `flow-types.ts`

### `src/store`

- `useFlowStore.ts`
  - store central do produto
- `useAuthStore.ts`
  - store da autenticacao local

### `src-tauri`

- `src/lib.rs`
  - runtime local, webhooks e updater
- `tauri.conf.json`
  - configuracao do shell desktop
- `updater.dev.pubkey`
  - chave publica fallback
- `capabilities/default.json`
  - permissoes do shell

### `scripts`

- `tauri-cli.ts`
  - wrapper do Tauri CLI
- `build-updater-manifest.ts`
  - gera `latest.json`
- `updater-doctor.ts`
  - valida setup de updater
- `verify-node-compatibility.ts`
  - utilitario de consistencia do catalogo
- `generate_icons.py`
  - geracao de assets de icone

## Componentes principais do produto

## App shell

| Componente | Papel |
| --- | --- |
| `FlowMergeShell` | Boot da app, hydrate auth, escolhe entre landing e canvas |
| `LandingPage` | Entrada do produto e acesso local |
| `CanvasEntry` | Boundary client-side para o canvas |

## Operacao do canvas

| Componente | Papel |
| --- | --- |
| `CanvasApp` | Workspace principal |
| `FloatingToolbar` | Projeto, workflow, save, run e settings |
| `AddNodePanel` | Adicao de nodes por categoria |
| `NodeConfigPanel` | Configuracao e docs do node |
| `AIChatPanel` | Assistente contextual |
| `DrawingTools` | Shape tools e markup |

## Runtime

| Componente | Papel |
| --- | --- |
| `WorkflowRuntimeBridge` | Fluxo webhook e schedule para execucao |
| `DesktopUpdateBridge` | Checagem e instalacao de updates |

## Node shells

| Shell | Uso |
| --- | --- |
| `TriggerNode` | Entrada de fluxo |
| `ActionNode` | Processamento e integracao |
| `VizNode` | Metricas, charts, tabelas, reports |
| `DashboardNode` | Dashboard com widgets |
| `ShapeNode` | Formas e anotacoes |

## Catalogo de nodes por categoria

### Triggers

- Manual Trigger
- Webhook
- Schedule

### Core

- If
- Switch
- Merge
- Split In Batches
- Set
- Filter
- Code
- Function
- Wait
- HTTP Request
- Respond

### Analytics

- Data Store
- Aggregate
- Compare
- A/B Analyzer
- Funnel Builder
- Segment
- Enrich Data

### Monitoring

- Error Monitor
- Alert
- Revenue Tracker

### Visualization

- Metric Card
- Chart
- Table
- Report
- Funnel Chart
- Dashboard Canvas

### Integrations

- Email
- Slack
- Notion
- GitHub
- OpenAI

## Dependencias de produto

### UI e frontend

- `next`
- `react`
- `framer-motion`
- `lucide-react`
- `@xyflow/react`
- `recharts`
- `@monaco-editor/react`

### Estado e validacao

- `zustand`
- `zod`
- `uuid`

### Desktop

- `@tauri-apps/api`
- `@tauri-apps/plugin-updater`
- `@tauri-apps/plugin-process`

### Tooling

- `biome`
- `typescript`
- `tailwindcss`

## Scripts importantes

| Script | Funcao |
| --- | --- |
| `bun run dev` | desenvolvimento web |
| `bun run build` | build Next |
| `bun run lint` | lint com Biome |
| `bun run check` | check geral com Biome |
| `bun run tauri build` | build desktop via wrapper |
| `bun run updater:doctor` | diagnostico de updater |
| `bun run updater:manifest` | gera manifest de canal |

## Artefatos conceituais mais importantes

- `Project`
- `Workflow`
- `AppNode`
- `RuntimeEnvelope`
- `RuntimeArtifact`
- `ChatThread`
- `AppUpdateSnapshot`

## Como ler o codigo rapidamente

1. Comecar por `src/components/app/FlowMergeShell.tsx`
2. Depois `src/store/useAuthStore.ts`
3. Depois `src/components/canvas/CanvasApp.tsx`
4. Em seguida `src/store/useFlowStore.ts`
5. Depois `src/lib/runtime-engine.ts`
6. Por fim `src-tauri/src/lib.rs`

Essa ordem explica o produto da entrada ate o runtime.
