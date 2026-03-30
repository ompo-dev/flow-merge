import { nodeCatalogMap, type NodeTypeId } from "@/lib/node-catalog";

export type NodeDocumentation = {
  overview: string;
  whenToUse: string[];
  avoidWhen: string[];
  receives: string;
  emits: string;
  topology: string[];
  examples: string[];
  tips: string[];
  programming: string;
};

function buildDoc(nodeType: NodeTypeId, overrides: Partial<NodeDocumentation>): NodeDocumentation {
  const meta = nodeCatalogMap[nodeType];

  return {
    overview: meta.description,
    whenToUse: [],
    avoidWhen: [],
    receives: "Recebe o output semantico do upstream.",
    emits: "Emite um contrato que o proximo node consome.",
    topology: [],
    examples: [],
    tips: [],
    programming:
      "No modo avancado voce pode ler input.first, transformar o payload e devolver somente o que o proximo node precisa.",
    ...overrides,
  };
}

function buildTriggerDoc(
  nodeType: Extract<NodeTypeId, "trigger_webhook" | "trigger_schedule" | "trigger_manual">,
  overrides: Partial<NodeDocumentation>,
) {
  return buildDoc(nodeType, {
    receives: "Nao depende de node anterior. Inicia o fluxo com um payload proprio.",
    emits: "Emite o primeiro evento do workflow. Esse contrato define a lingua dos nodes seguintes.",
    topology: [
      "Trigger -> normalizacao/enrich -> analytics/store -> viz/alert",
      "Trigger -> switch/if -> ramos especificos",
    ],
    programming:
      "Use testPayload para simular eventos reais. Se o payload bruto vier desorganizado, normalize logo na saida do trigger.",
    ...overrides,
  });
}

function buildActionDoc(nodeType: NodeTypeId, overrides: Partial<NodeDocumentation>) {
  return buildDoc(nodeType, {
    receives: "Recebe o payload atual do fluxo e pode usar qualquer campo semantico disponivel.",
    emits: "Emite o payload transformado, filtrado, roteado ou integrado.",
    topology: [
      "Trigger -> action -> analytics/viz/integrations",
      "Analytics -> action -> monitor/notify",
    ],
    programming:
      "Actions sao os melhores pontos para limpar, resumir, enriquecer e adaptar contratos antes do proximo passo.",
    ...overrides,
  });
}

function buildAnalyticsDoc(nodeType: NodeTypeId, overrides: Partial<NodeDocumentation>) {
  return buildDoc(nodeType, {
    receives: "Recebe eventos ou colecoes ja normalizadas e semanticamente legiveis.",
    emits: "Emite artefatos analiticos prontos para monitoramento, visualizacao ou decisao.",
    topology: [
      "Trigger/action -> analytics -> viz/monitor",
      "Stores especificos -> analytics compartilhado",
    ],
    programming:
      "Analytics funciona melhor quando campos de negocio chegam consistentes. Se o dado estiver cru, normalize antes.",
    ...overrides,
  });
}

function buildMonitorDoc(nodeType: NodeTypeId, overrides: Partial<NodeDocumentation>) {
  return buildDoc(nodeType, {
    receives: "Recebe um KPI, aggregate ou artifact semantico ja pronto para ser validado.",
    emits: "Emite status do monitor, threshold e contexto do alerta.",
    topology: [
      "Analytics -> monitor -> slack/email/respond",
    ],
    programming:
      "Monitores devem receber um sinal claro. Se a regra depender de varios calculos, prepare esse numero antes.",
    ...overrides,
  });
}

function buildVizDoc(nodeType: NodeTypeId, overrides: Partial<NodeDocumentation>) {
  return buildDoc(nodeType, {
    receives: "Recebe um artifact semantico pronto para ser exibido.",
    emits: "Emite o preview renderizado e um output coerente com a visualizacao.",
    topology: [
      "Analytics -> viz",
      "Compare/AB/Funnel -> viz",
    ],
    programming:
      "Visualizacoes nao deveriam inventar dados. Passe o recorte certo para a pergunta que o usuario quer responder.",
    ...overrides,
  });
}

