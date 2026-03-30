# Desktop Release Runbook

Este arquivo e a referencia operacional do sistema de release e auto-update desktop do projeto.

Use este documento para:

- operar releases no GitHub
- promover canais `internal`, `beta` e `stable`
- trocar chaves do updater sem quebrar o fluxo
- orientar futuras IAs sobre a arquitetura atual
- diagnosticar falhas comuns do pipeline

## Resumo Executivo

O projeto usa:

- Tauri 2 para empacotamento desktop
- GitHub Releases para hospedar binarios e manifests de update
- GitHub Actions para compilar, assinar e publicar
- `latest.json` por canal para controlar quem recebe cada versao

O fluxo correto e:

1. criar uma release versionada, por exemplo `v0.1.5`
2. o workflow `release-desktop` compila Windows, macOS e Linux
3. os binarios e os arquivos `.sig` sao anexados na release `v0.1.5`
4. o mesmo workflow atualiza `channel-internal/latest.json`
5. se a validacao interna estiver boa, promover a mesma versao para `beta`
6. depois promover a mesma versao para `stable`

Nao recompilamos para trocar de canal. A promocao de canal troca apenas o `latest.json` do canal.

## Conceitos Importantes

### 1. Release versionada

Exemplo: `v0.1.5`

Ela guarda os artefatos reais:

- instaladores
- pacotes de update
- assinaturas `.sig`

### 2. Release de canal

Exemplos:

- `channel-internal`
- `channel-beta`
- `channel-stable`

Essas releases guardam somente o `latest.json` do canal.

### 3. Promocao de canal

Promover um canal significa:

- escolher uma release versionada ja pronta
- gerar ou reaproveitar o `latest.json`
- fazer o canal apontar para aquela versao

Exemplo:

- publica `v0.1.5`
- `internal` passa a apontar para `v0.1.5`
- depois promove `stable` para `v0.1.5`
- os clientes em `stable` passam a detectar essa versao

## Onde Cada Parte Mora no Codigo

### App desktop e updater

- `src-tauri/src/lib.rs`
  - implementa canais `stable`, `beta` e `internal`
  - monta as URLs de feed do updater
  - checa updates na abertura e a cada 6 horas
  - baixa em background
  - instala no proximo fechamento normal ou via acao manual

- `src-tauri/tauri.conf.json`
  - define `productName`
  - define a `version` do app
  - guarda a chave publica default do updater

- `src-tauri/updater.dev.pubkey`
  - fallback de chave publica embutida no app

### Frontend

- `src/lib/desktop-updater.ts`
  - ponte de chamadas do updater para o frontend

- `src/components/runtime/DesktopUpdateBridge.tsx`
  - integra os eventos de updater com a interface

- `src/components/canvas/FloatingToolbar.tsx`
  - expoe a experiencia visual de update

- `src/store/useFlowStore.ts`
  - guarda o estado relacionado ao updater dentro da app

### Scripts operacionais

- `scripts/tauri-cli.ts`
  - wrapper do comando `tauri`
  - carrega automaticamente a chave local de `.codex-temp/updater.key`
  - tambem carrega a chave publica correspondente para o app

- `scripts/build-updater-manifest.ts`
  - gera o `latest.json`
  - le os assets da release versionada
  - identifica plataforma e arquitetura
  - monta `platforms.{os}-{arch}`

- `scripts/updater-doctor.ts`
  - valida o estado local do setup de update
  - checa chave privada, chave publica, workflows e artefatos
  - mostra a chave publica que deve ir para o GitHub

### GitHub Actions

- `.github/workflows/release-desktop.yml`
  - build multiplataforma
  - validacao de assinatura
  - publicacao da release versionada
  - atualizacao automatica do canal `internal`

- `.github/workflows/promote-channel.yml`
  - promocao manual de `internal`, `beta` ou `stable`
  - nao recompila
  - reaponta o canal para uma tag existente

## Como o App Atualiza

O comportamento implementado hoje e:

- ao abrir o app, ele checa o feed do canal configurado
- o app checa novamente a cada 6 horas
- se houver versao mais nova, ele baixa em background
- quando o download termina, o update fica pronto
- no proximo fechamento normal, o update instala sozinho
- o usuario tambem pode usar a acao `Reiniciar e aplicar`

## Chaves e Seguranca

O app so instala updates cuja assinatura bate com a chave publica embutida nele.

Isso significa:

- a chave privada assina os artefatos
- a chave publica valida os artefatos no cliente

Se a chave publica do app e a chave privada usada na release nao forem do mesmo par, o auto-update quebra.

