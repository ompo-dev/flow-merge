export interface McpCatalogEntry {
  name: string;
  title: string;
  description: string;
}

export const MCP_TOOL_CATALOG: McpCatalogEntry[] = [
  {
    name: "flow_merge_workspace_snapshot",
    title: "Workspace snapshot",
    description:
      "Resume projetos, workflows, status comercial e o estado ativo do workspace local.",
  },
  {
    name: "flow_merge_get_node_catalog",
    title: "Node catalog",
    description:
      "Explica os tipos de node, schemas e defaults para o cliente MCP montar o fluxo com o proprio modelo.",
  },
  {
    name: "flow_merge_get_workflow",
    title: "Get workflow",
    description:
      "Retorna o JSON completo do workflow ativo ou de um workflow especifico.",
  },
  {
    name: "flow_merge_create_project",
    title: "Create project",
    description:
      "Cria um projeto local no Flow Merge sem depender da IA nativa do app.",
  },
  {
    name: "flow_merge_create_workflow",
    title: "Create workflow",
    description:
      "Cria um workflow no projeto desejado e permite ativar esse contexto no app local.",
  },
  {
    name: "flow_merge_apply_workspace_change_set",
    title: "Apply workspace change set",
    description:
      "Aplica operacoes deterministicas de projeto, workflow e ferramenta ativa sem atravessar a IA nativa.",
  },
  {
    name: "flow_merge_set_active_workflow",
    title: "Set active workflow",
    description:
      "Muda o workflow ativo dentro do app local para alinhar o contexto do operador.",
  },
  {
    name: "flow_merge_apply_workflow_change_set",
    title: "Apply workflow change set",
    description:
      "Aplica um conjunto deterministico de criacao, atualizacao e remocao de nodes e edges no canvas local.",
  },
];

export const MCP_RESOURCE_CATALOG: McpCatalogEntry[] = [
  {
    name: "flowmerge://workspace/snapshot",
    title: "Workspace snapshot",
    description: "Estado local do workspace com projetos, workflows e contexto ativo.",
  },
  {
    name: "flowmerge://license/status",
    title: "License status",
    description: "Estado comercial e de acesso da conta autenticada nesta instalacao.",
  },
  {
    name: "flowmerge://workflow/active",
    title: "Active workflow",
    description: "JSON do workflow atualmente ativo no canvas.",
  },
  {
    name: "flowmerge://catalog/nodes",
    title: "Node catalog",
    description:
      "Catalogo local de node types, schemas, defaults e campos de configuracao do Flow Merge.",
  },
  {
    name: "flowmerge://canvas/tools",
    title: "Canvas tools",
    description:
      "Lista das ferramentas de desenho e edicao do canvas local, incluindo shapes, texto, pan e eraser.",
  },
  {
    name: "flowmerge://workflow/{workflowId}",
    title: "Workflow by id",
    description: "Template de recurso para ler qualquer workflow local pelo id.",
  },
];

export const MCP_PROMPT_CATALOG: McpCatalogEntry[] = [
  {
    name: "build_local_workflow",
    title: "Build local workflow",
    description:
      "Guia o cliente MCP a ler contexto, escolher node types e aplicar change sets de workspace e workflow no canvas local.",
  },
  {
    name: "analyze_active_workflow",
    title: "Analyze active workflow",
    description:
      "Pede uma leitura do workflow ativo com foco em funil, impacto e proxima acao operacional.",
  },
  {
    name: "integrate_project_signal",
    title: "Integrate project signal",
    description:
      "Ajuda o cliente MCP a conectar sinais do projeto atual ao canvas usando ferramentas deterministicas.",
  },
];