export function getNodeDocumentation(nodeType: NodeTypeId): NodeDocumentation {
  switch (nodeType) {
    case "trigger_webhook":
      return buildTriggerDoc(nodeType, {
        overview:
          "Recebe eventos via HTTP. E o trigger ideal para webhooks, eventos de frontend, backend, billing, logs e qualquer sistema externo.",
        whenToUse: [
          "Eventos de produto, checkout, logs, erros, signup e pagamentos.",
          "Fluxos em tempo real disparados por outro sistema.",
        ],
        avoidWhen: [
          "Rotinas periodicas. Use trigger_schedule.",
        ],
        examples: [
          "Webhook de checkout com amount, converted e productId.",
          "Webhook de logs com level, service e message.",
        ],
        tips: [
          "Defina Path, Tag Field e testPayload coerentes com o dominio real do fluxo.",
        ],
      });
    case "trigger_schedule":
      return buildTriggerDoc(nodeType, {
        overview:
          "Dispara o fluxo por tempo. Use para resumo diario, snapshots, reconciliacao, auditoria e tarefas recorrentes.",
        whenToUse: ["Resumo diario, semanal ou horario.", "Atualizacao periodica de dashboards e relatorios."],
        avoidWhen: ["Eventos em tempo real vindos de outro sistema."],
        examples: ["Resumo semanal de receita.", "Scanner de erros a cada 15 minutos."],
        tips: ["Se o fluxo depende de janela temporal, injete from/to logo no payload inicial."],
      });
    case "trigger_manual":
      return buildTriggerDoc(nodeType, {
        overview:
          "Inicia o fluxo por acao humana. E util para operacao interna, testes, reprocessamento e playbooks.",
        whenToUse: ["Rodar uma rotina ad hoc.", "Reprocessar um caso especifico."],
        avoidWhen: ["Origens automaticas ou externas."],
        examples: ["Disparar analise manual de churn.", "Testar uma rotina de cobranca."],
        tips: ["Mantenha um payload de teste salvo quando o time usar este node com frequencia."],
      });
    case "action_if":
      return buildActionDoc(nodeType, {
        overview:
          "Abre duas rotas com base em uma condicao booleana. Ideal para gates simples e alertas binarios.",
        whenToUse: ["winner vs insufficient_sample", "threshold batido vs nao batido"],
        avoidWhen: ["Mais de duas rotas. Use action_switch."],
        examples: ["Se totalErrors > 100, alertar.", "Se winner existir, notificar time."],
        tips: ["A condicao precisa ser legivel no painel rapido; se ficou opaca, normalize antes."],
      });
    case "action_switch":
      return buildActionDoc(nodeType, {
        overview:
          "Roteia para varias saidas conforme um campo. E o node certo para variantes, canais, filas, servicos e planos.",
        whenToUse: ["Separar variant_a, variant_b.", "Roteamento por service, queue ou region."],
        avoidWhen: ["Apenas duas saidas.", "Quando os ramos fazem exatamente a mesma coisa."],
        examples: ["variant -> Store A / Store B", "service -> monitor por microservico"],
        tips: ["Cases vazios nao devem seguir semanticos. Se um caso sumir, downstream precisa se adaptar."],
      });
    case "analytics_store":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Persistencia semantica do fluxo. Guarda eventos em uma colecao nomeada para uso posterior em compare, AB, aggregate, funnel e visualizacoes.",
        whenToUse: [
          "Stores por variante, canal, servico, fila, plano ou campanha.",
          "Quando outros nodes precisam falar sobre a mesma fonte de dados depois.",
        ],
        avoidWhen: [
          "Quando o fluxo so transforma e segue sem qualquer persistencia.",
        ],
        emits:
          "Emite o mesmo payload para frente e registra a identidade da colecao via Store Name.",
        examples: ["ab_variant_a", "frontend_logs", "checkout_events", "invoices_overdue"],
        tips: [
          "Store Name e semantica de dados, nao so rotulo visual.",
          "Se o store e exclusivo de um ramo desativado, ele deve ficar bloqueado e visivel no canvas.",
        ],
      });
    case "analytics_aggregate":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Agrupa e resume eventos em linhas agregadas. E a ponte entre evento bruto e KPI, grafico ou tabela.",
        whenToUse: ["Receita por dia", "Erros por servico", "Pedidos por produto"],
        avoidWhen: ["Comparacao entre fontes distintas. Use analytics_compare."],
        examples: ["Somar revenue diaria.", "Contar tickets por categoria."],
        tips: ["Escolha o group by de acordo com a visualizacao que vem depois."],
      });
    case "analytics_compare":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Compara fontes ativas. Ideal para frontend vs backend, gateway A vs gateway B, canal organico vs pago e outras comparacoes operacionais.",
        whenToUse: ["Duas fontes operacionais ativas.", "Comparacao entre servicos, canais ou filas."],
        avoidWhen: ["Apenas uma fonte viva restante.", "Experimento estatistico. Use analytics_ab."],
        examples: ["Frontend logs vs backend logs", "Stripe vs PayPal"],
        tips: ["Os labels de entrada devem representar fontes reais, nao sobras de um fluxo antigo."],
      });
    case "analytics_ab":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Analisa experimento A/B ou multivariante. Calcula winner, taxa de conversao, receita e amostra.",
        whenToUse: ["Landing pages, checkout, onboarding, pricing e experimentos controlados."],
        avoidWhen: ["Fluxos sem pelo menos duas variantes ativas.", "Comparacoes operacionais sem semantica de experimento."],
        examples: ["Variant A vs Variant B no checkout."],
        tips: ["Se uma variante some, o analyzer deve se adaptar ao conjunto vivo restante."],
      });
    case "analytics_funnel":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Organiza eventos em etapas sequenciais para medir conversao e queda entre passos.",
        whenToUse: ["visit -> signup -> trial -> payment", "lead -> demo -> proposal -> closed_won"],
        avoidWhen: ["Eventos que nao representam uma jornada ordenada."],
        examples: ["Funil de ativacao SaaS."],
        tips: ["As etapas precisam refletir a jornada real do usuario, nao nomes tecnicos do backend."],
      });
    case "analytics_segment":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Separa a base por grupos de negocio como plano, geografia, campanha, canal ou cohort.",
        whenToUse: ["Receita por plano.", "Ativacao por cohort."],
        avoidWhen: ["Quando a divisao precisa abrir ramos fisicos no canvas. Use switch."],
        examples: ["SMB vs Enterprise", "Organic vs Paid"],
        tips: ["Segmentos bons ajudam decisao. Segmentos cosméticos so aumentam ruído."],
      });
    case "analytics_enrich":
      return buildAnalyticsDoc(nodeType, {
        overview:
          "Acrescenta contexto analitico a um evento: plano, campanha, owner, geo, cohort, score e afins.",
        whenToUse: ["Completar eventos antes de guardar ou agregar."],
        avoidWhen: ["Quando o payload ja esta limpo e completo."],
        examples: ["Anexar plan e companySize antes de calcular MRR."],
        tips: ["Enriqueca cedo quando varios nodes seguintes dependem do mesmo contexto."],
      });
    case "monitor_error":
      return buildMonitorDoc(nodeType, {
        overview:
          "Monitora sinais de erro por nivel, padrao ou volume. Bom para observabilidade e saude operacional.",
        whenToUse: ["ERROR/FATAL", "Picos de exception por servico"],
        avoidWhen: ["Quando o sinal principal nao e erro."],
        examples: ["Alertar quando checkout passar de 50 erros em 5 minutos."],
        tips: ["Padronize level, service e message antes do monitor."],
      });
    case "monitor_alert":
      return buildMonitorDoc(nodeType, {
        overview:
          "Valida threshold ou regra final e dispara alerta. Serve para revenue, conversao, erro, churn e qualquer KPI.",
        whenToUse: ["signupRate < 0.15", "revenue > meta", "errorCount > limite"],
        avoidWhen: ["Quando o dado ainda precisa de agregacao ou interpretacao."],
        examples: ["Alertar se MRR diaria cair 20%."],
        tips: ["O Field observado precisa existir de verdade no payload recebido."],
      });
    case "monitor_revenue":
      return buildMonitorDoc(nodeType, {
        overview:
          "Especializado em sinais financeiros como receita, MRR, churn financeiro ou cashflow.",
        whenToUse: ["Queda de revenue", "MRR abaixo da meta"],
        avoidWhen: ["Quando o sinal nao e financeiro."],
        examples: ["Alertar se revenue do dia ficar abaixo da media da semana."],
        tips: ["Normalize moeda e unidade antes de monitorar."],
      });
    case "viz_metric":
      return buildVizDoc(nodeType, {
        overview:
          "Exibe um KPI unico e direto no canvas. Ideal para winner, total, taxa e delta principal.",
        whenToUse: ["MRR", "Conversao", "Winner", "Erro total"],
        avoidWhen: ["Quando a pergunta pede distribuicao ou serie temporal."],
        examples: ["Winning Variant", "Overall Conversion", "Total Revenue"],
        tips: ["Escolha um numero que responda a principal pergunta do usuario."],
      });
    case "viz_chart":
      return buildVizDoc(nodeType, {
        overview:
          "Mostra comparacoes e tendencias em linha, barra ou area. E o visual mais util para agregacoes e comparativos.",
        whenToUse: ["Receita por dia", "Erros por servico", "Comparacao por variante"],
        avoidWhen: ["Quando a saida e um unico KPI ou uma lista tabular detalhada."],
        examples: ["Daily Revenue", "Comparacao de erros frontend vs backend"],
        tips: ["Chart type, eixo X e eixo Y precisam contar a mesma historia dos dados."],
      });
    case "viz_table":
      return buildVizDoc(nodeType, {
        overview:
          "Exibe listas operacionais em linhas e colunas. Serve para top produtos, contas em risco, invoices e rankings.",
        whenToUse: ["Top products", "Invoices overdue", "Top services by errors"],
        avoidWhen: ["Quando o usuario so precisa de um KPI ou de um funil."],
        examples: ["Nome, contagem, valor, variacao"],
        tips: ["Defina colunas pensando na decisao que a pessoa vai tomar olhando a tabela."],
      });
    case "viz_report":
      return buildVizDoc(nodeType, {
        overview:
          "Agrupa narrativa, highlights e lista resumida. E bom para weekly reports, analise executiva e fechamento de campanha.",
        whenToUse: ["Resumo semanal de KPI", "Relatorio do vencedor", "Resumo de incidentes"],
        avoidWhen: ["Quando a pessoa precisa explorar linha a linha."],
        examples: ["Funnel Weekly Report", "Variant Winner Report"],
        tips: ["Report serve para orientar acao; nao tente transformá-lo em tabela gigante."],
      });
    case "viz_funnel":
      return buildVizDoc(nodeType, {
        overview:
          "Visualiza queda entre etapas ordenadas. E a representacao certa para onboarding, venda e ativacao.",
        whenToUse: ["visit -> signup -> payment"],
        avoidWhen: ["Categorias sem ordem temporal ou logica."],
        examples: ["Funil de conversao SaaS"],
        tips: ["Use labels de etapa que qualquer area entenda."],
      });
    case "viz_dashboard":
      return buildVizDoc(nodeType, {
        overview:
          "Agrupa varias visoes em um painel unico. Bom para superficie executiva e leitura rapida do fluxo.",
        whenToUse: ["Visao unica de revenue, conversao, alertas e operacao"],
        avoidWhen: ["Quando um unico chart ou metric ja responde a pergunta."],
        examples: ["Dashboard operacional de growth"],
        tips: ["Monte dashboard por ultimo, depois que os outros visuais estiverem certos."],
      });
    default: {
      const meta = nodeCatalogMap[nodeType];
      const shell = meta.shellType;

      if (shell === "actionNode") {
        return buildActionDoc(nodeType, {
          overview: `${meta.description} Use este node quando a etapa precisa agir sobre o payload, integra-lo com outro sistema ou adaptar o contrato antes do proximo passo.`,
          whenToUse: [
            "Quando o fluxo precisa transformar, integrar, filtrar ou preparar dados.",
            "Quando o proximo node precisa de um contrato mais enxuto e legivel.",
          ],
          avoidWhen: [
            "Quando um analytics ou viz node especializado descreve melhor a intencao do passo.",
          ],
          examples: [
            `${meta.label} depois de um trigger para preparar o payload.`,
            `${meta.label} antes de um monitor, report ou notificacao.`,
          ],
          tips: [
            "Se este node ficou complexo demais, provavelmente faltou separar melhor a etapa anterior.",
          ],
        });
      }

      if (shell === "vizNode" || shell === "dashboardNode") {
        return buildVizDoc(nodeType, {
          overview: `${meta.description} Use este node para expor uma resposta visual clara a partir do artifact que chega do fluxo.`,
          whenToUse: [
            "Quando a pergunta final do usuario precisa aparecer no canvas de forma visual.",
          ],
          avoidWhen: [
            "Quando ainda faltam agregacao, comparacao ou interpretacao antes da exibicao.",
          ],
          examples: [
            `${meta.label} alimentado por aggregate, compare, funnel ou openai.`,
          ],
          tips: [
            "A visualizacao ideal nasce do artifact certo; ajuste o upstream antes de culpar o node visual.",
          ],
        });
      }

      return buildDoc(nodeType, {
        overview: meta.description,
        whenToUse: ["Quando este node representa melhor a intencao do passo do que um bloco generico."],
        avoidWhen: ["Quando outro node especializado deixa a topologia mais clara."],
        examples: [meta.label],
        tips: ["Olhe a topologia sugerida na documentacao para manter o fluxo legivel."],
      });
    }
  }
}
