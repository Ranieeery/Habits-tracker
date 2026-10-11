# Habits

Rastreador de hábitos com heatmap no estilo das contribuições do GitHub. Versão 2.0.0, uma reescrita completa do app antigo, que fica em `legacy/` só como referência.

- **Mobile (principal):** Expo + Expo Router, Android, offline-first (SQLite no aparelho e sync com o servidor).
- **Web:** PWA em Vite + React, online, com Web Push.
- **API:** Hono em Cloudflare Workers, banco D1 (SQLite) via Drizzle, autenticação com Better Auth, lembretes por cron.

Produção: <https://habits.rxniery.workers.dev> (o web; a API fica em `/api`).

As regras de arquitetura, o modelo de dados, as decisões e os comandos de desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md) e nos `CLAUDE.md` de cada app (em inglês). Este README cobre a operação.

## Sumário

- [Estrutura](#estrutura)
- [Desenvolvimento](#desenvolvimento)
- [Topologia de produção](#topologia-de-produção)
- [Segredos e variáveis](#segredos-e-variáveis)
- [Runbook](#runbook)
  - [Pré-requisitos](#pré-requisitos)
  - [Higiene antes do primeiro push](#higiene-antes-do-primeiro-push)
  - [Primeiro deploy](#primeiro-deploy)
  - [CI/CD no GitHub](#cicd-no-github)
  - [Deploy do dia a dia](#deploy-do-dia-a-dia)
  - [Mobile: builds e updates (EAS)](#mobile-builds-e-updates-eas)
  - [Rollback](#rollback)
  - [Backup e restauração do D1](#backup-e-restauração-do-d1)
  - [Rotação de segredos](#rotação-de-segredos)
  - [Mudança destrutiva em duas etapas](#mudança-destrutiva-em-duas-etapas)
  - [Observabilidade](#observabilidade)
  - [Medir o tempo de login (CPU)](#medir-o-tempo-de-login-cpu)
  - [Alertas](#alertas)
  - [Checklist pós-deploy](#checklist-pós-deploy)
  - [Problemas comuns](#problemas-comuns)
  - [Atualizações de dependências](#atualizações-de-dependências)
- [Limites dos planos gratuitos](#limites-dos-planos-gratuitos)

## Estrutura

Monorepo pnpm + Turborepo.

| Pasta                    | O que é                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `apps/api`               | API (Worker privado `habits-api`), D1, cron de lembretes e expurgo.    |
| `apps/web`               | PWA (Worker público `habits`: assets + gateway `/api`).                |
| `apps/mobile`            | App Expo (Android).                                                    |
| `packages/contracts`     | Schemas Zod de todas as requisições, respostas e do protocolo de sync. |
| `packages/core`          | Lógica de domínio pura (datas, agenda, heatmap, regras de sync).       |
| `packages/api-client`    | Cliente tipado da API, usado pelo web e pelo mobile.                   |
| `packages/design-tokens` | Cores e espaçamentos (Tailwind no web, NativeWind no mobile).          |
| `legacy/`                | App antigo (1.x), somente leitura.                                     |
| `.github/`               | Workflows de CI/CD e Dependabot.                                       |

## Desenvolvimento

Requisitos: Node 24 (`.node-version`), pnpm 12 (fixado em `packageManager`).

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # preencha BETTER_AUTH_SECRET
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter api db:migrate:local
pnpm --filter api db:seed:local                    # usuário dev@habits.local / habits-dev-password
pnpm dev                                           # API em :8787 e web em :5173
pnpm typecheck && pnpm lint && pnpm test           # o mesmo que o CI roda
```

A lista completa de comandos está em `CLAUDE.md` (seção "Commands").

## Topologia de produção

Dois Workers no mesmo domínio `*.workers.dev`:

- **`habits` (público):** serve o `dist/` do web como Workers Static Assets, com fallback de SPA. Só `/api` e `/api/*` executam código (`run_worker_first`): o gateway tira o prefixo `/api` e repassa a requisição (cookies, origem, IP) ao `habits-api` pelo service binding.
- **`habits-api` (privado):** sem URL pública (`workers_dev: false`). D1 `habits` e Cron Trigger `*/15 * * * *`.

Por que assim:

- web e API ficam na mesma origem, então o cookie de sessão é same-origin, sem CORS;
- o prefixo `/api` é o mesmo do proxy de desenvolvimento do Vite;
- a API não tem URL própria exposta;
- os testes e o `wrangler dev` da API não dependem do build do web.

Ordem de deploy: **migrations do D1, depois a API, depois o web** (o binding precisa que a API exista, e o web novo pode chamar rotas novas).

**Se você trocar para um domínio próprio:**

- `BETTER_AUTH_URL` passa a ser a nova origem;
- `TRUSTED_ORIGINS` continua vazio (mesma origem);
- os cookies antigos não valem no domínio novo, então todos fazem login de novo;
- subscriptions Web Push são por origem: cada navegador precisa ativar os lembretes de novo e o PWA precisa ser reinstalado;
- `VAPID_SUBJECT` muda para a URL nova;
- `EXPO_PUBLIC_API_URL` (EAS) muda, e um OTA basta;
- `PRODUCTION_URL` muda em `.github/workflows/deploy.yml` e `backup.yml`.

A CSP não muda, porque é toda `'self'`.

## Segredos e variáveis

Nenhum valor fica neste repositório. A tabela lista só nomes.

| Nome                                             | Onde vive                                                                      | Quem define                               | Para quê                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                             | Wrangler secret (`habits-api`) / `.dev.vars`                                   | você                                      | Assina sessões e cookies.                                      |
| `BETTER_AUTH_URL`                                | Wrangler secret / `.dev.vars`                                                  | você                                      | Origem pública (`https://habits.rxniery.workers.dev`).         |
| `OWNER_EMAIL`                                    | Wrangler secret / `.dev.vars`                                                  | você                                      | Único e-mail que pode criar a primeira conta.                  |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`          | Wrangler secret / `.dev.vars`                                                  | você (`pnpm --filter api vapid:generate`) | Web Push. A pública também vai em `VITE_VAPID_PUBLIC_KEY`.     |
| `VAPID_SUBJECT`                                  | Wrangler secret / `.dev.vars`                                                  | você                                      | Contato do remetente (URL do app).                             |
| `EXPO_ACCESS_TOKEN`                              | Wrangler secret (opcional)                                                     | você                                      | Só se o "enhanced security" do Expo Push estiver ligado.       |
| `ENVIRONMENT`, `ALLOW_SIGNUP`, `TRUSTED_ORIGINS` | `apps/api/wrangler.jsonc` (versionado)                                         | repositório                               | `production`, `false`, vazio. Em dev, `.dev.vars` sobrescreve. |
| `VITE_API_URL`, `VITE_VAPID_PUBLIC_KEY`          | `apps/web/.env.production` (versionado, público)                               | repositório                               | Base da API (`/api`) e chave pública VAPID.                    |
| `CLOUDFLARE_API_TOKEN`                           | GitHub, Environment `production`                                               | você                                      | Token de deploy (permissões abaixo).                           |
| `CLOUDFLARE_API_TOKEN`                           | GitHub, Environment `backup`                                                   | você                                      | Token só de backup (permissões abaixo).                        |
| `CLOUDFLARE_ACCOUNT_ID`                          | GitHub, Environments `production` e `backup`                                   | você                                      | ID da conta Cloudflare (não é segredo, mas fica junto).        |
| `EXPO_TOKEN`                                     | GitHub, Environment `production`                                               | você                                      | Publicar EAS Update no CI.                                     |
| `EXPO_PUBLIC_API_URL`                            | Variável EAS (`production`, `preview`), texto puro / `apps/mobile/.env` em dev | você                                      | URL da API no app. É pública: fica embutida no app.            |
| Keystore Android                                 | EAS (credenciais)                                                              | EAS gera; você guarda uma cópia           | Assina o APK.                                                  |
| Chave da conta de serviço FCM V1                 | EAS (credenciais)                                                              | você (Firebase)                           | Push no Android via Expo.                                      |
| `google-services.json`                           | `apps/mobile/` (versionado, público)                                           | você (Firebase)                           | Identificadores do Firebase no app.                            |

## Runbook

**Regra:** comandos `--remote`, `wrangler deploy`, `wrangler secret`, `eas build` e `eas update` afetam produção. Rode-os você, na ordem descrita aqui. Todos os comandos `wrangler` partem da raiz do repo com `pnpm --filter api exec wrangler …` (ou `--filter web`), para usar a versão do lockfile.

### Pré-requisitos

- **Contas:** Cloudflare (Workers Free), GitHub, Expo (EAS Free) e Firebase (FCM). Login local com `pnpm --filter api exec wrangler login` e `pnpm dlx eas-cli@latest login`.
- **R2:** ative o R2 no painel da Cloudflare. O painel pede um meio de pagamento cadastrado mesmo no plano grátis; o uso deste projeto (KB por backup) fica dentro do gratuito.
- **Token de deploy** (painel → My Profile → API Tokens → Create Token → Custom), restrito à sua conta, com data de expiração:
  - Account → **Workers Scripts: Edit** (deploy, versões, rollback);
  - Account → **D1: Edit** (migrations e export);
  - Account → **Workers R2 Storage: Edit** (upload do backup);
  - Account → **Account Settings: Read** (o wrangler lê os dados da conta).

  Não precisa de permissão de zona: o domínio é `workers.dev`. Também não precisa de `Memberships`, porque o account id é passado.

- **Token de backup** (outro token, para o workflow semanal): só **D1: Edit** e **Workers R2 Storage: Edit**, mais **Account Settings: Read**.
- **`EXPO_TOKEN`**: expo.dev → Account settings → Access tokens.

Se um passo do CI falhar com `Authentication error [code: 10000]`, falta uma permissão no token. O erro diz qual endpoint foi negado.

### Higiene antes do primeiro push

1. Nenhum segredo versionado. Isto deve listar só `.example` e `apps/web/.env.production`:

   ```bash
   git ls-files | grep -iE '\.env|dev\.vars|\.pem|\.jks|keystore|credentials|service-account'
   ```

   `.gitignore` já cobre `.dev.vars*`, `.env*`, `backups/`, `tail*.json`, `credentials.json`, `*.jks`, `*.keystore` e `*service-account*.json`.

2. **O repositório é público.**
   - `legacy/server/src/notification-routes.ts` tem um par de chaves VAPID hardcoded, e ele está no histórico: trate-o como comprometido e **nunca o reutilize**. As chaves de produção da v2 já são outras (`VITE_VAPID_PUBLIC_KEY` é diferente da chave pública do legado).
   - `legacy/server/prisma/dev.db` também está versionado e público. Pelas Decisions, ele só tem dados de teste.
   - Se algum dia houver algo sensível no histórico, só um `git filter-repo` mais force push remove (decisão sua; reescreve o histórico).
3. Exportações do D1 têm dados reais. Elas ficam em `backups/` (ignorado) ou no R2 privado, nunca como artefato do GitHub nem em issue.

### Primeiro deploy

O seu já foi feito à mão em 2026-10-10. Este passo a passo serve para recriar tudo do zero ou numa conta nova.

1. **Banco:**
   ```bash
   pnpm --filter api exec wrangler d1 create habits
   ```
   Copie o `database_id` impresso para `apps/api/wrangler.jsonc` (`d1_databases[0].database_id`). Não é segredo.
2. **Segredos da API.** Cada comando pede o valor; nunca o coloque na linha de comando nem em arquivo versionado.
   ```bash
   pnpm --filter api exec wrangler secret put BETTER_AUTH_SECRET   # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   pnpm --filter api exec wrangler secret put BETTER_AUTH_URL      # https://habits.rxniery.workers.dev
   pnpm --filter api exec wrangler secret put OWNER_EMAIL
   pnpm --filter api vapid:generate                                # gera um par novo (só imprime)
   pnpm --filter api exec wrangler secret put VAPID_PUBLIC_KEY
   pnpm --filter api exec wrangler secret put VAPID_PRIVATE_KEY
   pnpm --filter api exec wrangler secret put VAPID_SUBJECT        # https://habits.rxniery.workers.dev
   ```
   Coloque a chave pública em `apps/web/.env.production` (`VITE_VAPID_PUBLIC_KEY`).
3. **Migrations:**
   ```bash
   pnpm --filter api db:migrate:remote
   ```
4. **Publicar** (a API antes do web):
   ```bash
   pnpm --filter api run deploy
   pnpm --filter web run deploy
   ```
5. **Criar o dono:** com `OWNER_EMAIL` definido, só esse e-mail consegue. A senha precisa de 16 caracteres ou mais.
   ```bash
   curl -sS -X POST https://habits.rxniery.workers.dev/api/v1/auth/sign-up/email \
     -H "Content-Type: application/json" -H "Origin: https://habits.rxniery.workers.dev" \
     -d '{"name":"<nome>","email":"<OWNER_EMAIL>","password":"<senha forte>"}'
   ```
   Para não deixar a senha no histórico do shell, rode o comando com um espaço na frente (bash com `HISTCONTROL=ignorespace`) ou crie a conta pela tela de login. Um segundo cadastro deve responder `403 SIGNUP_DISABLED`.
6. Siga o [checklist pós-deploy](#checklist-pós-deploy).

### CI/CD no GitHub

Workflows em `.github/workflows/`:

| Workflow     | Quando                                            | O que faz                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checks.yml` | reutilizado pelos outros                          | `pnpm install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test`, `migrations:check`, build do web, `wrangler deploy --dry-run` da API e do web. Sem segredos.                                                          |
| `ci.yml`     | pull requests, segunda-feira 08:00 UTC, ou manual | `checks` + `pnpm audit --prod` (informativo: avisos viram um alerta amarelo, nunca um X). Cancela execuções antigas do mesmo PR.                                                                                                     |
| `deploy.yml` | push na `main`, ou manual                         | `checks`; depois, no Environment `production` (com **sua aprovação**): backup do D1 no R2, migrations remotas, deploy da API, build e deploy do web, smoke test e, se o app mudou, EAS Update. Nunca cancela um deploy em andamento. |
| `backup.yml` | domingo 07:00 UTC, ou manual                      | Confere o `/health` e exporta o D1 para o R2 (Environment `backup`, sem aprovação).                                                                                                                                                  |

Todas as actions estão fixadas por SHA, com a tag num comentário, e as permissões são só `contents: read`. PRs de forks rodam `pull_request` (nunca `pull_request_target`), então não veem segredos. **Os logs de um repositório público são públicos:** nenhum passo imprime SQL, dados ou segredos.

**Configuração (uma vez):**

1. Settings → Environments → **New environment `production`**:
   - Deployment protection rules → **Required reviewers**: você. Recomendo a aprovação manual: um clique por deploy é barato diante de uma migration ruim indo direto para produção.
   - Deployment branches → **Selected branches**: `main`.
   - Environment secrets: `CLOUDFLARE_API_TOKEN` (token de deploy), `CLOUDFLARE_ACCOUNT_ID` e `EXPO_TOKEN`.
2. **New environment `backup`**, sem revisores, só da branch `main`, com os secrets `CLOUDFLARE_API_TOKEN` (token de backup) e `CLOUDFLARE_ACCOUNT_ID`.
3. Settings → Actions → General:
   - "Fork pull request workflows from outside collaborators": **Require approval for all outside collaborators**;
   - Workflow permissions: **Read repository contents**.
4. Settings → Code security: ative o **Dependabot alerts**. O `dependabot.yml` cuida das atualizações das actions.
5. Settings → Branches (opcional): proteja a `main` exigindo o check `checks / lint, typecheck, test, build`.

### Deploy do dia a dia

1. Faça o commit e o push na `main`, ou o merge de um PR verde.
2. Actions → **deploy** → aprove o job `deploy` (Review deployments → Approve).
3. O job faz backup, migrations, API, web e smoke test (`/api/v1/health` = ok, `/api/v1/docs` = 404, CSP presente). Se o push mexeu em `apps/mobile/`, nos pacotes que o app usa ou no `pnpm-lock.yaml`, ele também publica o OTA no canal `production`.
4. Se o smoke test falhar, o job falha e o GitHub manda e-mail. Veja [Rollback](#rollback).

Para publicar um OTA sem mudança no app, use Actions → deploy → Run workflow → marque "Publish an EAS Update".

Deploy manual, sem CI (por exemplo, se o GitHub estiver fora):

```bash
pnpm --filter api db:backup:remote
pnpm --filter api db:migrate:remote
pnpm --filter api run deploy
pnpm --filter web run deploy
```

### Mobile: builds e updates (EAS)

Perfis em `apps/mobile/eas.json`:

| Perfil        | Para quê                     | Distribuição                                     | Canal OTA    | Ambiente EAS                              |
| ------------- | ---------------------------- | ------------------------------------------------ | ------------ | ----------------------------------------- |
| `development` | dev client (Metro)           | APK interno                                      | nenhum       | `development` (a URL vem do `.env` local) |
| `preview`     | testar um build "de verdade" | APK interno                                      | `preview`    | `preview`                                 |
| `production`  | o app do dia a dia           | APK interno, `versionCode` incrementado pelo EAS | `production` | `production`                              |

O **APK interno** é a distribuição mais simples no Android: um link ou QR code do EAS, sem Play Store. iOS fica fora do alvo. O caminho seria uma conta Apple Developer paga mais um build `ios` com distribuição `internal` (ad hoc) ou TestFlight.

**Configuração (uma vez):**

```bash
cd apps/mobile
pnpm dlx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://habits.rxniery.workers.dev/api --environment production --visibility plaintext
pnpm dlx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://habits.rxniery.workers.dev/api --environment preview --visibility plaintext
```

O `eas update:configure` já está aplicado no `app.json` (`runtimeVersion`, `updates.url`) e o `expo-updates` está instalado.

**Antes do primeiro build de produção:**

- confira a versão `2.0.0` em `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json` e `expo.version` em `apps/mobile/app.json`;
- confira a FCM V1 no EAS (`eas credentials` → Android → Google Service Account);
- confira que a variável EAS existe.

**Primeiro build de produção:**

```bash
cd apps/mobile
pnpm dlx eas-cli@latest build --profile production --platform android
```

Instale pelo link ou QR que o EAS mostra. Ele usa o mesmo package (`com.rxniery.habits`) do development build, então **substitui** o dev client no aparelho. Se a assinatura for a mesma, os dados locais ficam; se o Android recusar ("pacote conflita"), desinstale o dev build antes, mas **sincronize primeiro**, porque desinstalar apaga o banco local e as pendências. Para ter os dois lado a lado seria preciso um package `.dev` (variante em `app.config.js` + outro app no Firebase); hoje não está feito.

**Como o app recebe updates:** a cada abertura, o `expo-updates` consulta o canal `production` (`checkAutomatically: ON_LOAD`), baixa em segundo plano e aplica **na próxima** abertura. Para ver um update na hora, feche e abra o app duas vezes.

**Build novo ou OTA?** A política do `runtimeVersion` é `fingerprint`: um hash de tudo que é nativo.

- **Precisa de build novo:** dependência nativa nova ou atualizada, config plugin, campos nativos do `app.json` (permissões, ícone, splash, package, plugins), `google-services.json`, SDK do Expo. O fingerprint muda e o OTA publicado depois disso só chega aos builds com o mesmo fingerprint, nunca a um binário incompatível.
- **Vai por OTA:** só JS, TS ou assets.
- Todo OTA roda contra a API de produção, que o mesmo workflow publica antes. A API continua aceitando o que apps antigos mandam: contratos só aditivos, protocolo de sync `1`, outbox antigo processado mutation por mutation.
- Por que fingerprint e não `appVersion`: o OTA sai automático no CI e a versão fica em 2.0.0. Com `appVersion`, esquecer de subir a versão depois de uma mudança nativa mandaria JS incompatível para o aparelho.
- Publique OTA pelo CI (Linux, mesmo ambiente do EAS Build). Um `eas update` local no Windows pode calcular outro fingerprint. Para conferir: `pnpm dlx eas-cli@latest fingerprint:compare`.

**Credenciais e o risco de perdê-las:**

- **Keystore Android:** o EAS gera e guarda. Baixe uma cópia (`eas credentials` → Android → production → credentials.json → Download) e guarde num gerenciador de senhas, **nunca no repositório**. Se ela se perder, nenhum APK novo instala por cima do atual: só desinstalando, o que apaga o banco local e as alterações não sincronizadas. Com ela, um build novo instala por cima normalmente.
- **FCM V1 (conta de serviço do Firebase):** fica no EAS. Você não precisa guardar cópia: se perder ou vazar, gere outra chave no Firebase (Project settings → Service accounts), revogue a antiga e envie a nova com `eas credentials`.
- **`google-services.json`:** é público e fica versionado.

### Rollback

**Workers** (cada deploy, e cada `wrangler secret put`, cria uma versão; dá para voltar entre as 100 últimas):

```bash
pnpm --filter api exec wrangler deployments list           # ou: versions list
pnpm --filter api exec wrangler rollback <version-id> -m "motivo"
pnpm --filter web exec wrangler rollback <version-id> -m "motivo"
```

- O rollback do web volta os assets e o gateway juntos. Os navegadores recebem o "Atualizar" do service worker.
- O rollback **não desfaz migrations** nem dados do D1. Como as migrations são só aditivas, o código anterior funciona no schema novo. Se precisar desfazer dados, veja a restauração.
- Se precisar voltar a API e o web, volte o web primeiro (ele chama a API) ou os dois em seguida.
- O próximo push na `main` publica de novo o código atual. Para manter o rollback, reverta o commit (`git revert`) antes do próximo deploy.

**Mobile (EAS Update):**

```bash
cd apps/mobile
pnpm dlx eas-cli@latest update:rollback      # interativo: volta para um update anterior ou para o embutido no build
```

Alternativa: rode o workflow `deploy` manualmente a partir de um commit anterior com "Publish an EAS Update" marcado, ou reverta o commit e faça push. Um bug nativo não tem rollback por OTA: é preciso instalar o APK do build anterior (a página do build no expo.dev guarda os artefatos).

### Backup e restauração do D1

**Os dois mecanismos:**

|            | Time Travel                                                                  | Export (`.sql`)                                                                   |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Janela     | **7 dias** no Free (30 no Paid), por minuto                                  | O tempo que o arquivo existir (R2: 90 dias)                                       |
| Onde       | Cloudflare, automático                                                       | R2 privado `habits-backups` (`pre-deploy/`, `weekly/`) ou `backups/` local        |
| Restaura   | O próprio banco, no lugar (destrutivo)                                       | Um banco **vazio** (novo)                                                         |
| Use quando | Um erro recente: migration ou deploy ruim, dados apagados há menos de 7 dias | Algo mais antigo que 7 dias, um banco apagado, ou levar os dados para outra conta |

**Criar o bucket** (uma vez, depois de ativar o R2):

```bash
pnpm --filter api exec wrangler r2 bucket create habits-backups
pnpm --filter api exec wrangler r2 bucket lifecycle add habits-backups expire-90d --expire-days 90 --force
```

O bucket é privado por padrão: não ative acesso público nem domínio `r2.dev`. Custo: cada backup tem algumas centenas de KB gzipados, muito abaixo do grátis (10 GB-mês, 1 milhão de operações de escrita por mês).

**Backups automáticos:** o `deploy.yml` exporta antes de cada migration (`pre-deploy/<data>-<sha>.sql.gz`) e o `backup.yml` exporta todo domingo (`weekly/<data>.sql.gz`). Durante o export o banco fica bloqueado por um instante.

**Backup manual** (antes de uma mudança arriscada):

```bash
pnpm --filter api db:backup:remote    # grava backups/habits-remote-<data>.sql (ignorado pelo git)
```

**Time Travel:**

```bash
pnpm --filter api exec wrangler d1 time-travel info habits                                       # bookmark atual
pnpm --filter api exec wrangler d1 time-travel restore habits --timestamp=2026-10-11T12:00:00Z   # volta a esse instante
```

O restore cancela as queries em andamento e imprime um bookmark para desfazer. Guarde esse bookmark.

**Restaurar um export.** O export do D1 não restaura tal como sai: ele grava cada tabela seguida das linhas, em ordem alfabética, e `account` vem antes de `user`. O `db:restore:prepare` reordena tudo:

1. todas as tabelas;
2. as linhas;
3. os índices;
4. os triggers de sync, por último, para não renumerar o `server_seq`.

Testado em local (contagens, `server_seq` e triggers idênticos):

```bash
# 1. Baixe o arquivo (painel R2 → habits-backups → objeto → Download, ou o comando abaixo) e descompacte,
#    ou use um de backups/. Os comandos `pnpm --filter api …` rodam dentro de apps/api, daí o ../../
mkdir -p backups
pnpm --filter api exec wrangler r2 object get habits-backups/weekly/<arquivo>.sql.gz --file ../../backups/restore.sql.gz --remote
gzip -d backups/restore.sql.gz

# 2. Reordene para restaurar num banco vazio (gera backups/restore.restore.sql)
pnpm --filter api db:restore:prepare ../../backups/restore.sql

# 3a. Ensaio local, num D1 separado (não mexe no seu banco de dev):
pnpm --filter api exec wrangler d1 execute DB --local --persist-to ../../.wrangler/restore-test --file ../../backups/restore.restore.sql
pnpm --filter api exec wrangler d1 execute DB --local --persist-to ../../.wrangler/restore-test --file scripts/row-counts.sql

# 3b. Produção: restaure num banco NOVO e troque o binding
pnpm --filter api exec wrangler d1 create habits-restore
pnpm --filter api exec wrangler d1 execute habits-restore --remote --file ../../backups/restore.restore.sql
pnpm --filter api exec wrangler d1 execute habits-restore --remote --file scripts/row-counts.sql
```

No caso de produção, depois de conferir as contagens:

1. troque o `database_id` (e o `database_name`) em `apps/api/wrangler.jsonc` pelo do banco novo;
2. faça commit e push, e aprove o deploy;
3. as migrations não reaplicam nada, porque a tabela `d1_migrations` veio no export;
4. apague o banco antigo só depois de uns dias.

As sessões também vêm no backup, então quem estava logado continua. Alterações feitas depois do backup se perdem no servidor, mas os aparelhos com pendências no outbox as reenviam. Um cursor de sync maior que o do banco restaurado faz o app refazer o sync completo (`reset`).

`scripts/row-counts.sql` lista a contagem por tabela, `d1_migrations`, os triggers (devem ser 4) e o maior `seq`. Rode-o no banco de origem e no restaurado e compare.

### Rotação de segredos

Cada `wrangler secret put` cria uma versão nova da API na hora (sem deploy de código).

| Segredo                                    | Como trocar                                                                                                                                           | Efeito                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`                       | `wrangler secret put BETTER_AUTH_SECRET` com um valor novo                                                                                            | Todos os cookies e sessões assinados deixam de valer: web e mobile voltam ao login. No mobile, o banco local e as pendências **ficam** e sincronizam depois do login (mesmo usuário).                                                                              |
| `VAPID_PRIVATE_KEY` + `VAPID_PUBLIC_KEY`   | Gere um par (`vapid:generate`), atualize os dois secrets e `VITE_VAPID_PUBLIC_KEY` em `apps/web/.env.production`, e faça commit e deploy do web junto | Todas as subscriptions Web Push existentes ficam inválidas (os push services recusam, e a API as remove). Cada navegador re-registra sozinho ao abrir o app com a permissão já concedida; quem não abrir para de receber lembretes. O mobile (Expo) não é afetado. |
| `VAPID_SUBJECT`                            | `secret put`                                                                                                                                          | Nenhum.                                                                                                                                                                                                                                                            |
| `OWNER_EMAIL`                              | `secret put`                                                                                                                                          | Só importa enquanto não existe usuário.                                                                                                                                                                                                                            |
| `EXPO_ACCESS_TOKEN`                        | Gere outro no expo.dev e faça `secret put`                                                                                                            | Nenhum, se feito em seguida (o push mobile falha entre a revogação e a troca).                                                                                                                                                                                     |
| Tokens Cloudflare (`production`, `backup`) | Crie um novo, atualize o secret do Environment e revogue o antigo                                                                                     | Nenhum para o usuário.                                                                                                                                                                                                                                             |
| `EXPO_TOKEN`                               | Crie um novo, atualize o secret e revogue o antigo                                                                                                    | Nenhum.                                                                                                                                                                                                                                                            |
| Chave FCM V1                               | Nova chave no Firebase → `eas credentials` → revogue a antiga                                                                                         | Nenhum, se feito em seguida.                                                                                                                                                                                                                                       |

### Mudança destrutiva em duas etapas

Produção roda a API nova ao lado de apps mobile antigos, com outbox pendente, e o rollback do Worker não desfaz migrations. Por isso toda migration é **aditiva** (expand), e o `pnpm --filter api migrations:check` (no CI) bloqueia `DROP`, `ALTER TABLE … RENAME` e `DELETE FROM`.

Para remover ou renomear uma coluna ou tabela:

1. **Expand** (um deploy): adicione a coluna ou tabela nova, com backfill na migration. O código passa a escrever nos dois lugares e a ler do novo. O contrato da API só ganha campos opcionais.
2. **Espere:** todos os clientes rodando o código novo (o OTA chegou, os builds antigos foram atualizados), outboxes antigos esvaziados (a tela Sincronização sem pendências) e um backup recente.
3. **Contract** (outro commit e outro deploy): o código para de usar o antigo, e uma migration nova remove, com a linha de aprovação:
   ```sql
   -- migration-guard: destructive-ok remove habits.legacy_color (unused since 2.1.0, all clients updated)
   ALTER TABLE `habits` DROP COLUMN `legacy_color`;
   ```
   Rode `pnpm --filter api db:backup:remote` antes de aprovar esse deploy.

Uma reconstrução de tabela (o jeito do SQLite de mudar constraints: `CREATE __new_x`, copiar, `DROP`, `RENAME`) também precisa do marcador e precisa recriar os triggers de sync quando for em `habits` ou `completions` (ver `apps/api/CLAUDE.md`).

### Observabilidade

- **Workers Logs** (ligado nos dois Workers, todas as invocações; Free: 200 mil eventos/dia, retenção de 3 dias): painel → Workers & Pages → `habits-api` → Observability → Logs.
  - A API loga objetos JSON com um campo `event` (`unhandled_error`, `cron_reminders`, `cron_sync_purge`, `cron_failed`, `web_push_failed`, `expo_push_failed`, …).
  - Filtre por `event` ou por `$workers.outcome` (`ok`, `exception`, `exceededCpu`, `exceededMemory`).
  - Os logs nunca têm e-mail, cookie, token, endpoint ou chave de push, corpo de requisição ou query string.
- **Ao vivo:**
  ```bash
  pnpm --filter api exec wrangler tail habits-api --format pretty
  pnpm --filter api exec wrangler tail habits-api --status error   # só falhas
  ```
  O `tail` mostra os headers das requisições (cookies inclusive): não cole a saída em lugar público.
- **Limite de CPU (erro 1102):** o cliente recebe a página "Worker exceeded resource limits" (no app, um erro de servidor), e o log mostra `outcome: exceededCpu`. Veja [Medir o tempo de login](#medir-o-tempo-de-login-cpu).
- **Cron:** painel → `habits-api` → Settings → Trigger Events (ou a aba Cron Events) mostra cada execução e o resultado. Nos Logs, filtre `$workers.eventType = scheduled`. Uma execução boa loga `cron_reminders` com as contagens; uma falha loga `cron_failed` e fica com `outcome: exception`. Para disparar à mão em dev: `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/15+*+*+*+*&time=<ms>"`.

### Medir o tempo de login (CPU)

O hash de senha é propositalmente leve (scrypt N=2048, ver Decisions no `CLAUDE.md`) para caber nos 10 ms de CPU do plano Free. A medição de 2026-10-10 deu: sign-up 76 ms, sign-in 25 ms, get-session 13 a 51 ms, todos com `outcome: ok`. A Cloudflare tolera picos, mas o risco existe.

1. Num terminal:
   ```bash
   pnpm --filter api exec wrangler tail habits-api --format json > tail.json
   ```
2. Faça uns 10 logins (web ou app) e use o app um pouco. Depois Ctrl+C.
3. Gere o relatório:
   ```bash
   pnpm --filter api cpu-report ../../tail.json
   ```
   Ele mostra uma tabela por rota (n, p50, p95, máx. de `cpuTime`, quantas acima de 10 ms e os `outcome`). Os ids e datas aparecem trocados por `:id` e `:date`.
4. Apague o `tail.json` (tem headers e cookies; o `.gitignore` já o ignora).

**Se aparecer `exceededCpu` ou 1102:**

1. **Primeiro, o que não muda a segurança:** criar o Better Auth uma vez por isolate em vez de por requisição (`createAuth` em `apps/api/src/auth/auth.ts`, item pendente do Roadmap). Isso tira o custo fixo de cada rota autenticada.
2. **Depois, o hash:** baixar `N` em `CURRENT_PARAMS` (`apps/api/src/auth/password.ts`). O formato é versionado, então os hashes antigos continuam válidos. Mas o rehash no login só **sobe** parâmetros, então uma redução vale só para senhas novas ou trocadas, e o login dos hashes existentes continua com o custo antigo. Compense mantendo o mínimo de 16 caracteres.
3. **Por fim, o Workers Paid** (US$ 5/mês, 30 s de CPU por requisição): a solução definitiva. Aí suba o scrypt para o padrão (ver Decisions).

### Alertas

O que dá para ter de graça:

- **E-mail do GitHub** quando o `deploy` ou o `backup` falham. Settings → Notifications → Actions: "Send notifications for failed workflows only". O backup checa o `/health` toda semana, então ele vira um monitor semanal simples.
- **E-mail do EAS** quando um build falha.
- **Dependabot alerts** para vulnerabilidades.

O que fica de fora: alerta em tempo real de erros 5xx, de CPU (1102) ou de falha do cron, e monitoramento de uptime frequente (as notificações de Workers e os health checks da Cloudflare são de planos pagos). Para isso é preciso olhar os Workers Logs, que ficam 3 dias. Vale olhar uma vez por semana, ou depois de cada deploy.

### Checklist pós-deploy

Depois do primeiro deploy pelo CI (e de mudanças grandes):

1. **Health:** `curl -s https://habits.rxniery.workers.dev/api/v1/health` → `{"status":"ok","version":"2.0.0"}`.
2. **Docs fechadas:** `curl -s -o /dev/null -w "%{http_code}\n" https://habits.rxniery.workers.dev/api/v1/docs` → `404`.
3. **Cabeçalhos:**
   - `curl -sI https://habits.rxniery.workers.dev/` deve trazer `content-security-policy`, `x-content-type-options`, `referrer-policy`, `x-frame-options` e `permissions-policy`, com `Cache-Control: no-cache`;
   - `curl -sI https://habits.rxniery.workers.dev/sw.js` → `no-cache`;
   - um arquivo de `/assets/` → `max-age=31536000, immutable`;
   - `curl -si https://habits.rxniery.workers.dev/api/v1/habits` → `401` com `Cache-Control: no-store`.
4. **Login** no web e no app. No DevTools → Console, nenhum erro de CSP.
5. **Cadastro fechado:** um sign-up com outro e-mail → `403 SIGNUP_DISABLED`.
6. **Marcar e desmarcar** um hábito hoje. O heatmap atualiza (web e app).
7. **PWA:** instalar pelo navegador (Android: "Instalar app"; iOS: Compartilhar → Adicionar à Tela de Início) e abrir.
8. **Atualização do service worker:** depois de um deploy novo do web, abrir o PWA mostra o "Atualizar", e tocar recarrega na versão nova.
9. **Push de teste:** Ajustes → Lembretes → enviar teste, no web e no app.
10. **Cron real:** defina um `reminder_time` alguns minutos à frente com um hábito pendente. Em até 15 minutos chega o lembrete, e os Logs mostram `cron_reminders` com `usersNotified: 1`.
11. **OTA:** faça uma mudança só de JS (um texto, por exemplo), push e aprovação. Abra o app, feche, abra de novo: a mudança aparece. Em expo.dev → Updates, o update aparece no canal `production`.
12. **Offline e sync contra produção:** modo avião, marcar hábitos ("Offline · N pendentes"), voltar a rede ("Sincronizado às HH:MM"), e conferir no web.
13. **Tempo de login:** siga [Medir o tempo de login](#medir-o-tempo-de-login-cpu).
14. **Backup:** rode o `backup` à mão (Actions → backup → Run workflow) e confira o objeto em `habits-backups/weekly/`.

### Problemas comuns

| Sintoma                                                             | Causa provável                                                                              | O que fazer                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Página "Worker exceeded resource limits" / log `exceededCpu` (1102) | CPU acima do limite do Free                                                                 | [Medir o tempo de login](#medir-o-tempo-de-login-cpu) e as três opções.                                                                                                                                                                             |
| `403 SIGNUP_DISABLED`                                               | Já existe um usuário (é o esperado)                                                         | Entre com a conta do dono. Recriar o dono exige apagar o usuário no D1.                                                                                                                                                                             |
| Login no web não "pega" (volta para o login)                        | `BETTER_AUTH_URL` diferente da origem, ou domínio trocado                                   | `BETTER_AUTH_URL` = origem exata, sem barra final. Limpe os cookies do site.                                                                                                                                                                        |
| PWA preso numa versão antiga                                        | Aba antiga aberta, ou o "Atualizar" ignorado                                                | Feche todas as abas e janelas do app, ou DevTools → Application → Service Workers → Update/Unregister. `sw.js` é `no-cache`, então a próxima carga busca a versão nova.                                                                             |
| OTA não chega                                                       | Runtime diferente (mudou algo nativo), canal errado, ou o app só aplica na segunda abertura | Feche e abra duas vezes. Compare o runtime do build e do update em expo.dev. Se for nativo, faça um build novo.                                                                                                                                     |
| Deploy falhou em "Apply D1 migrations"                              | Erro de SQL ou limite do D1                                                                 | As migrations já aplicadas ficam registradas, e a que falhou não. O banco está como antes dela (backup em `pre-deploy/`). Corrija com uma migration nova e faça push. Se algo ficou pela metade, use o Time Travel para o instante antes do deploy. |
| Deploy falhou depois das migrations (API ou web)                    | Erro de build ou de token                                                                   | O schema novo é aditivo e o código antigo segue no ar. Corrija e faça push.                                                                                                                                                                         |
| `Authentication error [code: 10000]` no CI                          | Falta uma permissão no token                                                                | Veja [Pré-requisitos](#pré-requisitos).                                                                                                                                                                                                             |
| D1 com "daily limits exceeded"                                      | 5 M linhas lidas ou 100 mil escritas no dia (Free)                                          | Volta às 00:00 UTC. Se for recorrente, investigue nos Logs ou vá para o Paid.                                                                                                                                                                       |
| Lembrete "pendente" de um hábito já marcado no celular              | Conclusão offline ainda não sincronizada                                                    | Conhecido e aceito (ver "Push notifications" no `CLAUDE.md`).                                                                                                                                                                                       |
| Smoke test falha só no CSP                                          | O `_headers` não foi para o build                                                           | Confira `apps/web/public/_headers` e `apps/web/dist/_headers`.                                                                                                                                                                                      |

### Atualizações de dependências

- **Actions:** o Dependabot abre PRs semanais (agrupados), e o CI valida.
- **Pacotes npm:** o Dependabot não suporta pnpm 12 (só até a v10). O CI roda `pnpm audit --prod` em cada PR e toda segunda-feira (informativo; veja o job `audit`). Para atualizar: `pnpm outdated -r` mostra o que está velho, e `pnpm update -r <pacote>@latest` atualiza (no mobile, use `pnpm exec expo install --fix` para alinhar com o SDK); depois typecheck, lint e testes. Se quiser PRs automáticos de npm, o caminho é o Renovate.

## Limites dos planos gratuitos

Conferidos em 2026-10-11:

| Serviço           | Limite                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers Free      | 100 mil requests/dia; 10 ms de CPU por request e por cron; 50 subrequests por invocação; 5 Cron Triggers por conta (usamos 1).             |
| D1 Free           | 10 bancos; 500 MB por banco; 5 GB por conta; 5 M linhas lidas e 100 mil escritas por dia; 50 queries por invocação; Time Travel de 7 dias. |
| Workers Logs Free | 200 mil eventos/dia, retenção de 3 dias.                                                                                                   |
| R2 Free           | 10 GB-mês; 1 M operações classe A e 10 M classe B por mês; sem custo de saída.                                                             |
| EAS Free          | 15 builds Android por mês (fila de baixa prioridade); EAS Update até 1.000 usuários ativos por mês.                                        |
| GitHub Actions    | Minutos ilimitados em repositório público.                                                                                                 |
