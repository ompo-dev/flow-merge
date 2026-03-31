# Flow Merge

Flow Merge e um command center local-first para founders tecnicos, indie hackers e micro-SaaS. A proposta do produto e juntar automacao e analytics no mesmo canvas: capturar sinais do negocio, transformar isso em workflows e entender impacto real em produto, receita e operacao sem trocar de ferramenta.

O projeto roda em duas superficies:

- web app em Next.js 16 hospedada na Vercel
- desktop shell em Tauri 2 com updater por canal (`stable`, `beta`, `internal`)

## O que o produto faz

- modela workflows visuais com nodes tipados
- executa automacoes localmente no browser ou no desktop
- conecta eventos, logs, metricas e sinais operacionais
- transforma esses sinais em decisoes, alertas e acoes
- expande analytics com runtime local, IA e leitura de impacto no negocio

Exemplos de uso que guiam o produto:

- logs e erros -> impacto em R$
- funil + A/B -> decisao
- padrao comportamental -> insight comercial -> acao

## Arquitetura atual

### Frontend

- `Next.js 16`
- `React 19`
- `Zustand`
- `Framer Motion`
- `@xyflow/react`

### Backend de app

- route handlers em `src/app/api`
- `Better Auth` com login Google
- `Prisma ORM`
- `Supabase Postgres`
- `Axios` para chamadas internas e integracao de billing

### Desktop

- `Tauri 2`
- auto-update por canal via GitHub Releases
- shell desktop apontando para a superficie web publicada

### Billing e licenca

- `AbacatePay` com PIX
- trial de 14 dias
- renovacao mensal via nova cobranca PIX
- cancelamento e inadimplencia tratados no backend de licenca

### Persistencia

O produto nao salva workspace, nodes, runtime data ou metricas no banco.

No backend ficam apenas:

- identidade
- sessao
- licenca
- metadata minima de billing

Workspaces e dados de execucao ficam locais:

- desktop: armazenamento local do app
- web: armazenamento local do browser

## Modelo comercial atual

- `trial_active`
- `payment_pending`
- `active_monthly`
- `active_lifetime`
- `blocked`
- `deleted`

Planos:

- `monthly`
- `lifetime`

Release roles:

- `stable`
- `beta`
- `internal`

Importante:

- `releaseRole` vem do banco e define o teto de acesso
- a UI tambem permite uma role ativa local para simular visualmente tiers abaixo do seu teto real

## Estrutura principal do repositorio

```text
src/                      App web, UI, stores, runtime e APIs
src/app/api/              Auth, billing e status de licenca
src/components/           Shell, canvas, modais e bridges
src/lib/                  Runtime, auth, billing, release access e utilitarios
src/store/                Zustand stores
src-tauri/                Shell desktop, updater e configuracao Tauri
prisma/                   Schema e migrations
scripts/                  Versionamento, updater, Tauri wrapper e scripts operacionais
tests/                    E2E Playwright
docs/                     Runbooks e documentacao operacional
reports/                  Relatorios de auditoria e testes
```

## Requisitos locais

Antes de rodar o projeto, tenha instalado:

- `Bun`
- `Node.js` atual compativel com Next 16
- `Rust` e toolchain do Cargo para Tauri
- dependencias de sistema do Tauri, se for empacotar desktop
- acesso a:
  - Supabase Postgres
  - Google OAuth
  - AbacatePay

## Setup local

1. Instale dependencias:

```powershell
bun install
```

2. Crie seu `.env` a partir do exemplo e preencha os valores reais:

```powershell
Copy-Item .env.example .env
```

3. Gere o client do Prisma:

```powershell
bun run db:generate
```

4. Rode a app web:

```powershell
bun run dev
```

5. Para rodar o shell desktop em desenvolvimento:

```powershell
bun run tauri dev
```

## Variaveis de ambiente

As variaveis principais sao:

