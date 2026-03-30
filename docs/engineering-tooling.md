# Engineering Tooling

## Objetivo

Este documento resume como o repositrio e construido, validado e operado no dia a dia.

## Frontend build

- `next build`
- Tailwind CSS 4
- TypeScript
- Biome para lint e check

## Desktop build

- Tauri 2
- wrapper local em `scripts/tauri-cli.ts`
- assinatura de update durante o build

## Scripts

### Desenvolvimento

```powershell
bun run dev
```

### Validacao

```powershell
bun run lint
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### Build desktop

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD='SUA-SENHA'
bun run tauri build
```

### Diagnostico de updater

```powershell
bun run updater:doctor
```

## GitHub Actions

### `release-desktop`

- roda em tags `v*`
- compila multiplataforma
- publica release versionada
- atualiza `channel-internal`

### `promote-channel`

- recebe `channel`
- recebe `version_tag`
- reaponta `beta` ou `stable` sem recompilar

## Tooling decisions

### Por que Next.js

- shell web rapido
- App Router
- bom encaixe com client components para o canvas

### Por que Zustand

- store unica e direta
- baixo atrito para editor, runtime e bridges

### Por que React Flow

- canvas tecnico
- nodes customizados
- edges e selecao ja resolvidos

### Por que Tauri

- shell desktop leve
- runtime Rust embutido
- updater nativo
- boa integracao com web app local

## Regras operacionais importantes

- manter a versao alinhada entre `package.json`, `Cargo.toml` e `tauri.conf.json`
- validar o updater antes de taggear release
- tratar `main` como branch de release enquanto nao houver outro fluxo
- nao trocar a chave publica sem avaliar impacto nos clientes
