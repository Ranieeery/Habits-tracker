# Habits

Rastreador de hábitos pessoal com heatmap no estilo das contribuições do GitHub. Você cria hábitos que se repetem em dias da semana escolhidos e marca, a cada dia, o que fez. Cada dia do ano vira um quadrado do heatmap, com a cor mais forte quanto maior a proporção de hábitos cumpridos.

É feito para **uma pessoa só** (o dono da instalação): o cadastro fecha depois da primeira conta. O modelo de dados já separa tudo por usuário, então várias contas seriam possíveis no futuro.

- **Mobile (principal):** Expo + Expo Router, Android, offline-first: os dados ficam num SQLite no aparelho e sincronizam com o servidor quando há rede, inclusive em segundo plano.
- **Web:** PWA em Vite + React, instalável, com Web Push.
- **API:** Hono em Cloudflare Workers, banco D1 (SQLite) via Drizzle, autenticação com Better Auth e um cron que manda lembretes ("Você tem N hábitos pendentes hoje").
- **Infra:** cabe nos planos gratuitos da Cloudflare, do Expo (EAS) e do GitHub Actions. O único produto que pede cartão é o R2, usado para backups, e o uso fica dentro do gratuito.

Versão 2.1.0. A 2.0.0 foi uma reescrita completa do app antigo (1.x), que continua no histórico do git: a tag `v2.0.0` ainda contém a pasta `legacy/`. API, web e mobile sempre têm a mesma versão; a política e o histórico estão em [`CLAUDE.md`](CLAUDE.md) ("Git and versioning").

As regras de arquitetura, o modelo de dados, as decisões e todos os comandos de desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md) e nos `CLAUDE.md` de cada app (em inglês). Este README explica como rodar localmente e como publicar a sua própria instância.

## Sumário