### Arquivos locais de chave

Nao devem ser commitados:

- `.codex-temp/updater.key`
- `.codex-temp/updater.key.pub`

### Secrets e Variables do GitHub

No repositorio GitHub, ir em:

- `Settings`
- `Secrets and variables`
- `Actions`

Criar estes valores:

#### Repository secrets

- `TAURI_SIGNING_PRIVATE_KEY`
  - conteudo completo de `.codex-temp/updater.key`

- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - senha usada para gerar a chave privada

#### Repository variables

- `FLOW_MERGE_UPDATE_PUBLIC_KEY`
  - conteudo completo de `.codex-temp/updater.key.pub`

### Chave publica atual validada no projeto

No estado atual validado localmente, a chave publica em uso e:

```text
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEM3Q0VGMEVEODA4QzdDNwpSV1RIeHdqWUR1OThEQzR1NEljZzZpa1lhZ2kyR25CUzhYZnBRUk5PZ095QjRTaGVYNXN3VFVTOQo=
```

Essa chave precisa estar coerente em:

- `src-tauri/updater.dev.pubkey`
- `src-tauri/tauri.conf.json`
- `FLOW_MERGE_UPDATE_PUBLIC_KEY` no GitHub

## Como Gerar ou Trocar a Chave

### Gerar uma nova chave

No PowerShell:

```powershell
New-Item -ItemType Directory -Force .codex-temp
bunx tauri signer generate -w .codex-temp/updater.key -p "SUA-SENHA-AQUI" --ci --force
```

Isso gera:

- `.codex-temp/updater.key`
- `.codex-temp/updater.key.pub`

### Quando pode trocar a chave

Trocar a chave e seguro se:

- o app ainda nao foi distribuido
- ou voce aceita fazer uma atualizacao manual unica fora do updater

Trocar a chave nao e seguro se:

- ja existem clientes em producao usando a chave publica antiga
- e voce espera que eles aceitem auto-update com a chave nova

Nesse caso, os clientes antigos vao rejeitar os updates assinados com a nova chave.

### Passos obrigatorios ao trocar a chave

Se trocar a chave, atualizar estes 4 pontos:

1. `src-tauri/updater.dev.pubkey`
2. `src-tauri/tauri.conf.json`
3. `FLOW_MERGE_UPDATE_PUBLIC_KEY` no GitHub
4. `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` no GitHub

Depois validar:

```powershell
bun run updater:doctor
```

## Versionamento Correto

A versao interna do app precisa bater com a tag publicada.

Se a proxima release for `v0.1.6`, atualizar antes:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Hoje o projeto foi alinhado e validado com a versao `0.1.5`.

Se a tag for `v0.1.6`, a versao interna deve ser `0.1.6`.

Nao publique uma tag `vX.Y.Z` enquanto os arquivos ainda estiverem com outra versao. Isso gera artefatos com nomes e manifests inconsistentes.

## Checklist de Release

### Antes da release

1. Confirmar que a chave local existe:

```powershell
Get-ChildItem .codex-temp
```

2. Confirmar que os secrets e variables do GitHub ja foram preenchidos.

3. Atualizar a versao em:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

4. Validar localmente:

```powershell
bun run lint
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD='SUA-SENHA-AQUI'; bun run tauri build
bun run updater:doctor
```

Observacao:

- se a chave privada tiver senha, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` precisa estar definida antes do `bun run tauri build`

### Publicar a release versionada

Depois das validacoes:

```powershell
git add .
git commit -m "Prepare vX.Y.Z release"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

Isso dispara o workflow `release-desktop`.

## O Que Acontece no GitHub

### Workflow `release-desktop`

Arquivo:

- `.github/workflows/release-desktop.yml`

O que ele faz:

1. roda para tags `v*`
2. compila em:
   - `windows-latest`
   - `ubuntu-22.04`
   - `macos-15-intel`
3. valida se:
   - `TAURI_SIGNING_PRIVATE_KEY` existe
   - `FLOW_MERGE_UPDATE_PUBLIC_KEY` existe
   - a chave consegue assinar um arquivo teste
4. roda `tauri-apps/tauri-action@action-v0.6.2`
5. publica a release versionada
6. baixa os artefatos da propria release
7. gera o `latest.json`
8. publica `latest.json` em `channel-internal`

### Workflow `promote-channel`

Arquivo:

- `.github/workflows/promote-channel.yml`

O que ele faz:

1. recebe `channel`
2. recebe `version_tag`
3. baixa os assets da release versionada
4. gera um novo `latest.json`
5. publica o `latest.json` no canal escolhido

