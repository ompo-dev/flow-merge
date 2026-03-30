# Desktop Updates

## O que foi implementado

- updater nativo do Tauri 2 com canais `stable`, `beta` e `internal`
- checagem automatica no app em background
- download silencioso e instalacao automatica no fechamento do app quando houver update pronto
- acao explicita de `reiniciar e aplicar` para quem quiser atualizar imediatamente
- manifests `latest.json` por canal hospedados em GitHub Releases
- pipeline de release por tag e pipeline de promocao entre canais

## Variaveis de build importantes

- `FLOW_MERGE_UPDATE_REPOSITORY`
  - formato: `owner/repo`
  - usado para montar os feeds `channel-stable`, `channel-beta` e `channel-internal`
- `FLOW_MERGE_UPDATE_PUBLIC_KEY`
  - chave publica do updater usada pelo app para validar o pacote baixado
  - se nao for definida, o build usa a chave publica de desenvolvimento do repo

## Build local

- `bun run tauri build` agora passa por um wrapper do projeto
- se `TAURI_SIGNING_PRIVATE_KEY` nao estiver definida, ele tenta carregar automaticamente:
  - `TAURI_SIGNING_PRIVATE_KEY_PATH`
  - `.codex-temp/updater.key`
- se encontrar a chave privada local, tambem carrega automaticamente a chave publica correspondente para o app
- se nao encontrar nenhuma chave, o comando falha cedo com uma mensagem explicita

## Secrets esperados no GitHub

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `FLOW_MERGE_UPDATE_PUBLIC_KEY` pode ficar em `Repository Variables` porque nao e secreto

## Fluxo operacional

1. Criar uma tag `vX.Y.Z`.
2. O workflow `release-desktop` compila Windows, macOS e Linux.
3. Os artefatos assinados e `.sig` sao anexados na release `vX.Y.Z`.
4. O mesmo workflow atualiza automaticamente `channel-internal/latest.json`.
5. Quando quiser promover, rode `promote-channel` informando `stable`, `beta` ou `internal` e a tag versionada.

## Formato do manifest

O arquivo `latest.json` gerado pelo script `scripts/build-updater-manifest.ts` segue o formato estatico esperado pelo updater do Tauri, com:

- `version`
- `notes`
- `pub_date`
- `platforms.{os}-{arch}`

O gerador reconhece automaticamente os artefatos de updater encontrados na release versionada e monta chaves como:

- `windows-x86_64`
- `windows-aarch64`
- `darwin-x86_64`
- `darwin-aarch64`
- `linux-x86_64`
- `linux-aarch64`

Isso deixa o feed pronto para qualquer combinacao de plataforma/arquitetura que tenha sido publicada na release original.

## Limites do v1

- este setup garante integridade do pacote atualizado
- ele nao garante reputacao de SmartScreen ou Gatekeeper
- para reduzir alertas de SO no futuro, sera necessario adicionar:
  - macOS `Developer ID + notarization`
  - Windows assinatura publica da Microsoft ou equivalente

## Comportamento de instalacao

- o app checa updates na abertura e a cada 6h
- quando `auto-update` estiver ligado, ele baixa a nova versao em background
- quando o pacote ja estiver pronto, o app:
  - mostra um aviso discreto na interface
  - instala automaticamente no proximo fechamento normal do app
  - tambem permite o atalho manual `Reiniciar e aplicar`
