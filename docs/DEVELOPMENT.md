# Desenvolvimento

Como preparar o ambiente, rodar, testar e contribuir. A arquitetura está em [ARCHITECTURE.md](ARCHITECTURE.md); deploy e operação, em [DEPLOYMENT.md](DEPLOYMENT.md).

## Sumário

- [Requisitos](#requisitos)
- [Primeira execução](#primeira-execução)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Comandos](#comandos)
- [Testes e qualidade](#testes-e-qualidade)
- [App mobile (development build)](#app-mobile-development-build)
- [Convenções](#convenções)
- [Git e versionamento](#git-e-versionamento)
- [Skills do Claude Code](#skills-do-claude-code)

## Requisitos

- Node 24 (`.node-version`; mínimo 22.13 pelo `engines`, e 22.18 para os scripts `.ts` rodados com type stripping).
- pnpm 12 (fixado em `packageManager`; `corepack enable` resolve).
- Para o mobile: um aparelho Android com um development build (ver abaixo). JDK 17 e Android SDK 36 só para build local.

## Primeira execução

Comandos a partir da raiz do repositório:

```bash
pnpm install --frozen-lockfile
cp apps/api/.dev.vars.example apps/api/.dev.vars    # preencha BETTER_AUTH_SECRET (o comando está no arquivo)
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env        # só para o mobile
pnpm --filter api db:migrate:local
pnpm --filter api db:seed:local                     # cria dev@habits.local / habits-dev-password
pnpm dev                                            # API em http://localhost:8787 e web em http://localhost:5173
```

O seed é determinístico para uma data de referência (padrão 2026-10-09; `--today AAAA-MM-DD` muda) e **substitui** o usuário dev e todos os dados dele a cada execução.

## Variáveis de ambiente

Só nomes; os valores locais ficam em arquivos ignorados pelo git. Os de produção estão em [DEPLOYMENT.md](DEPLOYMENT.md#segredos-e-variáveis).

| Arquivo (copiado do `.example`) | Variáveis                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/.dev.vars`            | `ENVIRONMENT=development`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` (dev 5173 e preview 4173), `ALLOW_SIGNUP`, `OWNER_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `EXPO_ACCESS_TOKEN` (opcional) |
| `apps/web/.env`                 | `VITE_API_URL=/api`, `API_PROXY_TARGET` (para onde o Vite repassa `/api/*`, sem o prefixo), `VITE_VAPID_PUBLIC_KEY` (vazio = notificações indisponíveis)                                                                                 |
| `apps/mobile/.env`              | `EXPO_PUBLIC_API_URL` (base da API, sem `/v1` nem barra final; lida pelo Metro, então mudar pede reiniciar o Metro, não um build novo)                                                                                                   |

`apps/web/.env.production` é versionado (só valores públicos: `VITE_API_URL` e a chave pública VAPID).

## Comandos

Rode da raiz com `pnpm --filter <nome>`. Comandos remotos (deploy, migrations remotas, segredos, backups, EAS) estão em [DEPLOYMENT.md](DEPLOYMENT.md) e nunca rodam sem o dono.

### Monorepo

```bash
pnpm dev               # turbo: api + web
pnpm typecheck         # tsc em todos os pacotes (o build:types da api roda antes)
pnpm lint              # eslint (config na raiz; web e mobile estendem)
pnpm test              # vitest em todos os pacotes
pnpm format            # prettier --write . (format:check para conferir)
```

### API (`apps/api`)

```bash
pnpm --filter api dev                  # wrangler dev em :8787 (GET /v1/health; docs em /v1/docs)
pnpm --filter api cf-typegen           # regenera src/worker-configuration.d.ts depois de mexer no wrangler.jsonc
pnpm --filter api db:generate          # drizzle-kit: migration SQL a partir do schema.ts
pnpm --filter api db:migrate:local     # aplica as migrations no D1 local
pnpm --filter api db:seed:local        # dados de desenvolvimento (--today AAAA-MM-DD)
pnpm --filter api db:backup:local      # export do D1 local em backups/ (ignorado)
pnpm --filter api db:restore:prepare <dump.sql>   # reordena um export para restaurar num D1 vazio
pnpm --filter api exec wrangler d1 execute DB --local --file scripts/row-counts.sql   # contagens e triggers
pnpm --filter api migrations:check     # falha com DROP / RENAME / DELETE sem o marcador de aprovação
pnpm --filter api auth:generate        # regenera src/db/auth-schema.ts pela CLI do Better Auth; depois db:generate
pnpm --filter api build:types          # emite AppType (dist/types) para o @habits/api-client
pnpm --filter api vapid:generate       # imprime um par VAPID novo; não grava nada
pnpm --filter api cpu-report <tail.json>   # CPU por rota a partir de `wrangler tail --format json`
pnpm --filter api exec wrangler deploy --dry-run --outdir <pasta>   # empacota sem publicar
```

Rodar o cron uma vez sob o `wrangler dev` (`time` = o instante simulado, em ms):

```bash
curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/15+*+*+*+*&time=<ms>"
```

### Web (`apps/web`)

```bash
pnpm --filter web dev          # vite em :5173 (porta fixa); repassa /api/* para API_PROXY_TARGET
pnpm --filter web build        # typecheck (app, node, service worker, worker) + vite build com o service worker
pnpm --filter web preview      # serve dist/ em :4173: o único jeito de testar o service worker e instalar o PWA localmente
pnpm --filter web test         # vitest: app (jsdom + Testing Library) e gateway (node)
pnpm --filter web cf-typegen   # regenera worker/worker-configuration.d.ts
```

### Mobile (`apps/mobile`)

```bash
pnpm --filter mobile start     # expo start para o development build (não o Expo Go)
pnpm --filter mobile test      # vitest: lógica pura, banco local e motor de sync em node:sqlite
pnpm --filter mobile exec expo run:android   # build local alternativo (JDK 17 + Android SDK 36)
cd apps/mobile && pnpm exec expo install <pacote>   # adicionar pacote nativo/Expo na versão do SDK
```

### Pacotes

```bash
pnpm --filter @habits/core test                    # um pacote (também contracts, design-tokens, api-client)
pnpm --filter @habits/design-tokens generate       # reescreve src/generated/theme.css depois de mexer em tokens.ts
pnpm --filter @habits/design-tokens brand          # regera ícones, splash e ícones da web (PNG versionados; nativo pede build novo)
```

Notas:

- Os pacotes internos exportam TypeScript direto. A exceção é o tipo RPC da API (`api/app`), resolvido para declarações em `apps/api/dist/types` (ignorado): rode `pnpm typecheck` da raiz, ou `pnpm --filter api build:types` antes de checar um cliente sozinho.
- Os scripts Node em `.ts` (seed, `generate`) usam o type stripping do Node: só sintaxe apagável (sem `enum`, sem parameter properties).
- Pacotes com scripts de instalação permitidos ficam em `allowBuilds` no `pnpm-workspace.yaml`.

## Testes e qualidade

| Pacote                   | Como roda                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`          | Vitest puro: agendas, sequências, bordas de fuso e de ano, regras de sync.                                                                          |
| `packages/contracts`     | Vitest dos schemas.                                                                                                                                 |
| `packages/design-tokens` | Paridade web/mobile, contraste AA, ícones.                                                                                                          |
| `apps/api`               | Dentro do workerd pelo `@cloudflare/vitest-plugin`, com D1 de teste migrado antes de cada arquivo e serviços de push falsos.                        |
| `apps/web`               | Projeto `app` (jsdom + Testing Library, roteador real com API falsa e relógio fixo) e projeto `worker` (node).                                      |
| `apps/mobile`            | Só módulos sem React Native (sem testes de componente); o banco local e o motor de sync rodam o SQL real em `node:sqlite` contra um servidor falso. |

O CI (`checks.yml`) roda: instalação congelada, `format:check`, `lint`, `typecheck`, `test`, `migrations:check`, build da web, `expo export` do mobile e `wrangler deploy --dry-run` dos dois Workers. Antes de declarar uma tarefa pronta, rode `pnpm typecheck && pnpm test` (e `pnpm lint`) nos pacotes tocados.

## App mobile (development build)

O app precisa de um development build (não roda no Expo Go): armazenamento seguro, háptico, push, SQLite e tarefas em segundo plano são módulos nativos.

1. Copie `apps/mobile/.env.example` para `.env` e escolha a API.
2. Instale o APK de desenvolvimento uma vez (e de novo só ao adicionar dependência nativa ou mudar um config plugin):
   - **EAS Build (recomendado):** `gh workflow run mobile-build -f profile=development` (roda no Linux). Não use `eas build` a partir do Windows: o fingerprint calculado lá difere e o build falha com "Runtime version mismatch". Do Linux, macOS ou WSL: `cd apps/mobile && pnpm dlx eas-cli@latest build --profile development --platform android`.
   - **Local:** `pnpm --filter mobile exec expo run:android` (JDK 17 em `JAVA_HOME`, Android SDK Platform 36, `platform-tools` no `PATH`, caminhos longos habilitados no Windows). `android/` é gerado e ignorado: nunca edite.
3. `pnpm --filter mobile start` e abra o app no aparelho.

Apontar para uma API:

- **Local por USB (recomendado, adb opcional):** com a depuração USB ativa, `adb reverse tcp:8787 tcp:8787` e `adb reverse tcp:8081 tcp:8081` (Metro), e `EXPO_PUBLIC_API_URL=http://localhost:8787`. Entre com a conta do seed.
- **Local por Wi-Fi:** `pnpm --filter api dev -- --ip 0.0.0.0` e `EXPO_PUBLIC_API_URL=http://<IP do PC na rede>:8787` (builds de debug aceitam HTTP).
- **Produção:** `EXPO_PUBLIC_API_URL=<ORIGEM>/api` (o gateway público; a API não tem URL própria).

Push no Android precisa de Firebase: um projeto com um app Android do mesmo package, `google-services.json` em `apps/mobile/` (identificadores públicos, versionado) e a chave da conta de serviço FCM V1 enviada com `eas credentials` (segredo, nunca versionado). Os dois passos exigem um development build novo. Sem Firebase, ativar lembretes informa o aparelho como indisponível; o resto funciona.

## Convenções

- TypeScript `strict` em tudo; nada de `any` sem um comentário explicando.
- Validação na borda com Zod do `packages/contracts`; tipos inferidos, nunca duplicados à mão.
- Lógica pura em `packages/core`, com testes Vitest.
- Dependência nova só com justificativa e conferindo o runtime alvo (workerd para a API, Hermes para o mobile, navegadores para a web). No mobile, pacotes nativos com `expo install`.
- Formatação compartilhada: `.editorconfig` (tabs com largura 2, LF; espaços em YAML e Markdown) e Prettier (`useTabs`, aspas duplas, ponto e vírgula, `trailingComma: "es5"`; override com espaços para `*.md`, `*.yml` e `*.yaml`). Em caso de conflito vale o Prettier.
- ESLint: config flat na raiz (`typescript-eslint`, `eslint-config-prettier`); web e mobile acrescentam as regras de React.
- Texto de interface em pt-BR (dayjs `pt-br`); código, identificadores, commits e docs técnicos em inglês. README e `docs/` em pt-BR.
- Cores só por tokens (`packages/design-tokens` e [DESIGN.md](../DESIGN.md)).

## Git e versionamento

- **Commits semânticos** (Conventional Commits) em inglês: `tipo: resumo no imperativo`, tipo em minúsculas, **sem escopo entre parênteses**, sem ponto final, até ~72 caracteres. Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`. Mudança incompatível: `feat!:` ou rodapé `BREAKING CHANGE:`.
- Sem trailers de coautoria nem linhas de atribuição.
- **Versão única:** `apps/api`, `apps/web` e `apps/mobile` (mais `expo.version` no `app.json`) têm sempre a mesma versão. Os `packages/*` são privados e têm a sua.
- **SemVer:** feature = minor, correção = patch, mudança incompatível = major, na mesma mudança. Documentação e tarefas de manutenção não sobem versão.
- **CHANGELOG:** toda mudança visível entra em `[Unreleased]` no [CHANGELOG.md](../CHANGELOG.md); a última versão publicada é a do CHANGELOG.
- **Mobile:** a política do `runtimeVersion` é `fingerprint`, e `fingerprint.config.js` tira `version`/`versionCode` do hash: subir a versão sozinho não corta OTAs (mudança nativa corta). O `versionCode` nunca é editado à mão (`appVersionSource: remote` + `autoIncrement`).
- As tags (`vX.Y.Z`) são criadas pelo dono.

## Skills do Claude Code

O repositório traz skills em `.claude/skills/` (arquivos reais, nunca links simbólicos). As de terceiros ficam fixadas no conteúdo versionado; as origens e os hashes estão no `skills-lock.json`.

| Skill                        | Origem                                                 | Licença    | Uso                                               |
| ---------------------------- | ------------------------------------------------------ | ---------- | ------------------------------------------------- |
| `release-ops`                | própria                                                | do projeto | Decisões de CI/CD e operação                      |
| `expo-animation`             | `expo/skills`                                          | MIT        | Animações e gestos no mobile                      |
| `expo-native-ui`             | `expo/skills`                                          | MIT        | Telas com aparência nativa                        |
| `vercel-react-native-skills` | `vercel-labs/agent-skills`                             | MIT        | Boas práticas de React Native                     |
| `web-design-guidelines`      | `vercel-labs/agent-skills` (com `guidelines.md` local) | MIT        | Revisão de UI da web                              |
| `frontend-design`            | `anthropics/claude-plugins-official`                   | Apache-2.0 | Direção visual                                    |
| `playwright-cli`             | `@playwright/cli` 0.1.22 (Microsoft)                   | Apache-2.0 | Automação do navegador (checagens visuais da web) |

Para atualizar ou reinstalar (sempre com `--copy`, para não criar links simbólicos), revise o diff antes de versionar:

```bash
npx skills add expo/skills --skill expo-animation -a claude-code --copy
npx skills add expo/skills --skill expo-native-ui -a claude-code --copy
npx skills add vercel-labs/agent-skills --skill react-native-skills -a claude-code --copy
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -a claude-code --copy
npx skills add anthropics/claude-plugins-official --skill frontend-design -a claude-code --copy
npm install -g @playwright/cli@0.1.22 && playwright-cli install --skills
```

A saída do `playwright-cli` (capturas e estado de sessão) vai para `.playwright-cli/`, que é ignorado pelo git. As permissões do projeto para ele estão em `.claude/settings.json`.
