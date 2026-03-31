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
    name: "flow_merge_get_workflow",
    title: "Get workflow",
    description:
      "Retorna o JSON completo do workflow ativo ou de um workflow especifico.",
  },
  {
    name: "flow_merge_set_active_workflow",
    title: "Set active workflow",
    description:
      "Muda o workflow ativo dentro do app local para alinhar o contexto do operador.",
  },
  {
    name: "flow_merge_run_assistant",
    title: "Run native assistant",
    description:
      "Executa a mesma inteligencia do chat nativo do Flow Merge e, opcionalmente, aplica as mudancas no canvas.",
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
      "Guia o cliente a pedir um workflow novo usando o assistente nativo e o contexto atual do workspace.",
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
      "Ajuda a conectar sinais do projeto atual do usuario ao canvas do Flow Merge em modo operador.",
  },
];