- [Estrutura](#estrutura)
- [Desenvolvimento](#desenvolvimento)
- [Faça a sua instância](#faça-a-sua-instância)
  - [Topologia](#topologia)
  - [O que trocar no repositório](#o-que-trocar-no-repositório)
  - [Segredos e variáveis](#segredos-e-variáveis)
  - [Pré-requisitos](#pré-requisitos)
  - [Primeiro deploy](#primeiro-deploy)
  - [CI/CD no GitHub](#cicd-no-github)
  - [Mobile: builds e updates (EAS)](#mobile-builds-e-updates-eas)
- [Operação](#operação)
  - [Deploy do dia a dia](#deploy-do-dia-a-dia)
  - [Rollback](#rollback)
  - [Backup e restauração do D1](#backup-e-restauração-do-d1)
  - [Rotação de segredos](#rotação-de-segredos)
  - [Mudança destrutiva em duas etapas](#mudança-destrutiva-em-duas-etapas)
  - [Observabilidade](#observabilidade)
  - [Medir o tempo de login (CPU)](#medir-o-tempo-de-login-cpu)
  - [Custos e alertas](#custos-e-alertas)
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

O app mobile precisa de um development build (não roda no Expo Go): veja `apps/mobile/CLAUDE.md`. A lista completa de comandos está em `CLAUDE.md` (seção "Commands").

## Faça a sua instância

Nos exemplos abaixo, `<ORIGEM>` é o endereço público da sua instância, por exemplo `https://habits.<seu-subdominio>.workers.dev`, sem barra no final. A API fica em `<ORIGEM>/api`.

**Regra:** comandos `--remote`, `wrangler deploy`, `wrangler secret`, `eas build` e `eas update` afetam a sua instância publicada. Os comandos `wrangler` partem da raiz do repositório com `pnpm --filter api exec wrangler …` (ou `--filter web`), para usar a versão do lockfile.

### Topologia

Dois Workers no mesmo domínio `*.workers.dev`:

- **`habits` (público):** serve o `dist/` do web como Workers Static Assets, com fallback de SPA. Só `/api` e `/api/*` executam código (`run_worker_first`): o gateway tira o prefixo `/api` e repassa a requisição (cookies, origem, IP) ao `habits-api` pelo service binding.
- **`habits-api` (privado):** sem URL pública (`workers_dev: false`). D1 `habits` e Cron Trigger `*/15 * * * *`.

Por que assim:

- web e API ficam na mesma origem, então o cookie de sessão é same-origin, sem CORS;
- o prefixo `/api` é o mesmo do proxy de desenvolvimento do Vite;
- a API não tem URL própria exposta;
- os testes e o `wrangler dev` da API não dependem do build do web.

Ordem de deploy: **migrations do D1, depois a API, depois o web** (o binding precisa que a API exista, e o web novo pode chamar rotas novas).

**Se usar um domínio próprio** em vez de `workers.dev`:

- `BETTER_AUTH_URL` passa a ser a nova origem, e `TRUSTED_ORIGINS` continua vazio (mesma origem);
- cookies e subscriptions Web Push são por origem: depois de trocar, todos fazem login de novo, reativam os lembretes e reinstalam o PWA;
- `VAPID_SUBJECT`, `EXPO_PUBLIC_API_URL` e `PRODUCTION_URL` dos workflows mudam.

A CSP não muda, porque é toda `'self'`.

### O que trocar no repositório

O repositório aponta para a instância do autor. Num fork, troque:

| Arquivo                                                  | O que trocar                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/wrangler.jsonc`                                | `database_id` pelo do seu D1 (`wrangler d1 create habits`). Não é segredo.                                                                                         |
| `apps/web/.env.production`                               | `VITE_VAPID_PUBLIC_KEY` pela sua chave pública VAPID.                                                                                                              |
| `apps/api/.dev.vars.example`, `apps/mobile/.env.example` | Os exemplos de URL de produção (só comentários e exemplos).                                                                                                        |
| `.github/workflows/deploy.yml`, `backup.yml`             | `PRODUCTION_URL` e o `environment.url` com a sua `<ORIGEM>`.                                                                                                       |
| `.github/workflows/checks.yml`                           | `EXPO_PUBLIC_API_URL` do passo "Bundle the mobile app" (qualquer URL serve: o bundle não é publicado).                                                             |
| `apps/mobile/app.json`                                   | `android.package` (um id seu, como `com.voce.habits`), `extra.eas.projectId` e `updates.url`. Rode `eas init` e `eas update:configure` para gerar os dois últimos. |
| `apps/mobile/google-services.json`                       | O arquivo do seu projeto Firebase, com o mesmo package (veja "Push notifications" em `apps/mobile/CLAUDE.md`).                                                     |

Os nomes dos Workers (`habits`, `habits-api`), do banco (`habits`) e do bucket (`habits-backups`) podem ficar iguais: eles são por conta.

### Segredos e variáveis

Nenhum valor fica no repositório. A tabela lista só nomes.

| Nome                                             | Onde vive                                                          | Para quê                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                             | Wrangler secret (`habits-api`) / `.dev.vars`                       | Assina sessões e cookies.                                                                       |
| `BETTER_AUTH_URL`                                | Wrangler secret / `.dev.vars`                                      | A `<ORIGEM>`.                                                                                   |
| `OWNER_EMAIL`                                    | Wrangler secret / `.dev.vars`                                      | Único e-mail que pode criar a primeira conta.                                                   |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`          | Wrangler secret / `.dev.vars`                                      | Web Push (`pnpm --filter api vapid:generate`). A pública também vai em `VITE_VAPID_PUBLIC_KEY`. |
| `VAPID_SUBJECT`                                  | Wrangler secret / `.dev.vars`                                      | Contato do remetente: a `<ORIGEM>` ou um `mailto:`.                                             |
| `EXPO_ACCESS_TOKEN`                              | Wrangler secret (opcional)                                         | Só se o "enhanced security" do Expo Push estiver ligado.                                        |
| `ENVIRONMENT`, `ALLOW_SIGNUP`, `TRUSTED_ORIGINS` | `apps/api/wrangler.jsonc` (versionado)                             | `production`, `false`, vazio. Em dev, `.dev.vars` sobrescreve.                                  |
| `VITE_API_URL`, `VITE_VAPID_PUBLIC_KEY`          | `apps/web/.env.production` (versionado, público)                   | Base da API (`/api`) e chave pública VAPID.                                                     |
| `CLOUDFLARE_API_TOKEN`                           | GitHub, Environment `production`                                   | Token de deploy.                                                                                |
| `CLOUDFLARE_API_TOKEN`                           | GitHub, Environment `backup`                                       | Token só de backup.                                                                             |
| `CLOUDFLARE_ACCOUNT_ID`                          | GitHub, Environments `production` e `backup`                       | ID da conta Cloudflare.                                                                         |
| `EXPO_TOKEN`                                     | GitHub, Environment `production`                                   | Publicar EAS Update no CI.                                                                      |
| `EXPO_PUBLIC_API_URL`                            | Variável EAS (`production`, `preview`) / `apps/mobile/.env` em dev | `<ORIGEM>/api`. É pública: fica embutida no app.                                                |
| Keystore Android                                 | EAS (credenciais)                                                  | Assina o APK. Guarde uma cópia fora do repositório.                                             |
| Chave da conta de serviço FCM V1                 | EAS (credenciais)                                                  | Push no Android via Expo.                                                                       |
| `google-services.json`                           | `apps/mobile/` (versionado, público)                               | Identificadores do Firebase no app.                                                             |

### Pré-requisitos

- **Contas:** Cloudflare (Workers Free), GitHub, Expo (EAS Free) e Firebase (FCM). Login local com `pnpm --filter api exec wrangler login` e `pnpm dlx eas-cli@latest login`.
- **R2:** ative no painel da Cloudflare (R2 Object Storage). Ele pede um meio de pagamento e cria a assinatura "R2 Paid", sem mensalidade; os backups ficam dentro da cota gratuita.
- **Token de deploy** (painel → My Profile → API Tokens → Create Token → Custom token), restrito à sua conta:
  - Account → **Workers Scripts: Edit** (deploy, versões, rollback);
  - Account → **D1: Edit** (migrations e export);
  - Account → **Workers R2 Storage: Edit** (upload do backup);
  - Account → **Account Settings: Read** (o wrangler lê os dados da conta).

  Não precisa de permissão de zona nem de `Memberships`.

- **Token de backup** (outro token, para o workflow semanal): só **D1: Edit**, **Workers R2 Storage: Edit** e **Account Settings: Read**.
- **`EXPO_TOKEN`:** expo.dev → Account settings → Access tokens.

A expiração dos tokens é opcional. Sem expiração, troque-os ("Roll") se houver suspeita de vazamento. Não use filtro de IP: os runners do GitHub mudam de IP a cada execução.

**Repositório público:**

- Exportações do D1 têm dados reais. Elas ficam em `backups/` (ignorado pelo git) ou no R2 privado, nunca como artefato do GitHub.
- Os logs do GitHub Actions são públicos; os workflows não imprimem SQL, dados nem segredos.
- O app antigo, no histórico, tinha chaves VAPID de teste hardcoded: nunca reutilize chaves de lá. Gere as suas.
- Antes do primeiro push, confira que nenhum segredo está versionado. Deve listar só os `.example` e o `apps/web/.env.production`:
  ```bash
  git ls-files -- '*.env*' '*dev.vars*' '*keystore*' '*credentials*' '*.jks' '*service-account*'
  ```

### Primeiro deploy

1. **Banco:**
   ```bash
   pnpm --filter api exec wrangler d1 create habits
   ```
   Copie o `database_id` impresso para `apps/api/wrangler.jsonc`.
2. **Segredos da API.** Cada comando pede o valor; nunca o coloque na linha de comando nem em arquivo versionado.
   ```bash
   pnpm --filter api exec wrangler secret put BETTER_AUTH_SECRET   # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   pnpm --filter api exec wrangler secret put BETTER_AUTH_URL      # <ORIGEM>
   pnpm --filter api exec wrangler secret put OWNER_EMAIL
   pnpm --filter api vapid:generate                                # gera um par novo (só imprime)
   pnpm --filter api exec wrangler secret put VAPID_PUBLIC_KEY
   pnpm --filter api exec wrangler secret put VAPID_PRIVATE_KEY
   pnpm --filter api exec wrangler secret put VAPID_SUBJECT        # <ORIGEM>
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
5. **Criar a sua conta.** Com `OWNER_EMAIL` definido, só esse e-mail consegue. A senha precisa de 16 caracteres ou mais.
   ```bash
   curl -sS -X POST <ORIGEM>/api/v1/auth/sign-up/email \
     -H "Content-Type: application/json" -H "Origin: <ORIGEM>" \
     -d '{"name":"<nome>","email":"<OWNER_EMAIL>","password":"<senha forte>"}'
   ```
   Para não deixar a senha no histórico do shell, rode o comando com um espaço na frente (bash com `HISTCONTROL=ignorespace`). Um segundo cadastro deve responder `403 SIGNUP_DISABLED`.
6. **Backups no R2** (uma vez):
   ```bash
   pnpm --filter api exec wrangler r2 bucket create habits-backups
   pnpm --filter api exec wrangler r2 bucket lifecycle add habits-backups expire-90d --expire-days 90 --force
   ```
   Se o wrangler oferecer adicionar o binding do bucket ao `wrangler.jsonc`, responda **não**: só os workflows usam o bucket, nunca a API. Deixe a **Public Development URL** (r2.dev) desativada e não adicione domínio.
7. Configure o [CI/CD](#cicd-no-github) e siga o [checklist pós-deploy](#checklist-pós-deploy).

### CI/CD no GitHub

Workflows em `.github/workflows/`:

| Workflow           | Quando                                            | O que faz                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checks.yml`       | reutilizado pelos outros                          | `pnpm install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test`, `migrations:check`, build do web, bundle do app mobile (`expo export`), `wrangler deploy --dry-run` da API e do web. Sem segredos.                    |
| `ci.yml`           | pull requests, segunda-feira 08:00 UTC, ou manual | `checks` + `pnpm audit --prod` (informativo: avisos viram um alerta amarelo, nunca um X).                                                                                                                                            |
| `deploy.yml`       | push na `main`, ou manual                         | `checks`; depois, no Environment `production` (com **sua aprovação**): backup do D1 no R2, migrations remotas, deploy da API, build e deploy do web, smoke test e, se o app mudou, EAS Update. Nunca cancela um deploy em andamento. |
| `backup.yml`       | domingo 07:00 UTC, ou manual                      | Confere o `/health` e exporta o D1 para o R2 (Environment `backup`, sem aprovação).                                                                                                                                                  |
| `mobile-build.yml` | manual                                            | Dispara um EAS Build Android (perfil `production`, `preview` ou `development`) a partir do Linux. Veja [Mobile](#mobile-builds-e-updates-eas).                                                                                       |

As actions estão fixadas por SHA e as permissões são só `contents: read`. PRs de forks rodam `pull_request` (nunca `pull_request_target`), então não veem segredos.

**Configuração com o `gh`** (bash; troque `<voce>/<repo>`):

```bash
REPO=<voce>/<repo>
ME=$(gh api user --jq .id)

# production: você como revisor, só a branch main
gh api -X PUT repos/$REPO/environments/production --input - <<EOF
{ "wait_timer": 0, "prevent_self_review": false,
  "reviewers": [{ "type": "User", "id": $ME }],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
gh api -X POST repos/$REPO/environments/production/deployment-branch-policies -f name=main -f type=branch

# backup: sem revisor, só a branch main
gh api -X PUT repos/$REPO/environments/backup --input - <<'EOF'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF
gh api -X POST repos/$REPO/environments/backup/deployment-branch-policies -f name=main -f type=branch

# segredos (cada comando pede o valor)
gh secret set CLOUDFLARE_API_TOKEN  --env production --repo $REPO   # token de deploy
gh secret set CLOUDFLARE_ACCOUNT_ID --env production --repo $REPO
gh secret set EXPO_TOKEN            --env production --repo $REPO
gh secret set CLOUDFLARE_API_TOKEN  --env backup     --repo $REPO   # token de backup
gh secret set CLOUDFLARE_ACCOUNT_ID --env backup     --repo $REPO

# repositório: forks precisam de aprovação, token dos workflows só lê, Dependabot alerts
gh api -X PUT repos/$REPO/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
gh api -X PUT repos/$REPO/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
gh api -X PUT repos/$REPO/vulnerability-alerts
```

No PowerShell: use `$REPO = "<voce>/<repo>"` e `$ME = gh api user --jq .id`, e troque os blocos `<<EOF` por `@" … "@ | gh api … --input -`. Pelo site: Settings → Environments, e Settings → Actions → General. O Account ID aparece em `pnpm --filter api exec wrangler whoami`.

### Mobile: builds e updates (EAS)

Perfis em `apps/mobile/eas.json`:

| Perfil        | Para quê                     | Distribuição                                     | Canal OTA    | Ambiente EAS                              |
| ------------- | ---------------------------- | ------------------------------------------------ | ------------ | ----------------------------------------- |
| `development` | dev client (Metro)           | APK interno                                      | nenhum       | `development` (a URL vem do `.env` local) |
| `preview`     | testar um build "de verdade" | APK interno                                      | `preview`    | `preview`                                 |
| `production`  | o app do dia a dia           | APK interno, `versionCode` incrementado pelo EAS | `production` | `production`                              |

O **APK interno** é a distribuição mais simples no Android: um link ou QR code do EAS, sem Play Store. iOS fica fora do alvo; o caminho seria uma conta Apple Developer paga e um build `ios` com distribuição interna (ad hoc) ou TestFlight.

**Configuração (uma vez):**

```bash
cd apps/mobile
pnpm dlx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value <ORIGEM>/api --environment production --visibility plaintext
pnpm dlx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value <ORIGEM>/api --environment preview --visibility plaintext
pnpm dlx eas-cli@latest credentials -p android      # confira a chave FCM V1 (ou envie a sua)
```

**Primeiro build de produção** (depois que o CI estiver verde, para o build sair do mesmo código que os OTAs vão atualizar). Dispare pelo GitHub Actions, que roda no Linux:

```bash
gh workflow run mobile-build -f profile=production
gh run watch                                  # aprove o environment production quando ele pedir
```

O job só envia o projeto ao EAS e termina. O build roda no EAS (de 10 a 30 minutos no plano grátis): acompanhe em expo.dev → Builds, que também manda e-mail no fim.

**Não dispare `eas build` do Windows:** o EAS compara o fingerprint calculado na máquina que dispara o build com o do servidor (Linux). No Windows o pnpm encurta os nomes das pastas do `node_modules/.pnpm` de outro jeito, o fingerprint muda e o build falha em "Configure expo-updates" com `Runtime version mismatch`. No Linux, macOS ou WSL, o comando direto funciona: `pnpm dlx eas-cli@latest build --profile production --platform android`.

Instale pelo link ou QR que o EAS mostra. Ele usa o mesmo package do development build, então **substitui** o dev client no aparelho. Se o Android recusar por conflito de assinatura, desinstale o dev build antes, mas **sincronize primeiro**: desinstalar apaga o banco local e as pendências.

**Como o app recebe updates:** a cada abertura, o `expo-updates` consulta o canal `production`, baixa em segundo plano e aplica **na próxima** abertura. Para ver um update na hora, feche e abra o app duas vezes.

**Build novo ou OTA?** A política do `runtimeVersion` é `fingerprint`: um hash de tudo que é nativo.

- **Precisa de build novo:** dependência nativa nova ou atualizada, config plugin, campos nativos do `app.json` (permissões, ícone, splash, package, plugins), `google-services.json`, SDK do Expo. O OTA publicado depois disso só chega aos builds com o mesmo fingerprint, nunca a um binário incompatível.
- **Vai por OTA:** só JS, TS ou assets. Subir a versão (`expo.version`) também: `apps/mobile/fingerprint.config.js` tira `version` e `versionCode` do hash. O `versionCode` fica no EAS (`appVersionSource: remote`) e sobe sozinho a cada build de produção.
- Todo OTA roda contra a API publicada, que o mesmo workflow atualiza antes. A API continua aceitando o que apps antigos mandam: contratos só aditivos, protocolo de sync `1`, outbox antigo processado mutation por mutation.
- Builds e OTAs saem do Linux (workflows `mobile-build` e `deploy`), então os dois calculam o mesmo fingerprint. Um `eas update` ou `eas build` local no Windows calcula outro. `apps/mobile/.fingerprintignore` tira as pastas `android/` e `ios/` geradas do cálculo.

**Credenciais:**

- **Keystore Android:** o EAS gera e guarda. Baixe uma cópia (`eas credentials` → Android → production → credentials.json → Download) e guarde num gerenciador de senhas, **nunca no repositório**. Sem ela, nenhum APK novo instala por cima do atual: só desinstalando, o que apaga o banco local e as alterações não sincronizadas.
- **FCM V1:** fica no EAS. Se perder ou vazar, gere outra chave no Firebase, revogue a antiga e envie a nova com `eas credentials`.

## Operação

### Deploy do dia a dia

1. Abra um PR e espere o `ci` ficar verde (`gh pr checks --watch`). Faça o merge.
2. O push na `main` dispara o `deploy`. Aprove o environment `production`: Actions → deploy → Review deployments → Approve, ou `gh run watch` para acompanhar.
3. O job faz backup, migrations, API, web e smoke test (`/api/v1/health` = ok, `/api/v1/docs` = 404, CSP presente). Se o push mexeu em `apps/mobile/`, nos pacotes que o app usa ou no `pnpm-lock.yaml`, ele também publica o OTA no canal `production`.
4. Se algo falhar, o job falha e o GitHub manda e-mail. `gh run view <id> --log-failed` mostra o erro. Veja [Rollback](#rollback).

Para publicar um OTA sem mudança no app: Actions → deploy → Run workflow → marque "Publish an EAS Update".

Deploy manual, sem CI:

```bash
pnpm --filter api db:backup:remote
pnpm --filter api db:migrate:remote
pnpm --filter api run deploy
pnpm --filter web run deploy
```

### Rollback

**Workers** (cada deploy, e cada `wrangler secret put`, cria uma versão; dá para voltar entre as 100 últimas):

```bash
pnpm --filter api exec wrangler deployments list
pnpm --filter api exec wrangler rollback <version-id> -m "motivo"
pnpm --filter web exec wrangler rollback <version-id> -m "motivo"
```

- O rollback do web volta os assets e o gateway juntos. Os navegadores recebem o "Atualizar" do service worker.
- O rollback **não desfaz migrations** nem dados do D1. Como as migrations são só aditivas, o código anterior funciona no schema novo.
- O próximo push na `main` publica de novo o código atual. Para manter o rollback, reverta o commit (`git revert`) antes do próximo deploy.

**Mobile (EAS Update):**

```bash
cd apps/mobile
pnpm dlx eas-cli@latest update:rollback      # interativo: volta para um update anterior ou para o embutido no build
```

Um bug nativo não tem rollback por OTA: instale o APK do build anterior (a página do build em expo.dev guarda os artefatos).

### Backup e restauração do D1

|            | Time Travel                                                                  | Export (`.sql`)                                                                   |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Janela     | **7 dias** no Free (30 no Paid), por minuto                                  | O tempo que o arquivo existir (R2: 90 dias)                                       |
| Onde       | Cloudflare, automático                                                       | R2 privado `habits-backups` (`pre-deploy/`, `weekly/`) ou `backups/` local        |
| Restaura   | O próprio banco, no lugar (destrutivo)                                       | Um banco **vazio** (novo)                                                         |
| Use quando | Um erro recente: migration ou deploy ruim, dados apagados há menos de 7 dias | Algo mais antigo que 7 dias, um banco apagado, ou levar os dados para outra conta |

**Backups automáticos:** o `deploy.yml` exporta antes de cada migration (`pre-deploy/<data>-<sha>.sql.gz`) e o `backup.yml` exporta todo domingo (`weekly/<data>.sql.gz`).

**Backup manual** (antes de uma mudança arriscada):

```bash
pnpm --filter api db:backup:remote    # grava backups/habits-remote-<data>.sql (ignorado pelo git)
```

**Time Travel:**

```bash
pnpm --filter api exec wrangler d1 time-travel info habits                                       # bookmark atual
pnpm --filter api exec wrangler d1 time-travel restore habits --timestamp=<AAAA-MM-DDTHH:MM:SSZ> # volta a esse instante
```

O restore cancela as queries em andamento e imprime um bookmark para desfazer. Guarde esse bookmark.

**Restaurar um export.** O export do D1 não restaura tal como sai: ele grava cada tabela seguida das linhas, em ordem alfabética, e `account` vem antes de `user`. O `db:restore:prepare` reordena: tabelas, linhas, índices e, por último, os triggers de sync (para não renumerar o `server_seq`).

```bash
# 1. Baixe o arquivo (painel R2 → habits-backups → objeto → Download, ou o comando abaixo) e descompacte.
#    Os comandos `pnpm --filter api …` rodam dentro de apps/api, daí o ../../
mkdir -p backups
pnpm --filter api exec wrangler r2 object get habits-backups/weekly/<arquivo>.sql.gz --file ../../backups/restore.sql.gz --remote
gzip -d backups/restore.sql.gz

# 2. Reordene para restaurar num banco vazio (gera backups/restore.restore.sql)
pnpm --filter api db:restore:prepare ../../backups/restore.sql

# 3a. Ensaio local, num D1 separado (não mexe no seu banco de dev):
pnpm --filter api exec wrangler d1 execute DB --local --persist-to ../../.wrangler/restore-test --file ../../backups/restore.restore.sql
pnpm --filter api exec wrangler d1 execute DB --local --persist-to ../../.wrangler/restore-test --file scripts/row-counts.sql

# 3b. Instância publicada: restaure num banco NOVO e troque o binding
pnpm --filter api exec wrangler d1 create habits-restore
pnpm --filter api exec wrangler d1 execute habits-restore --remote --file ../../backups/restore.restore.sql
pnpm --filter api exec wrangler d1 execute habits-restore --remote --file scripts/row-counts.sql
```

Depois de conferir as contagens, troque o `database_id` (e o `database_name`) em `apps/api/wrangler.jsonc` pelo do banco novo, faça commit e aprove o deploy. As migrations não reaplicam nada, porque a tabela `d1_migrations` veio no export. Apague o banco antigo só depois de uns dias.

As sessões também vêm no backup. Alterações feitas depois do backup se perdem no servidor, mas os aparelhos com pendências no outbox as reenviam, e um cursor de sync maior que o do banco restaurado faz o app refazer o sync completo.

`scripts/row-counts.sql` lista a contagem por tabela, `d1_migrations`, os triggers (devem ser 4) e o maior `seq`. Rode-o no banco de origem e no restaurado e compare.

### Rotação de segredos

Cada `wrangler secret put` cria uma versão nova da API na hora (sem deploy de código).

| Segredo                                    | Como trocar                                                                                                                                              | Efeito                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                       | `wrangler secret put BETTER_AUTH_SECRET` com um valor novo                                                                                               | Todas as sessões deixam de valer: web e mobile voltam ao login. No mobile, o banco local e as pendências **ficam** e sincronizam depois do login.         |
| `VAPID_PRIVATE_KEY` + `VAPID_PUBLIC_KEY`   | Gere um par (`vapid:generate`), atualize os dois secrets e `VITE_VAPID_PUBLIC_KEY` em `apps/web/.env.production`, e faça o deploy do web logo em seguida | Todas as subscriptions Web Push ficam inválidas. Cada navegador se reinscreve ao abrir o app com a permissão já concedida. O mobile (Expo) não é afetado. |
| `VAPID_SUBJECT`                            | `secret put`                                                                                                                                             | Nenhum.                                                                                                                                                   |
| `OWNER_EMAIL`                              | `secret put`                                                                                                                                             | Só importa enquanto não existe usuário.                                                                                                                   |
| `EXPO_ACCESS_TOKEN`                        | Gere outro no expo.dev e faça `secret put`                                                                                                               | Nenhum, se feito em seguida.                                                                                                                              |
| Tokens Cloudflare (`production`, `backup`) | "Roll" no painel ou crie um novo, atualize o secret do Environment e revogue o antigo                                                                    | Nenhum para o usuário.                                                                                                                                    |
| `EXPO_TOKEN`                               | Crie um novo, atualize o secret e revogue o antigo                                                                                                       | Nenhum.                                                                                                                                                   |
| Chave FCM V1                               | Nova chave no Firebase → `eas credentials` → revogue a antiga                                                                                            | Nenhum, se feito em seguida.                                                                                                                              |

### Mudança destrutiva em duas etapas

A API nova roda ao lado de apps mobile antigos, com outbox pendente, e o rollback do Worker não desfaz migrations. Por isso toda migration é **aditiva** (expand), e o `pnpm --filter api migrations:check` (no CI) bloqueia `DROP`, `ALTER TABLE … RENAME` e `DELETE FROM`.

Para remover ou renomear uma coluna ou tabela:

1. **Expand** (um deploy): adicione a coluna ou tabela nova, com backfill na migration. O código passa a escrever nos dois lugares e a ler do novo. O contrato da API só ganha campos opcionais.
2. **Espere:** o OTA chegou, os builds antigos foram atualizados, os outboxes antigos esvaziaram (tela Sincronização sem pendências) e há um backup recente.
3. **Contract** (outro commit e outro deploy): o código para de usar o antigo, e uma migration nova remove, com a linha de aprovação:
   ```sql
   -- migration-guard: destructive-ok remove habits.old_color (unused since 2.1.0, all clients updated)
   ALTER TABLE `habits` DROP COLUMN `old_color`;
   ```
   Rode `pnpm --filter api db:backup:remote` antes de aprovar esse deploy.

Uma reconstrução de tabela (o jeito do SQLite de mudar constraints: `CREATE __new_x`, copiar, `DROP`, `RENAME`) também precisa do marcador e precisa recriar os triggers de sync quando for em `habits` ou `completions` (ver `apps/api/CLAUDE.md`).

### Observabilidade

- **Workers Logs** (ligado nos dois Workers; Free: 200 mil eventos/dia, retenção de 3 dias): painel → Workers & Pages → `habits-api` → Observability → Logs.
  - A API loga objetos JSON com um campo `event` (`unhandled_error`, `cron_reminders`, `cron_sync_purge`, `cron_failed`, `web_push_failed`, `expo_push_failed`, …).
  - Filtre por `event` ou por `$workers.outcome` (`ok`, `exception`, `exceededCpu`, `exceededMemory`).
  - Os logs nunca têm e-mail, cookie, token, endpoint ou chave de push, corpo de requisição ou query string.
- **Ao vivo:**
  ```bash
  pnpm --filter api exec wrangler tail habits-api --format pretty
  pnpm --filter api exec wrangler tail habits-api --status error   # só falhas
  ```
  O `tail` mostra os headers das requisições (cookies inclusive): não cole a saída em lugar público.
- **Limite de CPU (erro 1102):** o cliente recebe "Worker exceeded resource limits", e o log mostra `outcome: exceededCpu`.
- **Cron:** nos Logs, filtre `$workers.eventType = scheduled`. Uma execução boa loga `cron_reminders` com as contagens; uma falha loga `cron_failed` e fica com `outcome: exception`.

### Medir o tempo de login (CPU)

O hash de senha é propositalmente leve (scrypt N=2048, ver Decisions no `CLAUDE.md`) para caber nos 10 ms de CPU do plano Free. Logins e sessões passam disso com frequência, sobretudo em isolates frios; a Cloudflare tolera picos, mas o risco existe.

1. Num terminal:
   ```bash
   pnpm --filter api exec wrangler tail habits-api --format json > tail.json
   ```
2. Faça uns 10 logins (web ou app) e use o app um pouco. Depois Ctrl+C.
3. Gere o relatório:
   ```bash
   pnpm --filter api cpu-report ../../tail.json
   ```
   Ele mostra, por rota, n, p50, p95 e máximo de `cpuTime`, quantas passaram de 10 ms e os `outcome`.
4. Apague o `tail.json` (tem headers e cookies; o `.gitignore` já o ignora).

**Se aparecer `exceededCpu` ou 1102:**

1. Criar o Better Auth uma vez por isolate em vez de por requisição (`createAuth` em `apps/api/src/auth/auth.ts`). Isso tira o custo fixo de cada rota autenticada.
2. Baixar `N` em `CURRENT_PARAMS` (`apps/api/src/auth/password.ts`). O formato é versionado, então os hashes antigos continuam válidos, mas a redução só vale para senhas novas ou trocadas.
3. Workers Paid (US$ 5/mês, 30 s de CPU por requisição): a solução definitiva. Aí suba o scrypt para o padrão.

### Custos e alertas

No plano Free do Workers, um loop não gera fatura: Workers e D1 cortam ao atingir o limite diário (as requisições falham até 00:00 UTC). O único produto com cobrança por uso é o R2, e a API não tem acesso a ele: só os workflows escrevem lá (um backup por deploy e um por semana).

Para conferir:

- **Billing → Subscriptions:** Workers deve estar em **Free**. "R2 Paid" é a assinatura sem mensalidade do R2.
- **Billing → Billable Usage:** deve ficar em US$ 0.
- **Workers & Pages → `habits-api` → Metrics** e **D1 → `habits` → Metrics:** requests e linhas lidas e escritas por dia. Milhares de requests por hora indicam um loop.
- **R2 → Overview:** armazenamento e operações do mês (KB ou poucos MB, dezenas de operações).

Alertas gratuitos:

- **E-mail do GitHub** quando o `deploy` ou o `backup` falham (Settings → Notifications → Actions). O backup checa o `/health` toda semana, então funciona como um monitor semanal simples.
- **E-mail do EAS** quando um build falha.
- **Dependabot alerts** para vulnerabilidades.

Fica de fora: alerta em tempo real de erros 5xx, CPU ou cron, e monitoramento de uptime frequente. Para isso, olhe os Workers Logs (3 dias de retenção) uma vez por semana ou depois de cada deploy.

### Checklist pós-deploy

Depois do primeiro deploy pelo CI (e de mudanças grandes). Os comandos são para o Git Bash; no PowerShell use `curl.exe`.

```bash
U=<ORIGEM>
curl -s $U/api/v1/health; echo                                     # {"status":"ok","version":"2.1.0"}
curl -s -o /dev/null -w "docs: %{http_code}\n" $U/api/v1/docs       # 404
curl -sI $U/ | grep -iE "content-security|x-content|referrer|x-frame|permissions|cache-control"
curl -sI $U/sw.js | grep -i cache-control                           # no-cache
curl -si $U/api/v1/habits | grep -iE "^HTTP|cache-control"          # 401 + no-store
```

No app e no navegador:

1. **Login** no web e no app. No DevTools → Console, nenhum erro de CSP.
2. **Cadastro fechado:** um sign-up com outro e-mail → `403 SIGNUP_DISABLED`.
3. **Marcar e desmarcar** um hábito hoje. O heatmap atualiza (web e app).
4. **PWA:** instalar pelo navegador e abrir.
5. **Atualização do service worker:** depois de um novo deploy do web, abrir o PWA mostra o "Atualizar", e tocar recarrega na versão nova.
6. **Push de teste:** Ajustes → Lembretes → enviar teste, no web e no app.
7. **Cron real:** defina o horário do lembrete alguns minutos à frente com um hábito pendente. Em até 15 minutos chega o lembrete, e os Logs mostram `cron_reminders` com `usersNotified: 1`.
8. **OTA:** uma mudança só de JS, push e aprovação; abra e feche o app duas vezes e a mudança aparece.
9. **Offline e sync:** modo avião, marcar hábitos ("Offline · N pendentes"), voltar a rede ("Sincronizado às HH:MM") e conferir no web.
10. **Tempo de login:** [Medir o tempo de login](#medir-o-tempo-de-login-cpu).
11. **Backup:** rode o `backup` à mão (`gh workflow run backup`) e confira o objeto em `habits-backups/weekly/`.

### Problemas comuns

| Sintoma                                                                    | Causa provável                                                                                                        | O que fazer                                                                                                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Worker exceeded resource limits" / log `exceededCpu` (1102)               | CPU acima do limite do Free                                                                                           | [Medir o tempo de login](#medir-o-tempo-de-login-cpu) e as três opções.                                                                                   |
| `403 SIGNUP_DISABLED`                                                      | Já existe um usuário (é o esperado)                                                                                   | Entre com a sua conta. Recriar o dono exige apagar o usuário no D1.                                                                                       |
| Login no web não "pega" (volta para o login)                               | `BETTER_AUTH_URL` diferente da origem                                                                                 | `BETTER_AUTH_URL` = origem exata, sem barra final. Limpe os cookies do site.                                                                              |
| PWA preso numa versão antiga                                               | Aba antiga aberta, ou o "Atualizar" ignorado                                                                          | Feche todas as abas do app, ou DevTools → Application → Service Workers → Update.                                                                         |
| OTA não chega                                                              | Runtime diferente (mudou algo nativo), canal errado, ou o app só aplica na segunda abertura                           | Feche e abra duas vezes. Compare o runtime do build e do update em expo.dev. Se for nativo, faça um build novo.                                           |
| `eas update` falha com `Cannot find module` de Babel                       | Plugin usado por um preset sem estar declarado (funciona local por hoisting do pnpm)                                  | Declare o pacote em `apps/mobile/package.json`. O passo "Bundle the mobile app" do `checks` pega isso no PR.                                              |
| EAS Build falha em "Configure expo-updates" com `Runtime version mismatch` | O build foi disparado do Windows: o pnpm nomeia as pastas do `node_modules/.pnpm` de outro jeito e o fingerprint muda | Dispare pelo workflow `mobile-build` (Linux) ou pelo WSL.                                                                                                 |
| Deploy falhou em "Apply D1 migrations"                                     | Erro de SQL ou limite do D1                                                                                           | A migration que falhou não fica registrada. Corrija com uma migration nova. Se algo ficou pela metade, use o Time Travel para o instante antes do deploy. |
| Deploy falhou depois das migrations                                        | Erro de build ou de token                                                                                             | O schema novo é aditivo e o código antigo segue no ar. Corrija e faça push.                                                                               |
| `Authentication error [code: 10000]` no CI                                 | Falta uma permissão no token                                                                                          | Veja [Pré-requisitos](#pré-requisitos).                                                                                                                   |
| D1 com "daily limits exceeded"                                             | 5 M linhas lidas ou 100 mil escritas no dia (Free)                                                                    | Volta às 00:00 UTC. Se for recorrente, investigue nos Logs.                                                                                               |
| Lembrete "pendente" de um hábito já marcado no celular                     | Conclusão offline ainda não sincronizada                                                                              | Conhecido e aceito (ver "Push notifications" no `CLAUDE.md`).                                                                                             |

### Atualizações de dependências

- **Actions:** o Dependabot abre PRs semanais (agrupados), e o CI valida.
- **Pacotes npm:** o Dependabot não suporta pnpm 12 (só até a v10). O CI roda `pnpm audit --prod` em cada PR e toda segunda-feira, só como aviso. Para atualizar: `pnpm outdated -r` mostra o que está velho e `pnpm update -r <pacote>@latest` atualiza (no mobile, use `pnpm exec expo install --fix` para alinhar com o SDK); depois typecheck, lint e testes.

## Limites dos planos gratuitos

Conferidos em 2026-10-11:

| Serviço           | Limite                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers Free      | 100 mil requests/dia; 10 ms de CPU por request e por cron; 50 subrequests por invocação; 5 Cron Triggers por conta (usamos 1).             |
| D1 Free           | 10 bancos; 500 MB por banco; 5 GB por conta; 5 M linhas lidas e 100 mil escritas por dia; 50 queries por invocação; Time Travel de 7 dias. |
| Workers Logs Free | 200 mil eventos/dia, retenção de 3 dias.                                                                                                   |
| R2                | 10 GB-mês; 1 M operações classe A e 10 M classe B por mês; sem custo de saída. Acima disso, cobrado.                                       |
| EAS Free          | 15 builds Android por mês (fila de baixa prioridade); EAS Update até 1.000 usuários ativos por mês.                                        |
| GitHub Actions    | Minutos ilimitados em repositório público.                                                                                                 |
