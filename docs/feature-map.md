# Feature Map

## Macroareas

### 1. Acesso local

Objetivo:

- abrir o workspace somente apos autenticacao local

Capacidades:

- criar acesso local
- validar login
- manter sessao local
- logout

Arquivos-chave:

- `src/components/app/LandingPage.tsx`
- `src/store/useAuthStore.ts`
- `src/lib/local-auth.ts`

## 2. Organizacao de trabalho

Objetivo:

- permitir que o operador separe o trabalho por projeto e workflow

Capacidades:

- criar projeto
- alternar projeto ativo
- criar workflow
- duplicar workflow
- renomear workflow
- ativar ou desativar projeto e workflow

Arquivos-chave:

- `src/components/canvas/FloatingToolbar.tsx`
- `src/store/useFlowStore.ts`

## 3. Canvas e modelagem

Objetivo:

- construir o fluxo e suas estruturas visuais no mesmo plano

Capacidades:

- adicionar nodes do catalogo
- conectar nodes
- editar nodes
- desenhar formas
- navegar com foco entre nodes conectados
- abrir menu contextual

Arquivos-chave:

- `src/components/canvas/CanvasApp.tsx`
- `src/components/canvas/AddNodePanel.tsx`
- `src/components/canvas/ContextNodeMenu.tsx`
- `src/components/canvas/DrawingTools.tsx`
- `src/components/canvas/NodeConfigPanel.tsx`

## 4. Catalogo de nodes

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

## 5. Runtime e execucao

Objetivo:

- transformar o canvas em um sistema executavel

Capacidades:

- run manual
- run por schedule
- run por webhook
- snapshots por node
- logs e resumo de execucao
- patches para nodes visuais
- resposta HTTP ao chamador

Arquivos-chave:

- `src/lib/runtime-engine.ts`
- `src/components/runtime/WorkflowRuntimeBridge.tsx`
- `src/store/useFlowStore.ts`

## 6. Analytics dentro do fluxo

Objetivo:

- evitar separar automacao e leitura

Capacidades:

- armazenar eventos
- agregar dados
- comparar fontes
- montar funis
- segmentar
- enriquecer com contexto
- alimentar metricas e tabelas

Resultado:

- analytics deixa de ser camada separada e vira parte da topologia do workflow

## 7. Visualizacao no proprio canvas

Objetivo:

- permitir leitura operacional imediata

Capacidades:

- metricas inline
- charts inline
- tabelas inline
- reports inline
- dashboards dentro do node

Arquivos-chave:

- `src/components/nodes/VizNode.tsx`
- `src/components/nodes/DashboardNode.tsx`
- `src/lib/runtime-engine.ts`

## 8. Assistente de IA

Objetivo:

- editar e explicar o workflow a partir de contexto real

Capacidades:

- chat persistido localmente
- mensagem de boas-vindas
- nodes selecionados como contexto
- UI generativa no canvas
- suporte a montagem de workflows e dashboards

Arquivos-chave:

- `src/components/canvas/AIChatPanel.tsx`
- `src/lib/deepseek.ts`
- `src/store/useFlowStore.ts`

## 9. Runtime desktop

Objetivo:

- permitir operacao local real sem backend obrigatorio

Capacidades:

- servidor localhost para webhooks
- sincronizacao de rotas
- devolucao da resposta HTTP
- status do runtime

Arquivos-chave:

- `src-tauri/src/lib.rs`
- `src/lib/tauri-runtime.ts`
- `src/components/runtime/WorkflowRuntimeBridge.tsx`

## 10. Updater desktop

Objetivo:

- distribuir novas versoes por canal

Capacidades:

- checagem por `stable`, `beta` e `internal`
- download em background
- instalacao no fechamento
- acao manual de aplicar update

Arquivos-chave:

- `src/components/runtime/DesktopUpdateBridge.tsx`
- `src/lib/desktop-updater.ts`
- `src/components/canvas/SettingsModalView.tsx`

## Jornadas principais

### Jornada 1. Primeiro acesso

1. usuario abre a app
2. landing mostra proposta do produto
3. usuario cria ou usa acesso local
4. shell abre o canvas

### Jornada 2. Criar um workflow operacional

1. criar projeto
2. criar workflow
3. adicionar trigger
4. conectar action nodes
5. adicionar analytics nodes
6. adicionar viz nodes
7. salvar e executar

### Jornada 3. Receber um webhook e responder

1. trigger webhook registra rota local
2. sistema externo envia evento
3. runtime Rust recebe e encaminha
4. workflow processa
5. action respond devolve resposta
6. snapshots e visualizacoes sao atualizados

### Jornada 4. Operar e interpretar

1. run acontece
2. snapshots por node mudam
3. metricas e tabelas atualizam no canvas
4. operador le impacto no proprio fluxo
5. operador ajusta configuracao ou pede ajuda para a IA

### Jornada 5. Atualizacao desktop

1. app checa o feed do canal
2. encontra versao nova
3. baixa em background
4. instala ao fechar ou quando o usuario pede

## Casos de uso ideais para demonstracao

- receita por webhook de checkout
- comparacao de variante A/B
- monitoramento de erros por servico
- funil de conversao de trial para paid
- relatorio de crescimento com insight de IA
