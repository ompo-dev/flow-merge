# Product Positioning

## O que e o Flow Merge

Flow Merge e um produto desktop-first que junta tres camadas no mesmo canvas:

- automacao por grafo
- leitura operacional de metricas, tabelas e dashboards
- assistencia de IA com contexto real do workflow

O usuario nao muda de ferramenta para:

- construir a automacao
- rodar e depurar
- interpretar impacto
- ajustar o fluxo

Tudo acontece na mesma superficie.

## Problema que resolvemos

Equipes tecnicas pequenas e medias costumam operar com o stack fragmentado:

- uma ferramenta para automacao
- outra para analytics
- outra para playbooks, notas e entendimento do fluxo

Esse modelo gera perda de contexto. O operador executa em um lugar, analisa em outro e decide no terceiro.

Flow Merge existe para remover essa troca de contexto.

## Promessa central

Construa workflows que se explicam sozinhos.

No Flow Merge, o mesmo canvas que executa o sistema tambem mostra:

- o que entrou
- o que mudou
- o que importa
- o que fazer em seguida

## O que o produto faz hoje

- modela workflows em um canvas visual
- organiza projetos e workflows locais
- executa nodes no runtime local
- recebe webhooks no desktop via servidor embutido
- persiste colecoes analiticas localmente
- gera metricas, charts, tabelas, reports e dashboards no mesmo fluxo
- oferece chat de IA contextual com acesso ao grafo atual
- protege o acesso por conta local na propria maquina
- distribui updates desktop por canais `internal`, `beta` e `stable`

## O que o produto nao tenta ser

Flow Merge nao tenta ser:

- apenas um editor low-code generico
- apenas uma plataforma de product analytics
- um clone de n8n
- um clone de PostHog

A tese e diferente: um operator surface que combina automacao, interpretacao e ajuste dentro do mesmo plano.

## Publico-alvo

### Primario

- founders tecnicos
- operadores de micro-SaaS
- equipes de growth com perfil tecnico
- product engineers que misturam integracoes, eventos e dashboards
- squads que precisam de um command center local para operar fluxos

### Secundario

- agencias que operam stacks de clientes
- equipes internas de revenue ops
- times de suporte tecnico e monitoramento
- pequenos produtos B2B que ainda nao querem um stack inteiro separado

## Jobs to be done

### 1. Operar um fluxo de ponta a ponta

"Quero ver o gatilho, o processamento e o impacto no mesmo lugar."

### 2. Transformar um workflow em painel operacional

"Quero que o proprio grafo mostre o KPI e o insight, sem mandar a equipe para outro produto."

### 3. Ajustar com IA sem perder contexto

"Quero pedir uma mudanca para a IA usando o proprio workflow atual como contexto."

### 4. Proteger e distribuir localmente

"Quero que o command center rode no desktop, com acesso local e updates controlados por canal."

## Posicao entre n8n e PostHog

## O que n8n representa no mercado

n8n se apresenta como plataforma de automacao e AI workflows para equipes tecnicas, com construcao visual, possibilidade de ir fundo em codigo, grande numero de integracoes e opcao de self-host. A proposta central e automacao flexivel e rastreavel no canvas.

## O que PostHog representa no mercado

PostHog se apresenta como um conjunto de dev tools para product engineers, reunindo analytics, session replay, feature flags, experiments, logs, CDP, workflows e Product OS para trabalhar a partir de uma base unica de dados do produto.

## Onde o Flow Merge entra

Flow Merge entra exatamente entre esses dois mundos:

- pega de n8n a modelagem operacional por nodes e fluxos
- pega de PostHog a leitura de negocio, comparacao e interpretacao
- adiciona uma tese propria: o operador trabalha e entende o sistema na mesma superficie

## Formula de mercado

Flow Merge = automation graph + analytics reading surface + contextual AI + desktop command center

## Diferenca estrategica

### vs n8n

n8n e forte em automacao e integracoes. O diferencial do Flow Merge nao e competir em quantidade de conectores, e sim aproximar a leitura operacional do proprio grafo.

Resumo:

- n8n otimiza execucao de automacoes
- Flow Merge otimiza execucao + interpretacao + ajuste

### vs PostHog

PostHog e forte em product analytics e suite de ferramentas para product engineers. O diferencial do Flow Merge nao e competir em profundidade de analytics enterprise, e sim tornar analytics parte do workflow operacional.

Resumo:

- PostHog otimiza entendimento do produto por uma suite de analytics
- Flow Merge otimiza entendimento do fluxo operacional dentro do proprio canvas

## Pitchs

### One-liner

Flow Merge e o command center onde automacao, analytics e IA operam no mesmo canvas.

### Three-liner

Flow Merge ajuda equipes tecnicas a desenhar workflows, rodar integracoes e ler impacto no mesmo lugar. Em vez de separar automacao, analytics e interpretacao em ferramentas diferentes, ele transforma o canvas no proprio plano operacional. O resultado e menos troca de contexto e mais clareza para decidir.

### Founder pitch

Estamos construindo um produto para a camada que fica entre ferramentas de automacao e ferramentas de analytics. Hoje as equipes executam num sistema, analisam em outro e ajustam num terceiro. O Flow Merge condensa isso num canvas desktop-first que executa, mostra impacto e aceita ajustes com IA sem tirar o operador do contexto.

### Product pitch

Flow Merge e uma superficie unica para equipes que precisam operar workflows e entender negocio ao mesmo tempo. Nodes de trigger, action, analytics, monitoramento e visualizacao convivem no mesmo grafo. Isso transforma o workflow em sistema operacional de decisao, nao apenas em automacao.

### Sales pitch

Se sua equipe hoje alterna entre automacao, dashboards e documentos para descobrir o que aconteceu e o que precisa mudar, o Flow Merge reduz esse custo de contexto. Ele coloca execucao, metricas, reports e IA no mesmo canvas.

## Casos de uso naturais

- command center de receita
- monitoramento de funis e experimentos
- operacao de webhooks de produto
- dashboards conectados a regras e alertas
- automacoes com leitura operacional embutida
- observabilidade de fluxos internos de SaaS

## Criterios para uma boa decisao de produto

Uma funcionalidade nova deve reforcar pelo menos um destes principios:

- reduzir troca de contexto
- deixar o grafo mais autoexplicativo
- aproximar execucao de interpretacao
- aumentar a capacidade do operador decidir no proprio canvas
- fortalecer o modelo desktop-first e local-first