## Como Promover `beta` e `stable`

No GitHub:

1. abrir `Actions`
2. abrir `promote-channel`
3. clicar em `Run workflow`
4. preencher:
   - `channel`: `beta` ou `stable`
   - `version_tag`: por exemplo `v0.1.5`
5. executar

### Fluxo recomendado

1. release versionada publica `v0.1.5`
2. `internal` e atualizado automaticamente
3. testar `internal`
4. promover `beta`
5. testar `beta`
6. promover `stable`

## Onde Conferir se Deu Certo no GitHub

Ir em `Releases` e conferir:

- a release `vX.Y.Z` existe
- ela tem os binarios
- ela tem os arquivos `.sig`
- existe `channel-internal` com `latest.json`
- depois da promocao, existe `channel-beta` ou `channel-stable` com `latest.json`

Ir em `Actions` e conferir:

- `release-desktop` verde para a tag publicada
- `promote-channel` verde para o canal promovido

## Como Testar o Canal `internal`

Teste operacional recomendado:

1. instalar a versao atual do app
2. garantir que ela usa o canal `internal`
3. publicar uma nova versao
4. abrir o app
5. verificar se ele detecta update
6. aguardar download em background
7. fechar o app normalmente
8. reabrir e confirmar que a nova versao foi instalada

Tambem testar:

- acao manual `Reiniciar e aplicar`
- comportamento sem update disponivel
- comportamento com chave publica errada, se for um teste controlado

## Troubleshooting

### 1. `Unable to resolve action tauri-apps/tauri-action@v1`

Causa:

- a ref `v1` nao existe nesse action

Correto:

- usar `tauri-apps/tauri-action@action-v0.6.2`

### 2. `macos-13-us-default is not supported`

Causa:

- runner antigo ou label invalido

Correto:

- usar `macos-15-intel`

### 3. `beforeBuildCommand bun run build failed`

Causa comum:

- TypeScript quebrou no projeto durante `next build`

Observacao importante:

- o `next build` faz typecheck do projeto inteiro
- scripts TypeScript fora da UI tambem podem quebrar a pipeline

### 4. `incorrect updater private key password`

Causa:

- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` errado

Correto:

- atualizar o secret com a senha real da chave

### 5. O workflow passa mas o app nao atualiza

Checar:

- `FLOW_MERGE_UPDATE_PUBLIC_KEY` no GitHub
- `src-tauri/updater.dev.pubkey`
- `src-tauri/tauri.conf.json`
- se todos usam a mesma chave publica
- se o canal correto foi promovido
- se a versao interna do app e menor que a versao publicada

### 6. O `updater:doctor` marca versao errada do artefato

O comportamento correto atual do script e:

- procurar o artefato que bate com a versao configurada
- se nao achar, usar o artefato mais recente encontrado

Se esse check falhar, limpar bundles antigos e rebuildar:

```powershell
Remove-Item -Recurse -Force src-tauri/target/release/bundle
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD='SUA-SENHA-AQUI'; bun run tauri build
bun run updater:doctor
```

## Regras Para Futuras IAs

Se uma IA futura precisar operar esse sistema, deve seguir esta ordem:

1. ler este arquivo por completo
2. confirmar a versao atual em:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
3. confirmar a chave publica atual em:
   - `src-tauri/updater.dev.pubkey`
   - `src-tauri/tauri.conf.json`
4. rodar:

```powershell
bun run updater:doctor
```

5. antes de publicar release, validar:

```powershell
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
```

6. se for gerar artefato local assinado:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD='SUA-SENHA-AQUI'; bun run tauri build
```

7. nunca assumir que a chave publica do repo e a mesma da release sem verificar
8. nunca criar tag `vX.Y.Z` com arquivos ainda em outra versao
9. nunca trocar a chave sem avaliar impacto nos clientes ja distribuidos

## Estado Atual Validado

No momento em que este arquivo foi atualizado:

- versao validada: `0.1.5`
- tag publicada: `v0.1.5`
- workflows corretos:
  - `actions/checkout@v5`
  - `tauri-apps/tauri-action@action-v0.6.2`
  - `macos-15-intel`

## Comandos Uteis

### Ver a chave publica atual

```powershell
Get-Content .codex-temp/updater.key.pub
```

### Rodar diagnostico

```powershell
bun run updater:doctor
```

### Build local assinado

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD='SUA-SENHA-AQUI'
bun run tauri build
```

### Publicar uma nova tag

```powershell
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```