- `DATABASE_URL`
- `DIRECT_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_FLOW_MERGE_API_BASE_URL`
- `FLOW_MERGE_TRUSTED_ORIGINS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ABACATEPAY_API_KEY`
- `FLOW_MERGE_DESKTOP_FRONTEND_DIST`

Observacoes:

- em desenvolvimento local, `BETTER_AUTH_URL` e `NEXT_PUBLIC_FLOW_MERGE_API_BASE_URL` normalmente apontam para `http://localhost:3000`
- no desktop release, `FLOW_MERGE_DESKTOP_FRONTEND_DIST` deve apontar para a URL publica da web app

## Banco de dados

O schema Prisma fica em `prisma/schema.prisma`.

Ele cobre:

- usuarios e sessoes do Better Auth
- `releaseRole`
- estado de acesso/licenca
- cobrancas PIX reconciliadas no backend

Gerar client:

```powershell
bun run db:generate
```

Aplicar migration localmente:

```powershell
bunx prisma migrate dev
```

## Scripts uteis

- `bun run dev` -> sobe a app web com `version:sync` e `prisma generate`
- `bun run build` -> build de producao do Next com sync de versao
- `bun run tauri dev` -> shell desktop em modo dev
- `bun run lint` -> lint com Biome
- `bun run test:coverage` -> testes unitarios/integracao com cobertura
- `bun run test:e2e` -> E2E com Playwright
- `bun run audit:deps` -> auditoria de dependencias
- `bun run version:sync` -> sincroniza `package.json`, `Cargo.toml` e `tauri.conf.json`
- `bun run release:prepare X.Y.Z` -> faz sync da versao, cria o commit de bump e valida com build
- `bun run release:publish X.Y.Z` -> faz push do `main`, cria a tag e envia a tag
- `bun run release:verify-tag` -> falha se a tag `vX.Y.Z` nao bater com os arquivos de versao do commit
- `bun run updater:doctor` -> diagnostico do setup de updater desktop

## Testes e qualidade

Estado esperado antes de release:

```powershell
bun run lint
bun run test:coverage
bun run test:e2e
bun run build
bun run audit:deps
```

A malha atual cobre:

- auth
- licenca
- billing
- rate limiting
- roles e release access
- lifecycle de conta bloqueada e wipe local
- E2E dos fluxos principais de conta e sessao

## Release desktop

O processo de release desktop nao deve ser improvisado no terminal. Use o runbook:

- `docs/desktop-release-runbook.md`

Pontos criticos:

- feature branches nao recebem tag de release
- a release nasce em `main`, depois do merge
- a tag sempre vem depois do commit de versao
- `version:sync` precisa refletir a versao alvo antes da tag
- o workflow `release-desktop` agora valida isso com `bun run release:verify-tag`
- `FLOW_MERGE_DESKTOP_FRONTEND_DIST` precisa existir nas repository variables do GitHub

Fluxo recomendado com branches:

```powershell
git checkout main
git pull origin main
git merge --no-ff feat/minha-feature
bun run release:prepare X.Y.Z
bun run release:publish X.Y.Z
```

Se preferir continuar manualmente, o fluxo antigo continua valido. Os scripts acima apenas empacotam a mesma ordem correta com guardas de branch, tag e arvore limpa.

## Seguranca e limites intencionais

- a chave de IA permanece em armazenamento local por decisao de produto
- o backend nao recebe workspace nem runtime data
- billing usa API da AbacatePay com reconciliacao pelo backend
- o runtime dinamico foi endurecido, mas ainda exige cuidado por usar execucao programavel

## Docs relacionadas

- [Desktop release runbook](docs/desktop-release-runbook.md)
- `reports/test-and-security-audit-2026-03-30.md`

## Status atual

No estado atual do repositorio:

- app web + shell desktop coexistem na mesma base
- auth usa Google via Better Auth
- banco usa Supabase Postgres com Prisma
- billing usa AbacatePay PIX
- updater desktop usa canais `stable`, `beta` e `internal`
