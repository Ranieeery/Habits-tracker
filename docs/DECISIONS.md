# Decisões

Registro curto das decisões do dono e das escolhas técnicas, com o motivo e o efeito. Cada entrada traz a versão em que entrou; o que mudou em cada versão está no [CHANGELOG](../CHANGELOG.md), e as regras vigentes em [ARCHITECTURE.md](ARCHITECTURE.md). Uma decisão posterior que substitui outra diz isso explicitamente.

## Sumário

- Fundamentos: [D1](#d1-reescrita-em-monorepo-sem-importar-dados-do-legado) · [D2](#d2-datas-de-calendário-como-texto-e-fuso-do-usuário) · [D3](#d3-instantes-como-inteiros-em-ms) · [D4](#d4-cloudflare-workers-d1-e-dois-workers-na-mesma-origem) · [D5](#d5-better-auth-dono-único-e-hash-de-senha-leve) · [D6](#d6-push-sem-biblioteca) · [D7](#d7-sync-próprio-com-espelho-e-outbox)
- Ferramentas: [D8](#d8-versões-fixadas-de-ferramentas) · [D9](#d9-nativewind-4-com-tailwind-3) · [D10](#d10-tokens-em-hex-e-um-só-conjunto-de-cores) · [D11](#d11-cicd-e-operação) · [D12](#d12-builds-e-ota-do-mobile)
- Clientes: [D13](#d13-cliente-web) · [D14](#d14-cliente-mobile)
- Funcionalidades: [D15](#d15-repetições-flexíveis-e-resumo-da-manhã) · [D16](#d16-editar-dias-passados) · [D17](#d17-identidade-visual-night) · [D18](#d18-ordem-dos-hábitos) · [D19](#d19-navegação-do-mobile-em-abas) · [D20](#d20-histórico-do-mobile-com-insights) · [D21](#d21-hábitos-atrasados) · [D22](#d22-ícone-e-abertura) · [D23](#d23-consultar-um-dia-segurando-o-quadrado) · [D24](#d24-apagar-hábitos) · [D25](#d25-descrição-de-hábito) · [D26](#d26-tarefas-com-prazo) · [D27](#d27-prévia-dos-próximos-7-dias) · [D28](#d28-menu-de-ações-do-hábito) · [D29](#d29-adiar-uma-ocorrência) · [D30](#d30-confirmar-antes-de-descartar)

## Fundamentos

### D1. Reescrita em monorepo, sem importar dados do legado

- **Contexto:** o app 1.x eram três projetos npm independentes (Fastify + Prisma/SQLite, React + Vite, Expo), com datas guardadas em epoch no fuso do servidor, URLs e chaves VAPID fixas no código.
- **Decisão (2.0.0):** reescrever como monorepo pnpm + Turborepo. O `dev.db` do legado era só teste: não há importação nem script `import-legacy`; existe um seed determinístico do D1 local (`db:seed:local`) cobrindo todos os níveis do heatmap, sequências e a virada de ano. O código antigo fica só no histórico, como referência de comportamento (tag `v2.0.0`, pasta `legacy/`, e tag `legacy-1.x`), nunca restaurado nem importado.
- **Consequência:** sem tabelas `Day`/`DayHabit`: uma única tabela `completions`. Os bugs do legado não devem ser copiados.

### D2. Datas de calendário como texto e fuso do usuário

- **Contexto:** o legado errava dias por causa de fuso e de `strftime` no SQL.
- **Decisão (2.0.0):** datas de calendário são `YYYY-MM-DD` locais; o cliente envia a data explicitamente; todo "hoje" do servidor vem de `todayIn(timezone, now)` com o fuso de `user_settings`. O dia da semana é calculado no `core`.
- **Consequência:** a regra "possível em D" existe uma vez só (`core`) e serve API, web e mobile. O `core` nunca lê o relógio.

### D3. Instantes como inteiros em ms

- **Decisão (2.0.0):** `created_at`, `updated_at`, `deleted_at`, `completed_at`, `archived_at` são inteiros UTC em ms lidos como `number` (`integer({ mode: "number" })`, não `timestamp_ms`), para as linhas baterem com os contratos sem conversão.
- **Exceção:** as tabelas do Better Auth mantêm `timestamp_ms` (`Date`), porque a biblioteca é dona delas.

### D4. Cloudflare Workers, D1 e dois Workers na mesma origem

- **Decisão (2.0.0):** API em Hono num Worker privado `habits-api` (sem URL pública, `workers_dev: false`) e um Worker público `habits` que serve o PWA como Static Assets e repassa `/api/*` pelo service binding (`run_worker_first`). Origem pública `https://habits.<subdomínio>.workers.dev`.
- **Por quê:** cookie de sessão na mesma origem (sem CORS), API sem URL exposta, prefixo `/api` igual ao proxy do Vite, e os testes e o `wrangler dev` da API não dependem do build da web. Um Worker só pouparia um passo de deploy mas acoplaria os dois builds.
- **Consequência:** ordem de deploy: migrations, API, web. Cabe nos planos gratuitos (Workers Free: 10 ms de CPU, 50 subrequests, 5 cron triggers).

### D5. Better Auth, dono único e hash de senha leve

- **Decisão (2.0.0):** Better Auth 1.7 em `/v1/auth` com os plugins `bearer()` e `expo()`; cadastro aberto só enquanto não existe usuário (opcionalmente só para `OWNER_EMAIL`). Configuração por variáveis (`ENVIRONMENT`, `ALLOW_SIGNUP`, `TRUSTED_ORIGINS`) e segredos (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OWNER_EMAIL`).
- **Hash:** scrypt próprio (`apps/api/src/auth/password.ts`, `node:crypto`) com N=2048, r=8, p=1 (~4 ms no workerd local contra ~70 ms do padrão do Better Auth), formato versionado `$scrypt$v=1$…`, comparação em tempo constante e re-hash no login quando os parâmetros guardados são mais fracos que `CURRENT_PARAMS`. Compensado por senha de 16+ caracteres, cadastro fechado e rate limit.
- **Medido em produção (2026-10-10, `wrangler tail`, `cpuTime` em ms):** cadastro 76, login 25, get-session 13-51, settings/summary 12, habits 5-6, 401 sem sessão 3-44, health 1-12. Tudo `outcome: ok`, mas muitas requisições passam de 10 ms, sobretudo em isolates frios e na montagem do Better Auth.
- **Consequência:** se aparecer `exceededCpu`, ver [ROADMAP.md](ROADMAP.md) e [DEPLOYMENT.md](DEPLOYMENT.md#medir-o-tempo-de-login-cpu). Ao migrar para o Workers Paid, subir o scrypt para o padrão pelo re-hash versionado.

### D6. Push sem biblioteca

- **Contexto:** `@pushforge/builder` usa o rascunho `aesgcm` antigo; `web-push-neo` foi publicado uma vez (MPL-2.0); `web-push` precisa de `createECDH` do Node; `expo-server-sdk` precisa de Node/undici.
- **Decisão (2.0.0):** Web Push próprio (~200 linhas, RFC 8291/8292) e cliente Expo com `fetch` puro, cobertos pelo vetor do RFC e por serviços falsos nos testes. `fetch` e relógio injetados (`createApp({ now, fetch })`, `runScheduled({ env, now, fetch })`). Cron a cada 15 min (1 das 5 triggers do Free).
- **Consequência:** um lembrete chega até 15 min depois do horário. Teste de push: 1 por minuto por usuário. Segredos: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (sem eles a web é pulada) e `EXPO_ACCESS_TOKEN` opcional. Android precisa de Firebase: `google-services.json` público, versionado; a chave da conta de serviço FCM V1 só no EAS.

### D7. Sync próprio com espelho e outbox

- **Decisão (2.0.0), mudanças sobre o desenho inicial:**
  1. o cursor é um `server_seq` atribuído por triggers, não `updated_at` (relógios de aparelho e escritas no mesmo milissegundo inviabilizavam ordenar por ele);
  2. vence a última escrita **na ordem de chegada**, com o relógio do servidor;
  3. `habit.upsert` (registro inteiro) virou `habit.create` + `habit.update` (por campo, como o REST);
  4. limites menores para o D1 Free (`SYNC_PUSH_MAX_MUTATIONS` 500 → 100, `limit` do pull 1000 → 500);
  5. o app mantém um espelho do servidor mais um outbox reaplicado na leitura, em vez de gravar linhas locais e outbox juntos: uma mudança rejeitada se desfaz sozinha, sem um refetch por registro que o protocolo não tem.
- **Sem CRDT nem motor de terceiros** enquanto o protocolo simples bastar. `@react-native-community/netinfo` não foi adicionado: o `expo-network` já dá conectividade.
- **Versões nativas:** expo-sqlite (`withExclusiveTransactionAsync`; migrations por `PRAGMA user_version`), expo-background-task + expo-task-manager (`expo-background-fetch` está obsoleto), expo-crypto (bytes aleatórios: o Hermes não tem `crypto.getRandomValues`). Todos exigem development build novo.
- **Risco residual:** uma mutation aplicada cuja resposta se perdeu e que só é reenviada depois de 90 dias seria aplicada de novo.

## Ferramentas

### D8. Versões fixadas de ferramentas

- TypeScript 6.0.x em todo o workspace (o typescript-eslint exige `<6.1`); não ir para o TS 7 antes dele.
- Vitest 4.x; os testes de Workers usam `@cloudflare/vitest-plugin` (sucessor do `@cloudflare/vitest-pool-workers`). Se uma versão futura quebrar, fixar o Vitest compatível só em `apps/api`.
- Versões compartilhadas (TypeScript, Vitest, React, Zod) no `catalog:` do `pnpm-workspace.yaml`.
- Base de referência (2026-10-09): pnpm 12.10, Turborepo 2.11, Expo SDK 57 (React 19.2.3 na web e no mobile), Zod 4, Hono 4.13, @hono/zod-openapi 1.6, Drizzle ORM 0.45 / drizzle-kit 0.31, Better Auth 1.7, Wrangler 4.

### D9. NativeWind 4 com Tailwind 3

- **Decisão:** NativeWind v4 estável (Tailwind v3) no mobile; migrar para a v5 quando sair do RC. A web usa Tailwind v4.
- **Consequência:** `react-native-css-interop` é dependência direta do mobile (instalações isoladas do pnpm), na mesma versão que o `nativewind` fixa, e `@babel/plugin-transform-react-jsx` é devDependency (o preset o carrega pelo nome sem declarar). O `checks.yml` roda `expo export` para pegar esse tipo de quebra.

### D10. Tokens em hex e um só conjunto de cores

- **Decisão:** valores canônicos em hex em `packages/design-tokens`, gerando o tema do Tailwind v4 e o preset do Tailwind v3, idênticos (`presets-parity.test.ts`). No heatmap, mais feito = mais claro. Desde 2.6.0 só existe o conjunto `night` (a paleta antiga e seus nomes foram removidos); os nomes `night-*` ficam (renomear tocaria quase todo arquivo sem ganho para quem usa).
- **Consequência:** só tokens no código dos apps (testes de guarda nos dois); contraste AA verificado em `contrast.test.ts`. Tema claro fora do escopo até ser pedido.

### D11. CI/CD e operação

- **GitHub Actions:** `checks.yml` (reutilizável, sem segredos), `ci.yml` (PRs, semanal e manual; `pnpm audit --prod` só como aviso), `deploy.yml` (push na `main`, ambiente `production` **com aprovação**: backup, migrations, API, web, smoke test, OTA quando o app mudou; sem cancelar deploy em andamento), `backup.yml` (semanal, ambiente `backup` sem revisor e com token próprio), `mobile-build.yml` (manual).
- Actions fixadas por SHA; o Dependabot só cuida delas (ele suporta pnpm até a v10, e o repositório usa a 12). Wrangler pelo lockfile (`pnpm exec wrangler`), não pela `wrangler-action`: uma action de terceiros a menos e a mesma versão local. `eas-cli` fixado via `pnpm dlx`.
- **Tokens da Cloudflare:** deploy = Workers Scripts, D1 e Workers R2 Storage (Edit) + Account Settings (Read); backup = D1 e R2 (Edit) + Account Settings (Read).
- O `database_id` fica no `wrangler.jsonc`: é identificador, não segredo.
- **Backups** num bucket R2 privado (`habits-backups`, ciclo de vida de 90 dias, `pre-deploy/` e `weekly/`), nunca como artefato do GitHub (repositório público). Time Travel (7 dias no Free) para erros recentes. O export do D1 não restaura como sai; o `db:restore:prepare` reordena tabelas, linhas, índices e por último os triggers. Restauração em produção vai para um banco novo, trocando o binding.
- **Guarda de migrations:** `scripts/migration-guard.ts` bloqueia operações destrutivas sem `-- migration-guard: destructive-ok <motivo>`; `0002_user_fk.sql` (reconstrução de tabela) fica como exceção histórica, porque migrations aplicadas não se editam.
- **Cabeçalhos da web** (`public/_headers`): CSP com `script-src 'self'` e `style-src 'self' 'unsafe-inline'` (sonner e Radix injetam `<style>`), nosniff, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, Permissions-Policy negando tudo, `no-cache` no shell, service worker e manifest, `/assets/*` imutável.
- **Alertas sem custo:** e-mails do GitHub em deploy/backup falho (o backup checa o `/health` toda semana) e do EAS em build falho. Sem alerta em tempo real de 5xx, CPU ou cron.
- **Remoção do legado** (2026-10-11) num commit próprio; o histórico dele (incluindo uma chave VAPID antiga e o `dev.db`) continua público; nunca reutilizar chaves de lá.

### D12. Builds e OTA do mobile

- **Decisão:** `expo-updates` com `runtimeVersion` pela política `fingerprint` (um OTA nunca chega a um binário com código nativo diferente; `appVersion` dependeria de lembrar de subir a versão). Desde 2.1.0, `fingerprint.config.js` tira `version` e `versionCode` do hash, então subir a versão sozinho não corta OTAs.
- `eas.json`: `appVersionSource: remote`, perfis `development`/`preview`/`production` (APKs internos), canais `preview` e `production`, ambientes EAS de mesmo nome (`EXPO_PUBLIC_API_URL` em texto plano), `autoIncrement` em produção.
- **Builds e updates saem do Linux:** disparar do Windows falha com "Runtime version mismatch", porque o pnpm encurta os nomes de pasta do `node_modules/.pnpm` de outro jeito e os caminhos entram no hash.
- A keystore e a chave FCM V1 ficam no EAS; o dono guarda uma cópia da keystore fora do repositório (perdê-la obriga a desinstalar, o que apaga pendências).

## Clientes

### D13. Cliente web

- Rotas do TanStack Router em código (sem `routeTree.gen.ts`); tudo menos `/login` sob uma rota sem caminho com `beforeLoad` que redireciona para `/login?redirect=`, e todo 401 faz o mesmo. Só login: a API não expõe "o dono existe?".
- "Hoje" = `todayIn(settings.timezone, now())`, reavaliado no foco, em `visibilitychange` e a cada minuto; fuso do aparelho diferente mostra um aviso (atualizar ou manter, nunca em silêncio).
- shadcn/ui copiado e reestilizado só com tokens. Token `danger` para erros.
- PWA com `injectManifest`, precache só do shell, sem cache em tempo de execução, `/api/*` fora do fallback de navegação; atualização por "Atualizar" (SKIP_WAITING + reload), checada de hora em hora e em `visibilitychange`.
- Fonte de exibição auto-hospedada (subconjunto latino do Bricolage Grotesque, um `@font-face` em `styles.css`), na mesma origem (CSP inalterada). Inter continua como texto.
- Nunca `<input type="date">` (o navegador desenha na língua dele): seletor de datas próprio sobre o Popover do `radix-ui`.

### D14. Cliente mobile

- Android primeiro, development build (perfil `development`, APK interno; `expo run:android` como alternativa).
- Auth: cliente do Better Auth com `expoClient({ scheme: "habits", storagePrefix: "habits", storage: SecureStore })`; o cookie vai no cabeçalho `Cookie` com `credentials: "omit"`, o padrão do plugin, sem mudança no servidor.
- Início: splash até a sessão salva ser verificada e os dados da primeira tela assentarem (teto de 10 s); servidor inacessível com cookie salvo mantém o usuário logado. Todo 401 encerra a sessão; não há tela de cadastro.
- Dados: `src/data/repository.ts` é uma interface de domínio; as telas só usam hooks do TanStack Query, o que permitiu trocar a implementação remota por SQLite + outbox.
- Heatmap: `FlatList` horizontal de semanas com `getItemLayout`, semana atual perto da borda direita. Sem react-native-svg nem FlashList (53 colunas virtualizam bem).
- Teclado com `react-native-keyboard-controller` (Android edge-to-edge); ícones de `@expo/vector-icons`; datas com dayjs `pt-br`.
- Fonte de exibição em TTF estáticos carregados por JS (`DisplayText`, uma família por peso no Android); texto na fonte do sistema (Inter custaria ~0,7-1,4 MB). Embutir pelo config plugin mudaria o fingerprint.
- Gestos com Gesture Handler (o app é envolvido por `GestureHandlerRootView`); animações com Reanimated; nenhuma lib de folha inferior (`Modal` + `KeyboardAvoidingView`).

## Funcionalidades

### D15. Repetições flexíveis e resumo da manhã

- **Decisão (2.2.0):** tipos `interval`, `monthly_days`, `once` e `yearly` além de `weekdays`; resumo às 09:00; lembrete em passos de 15 min; opção de esconder nomes nas notificações.
- **Regras de borda escolhidas:** dia inexistente no mês cai no último dia; 29/02 cai em 28/02; um hábito conta no dia em que é possível **ou** concluído (nada some do mapa).
- **Apps antigos:** o pull do 2.1.0 validava a união de forma estrita e travava o sync com um tipo desconhecido. Daí o cabeçalho `X-Habits-Schedule-Version` (enviado pelo `@habits/api-client`) e o filtro na API.
- Migration `0005` aditiva, escrita à mão (o drizzle-kit gerou uma reconstrução); horários salvos arredondados **para baixo** no passo de 15 min (`roundDownToQuarter`). `last_digest_date` fica em `reminder_state`, fora de `user_settings`.
- Voltar a API para antes da 2.2.0 depois de criar hábitos dos tipos novos quebra a leitura (a 2.1.0 validava estrito).

### D16. Editar dias passados

- **Decisão (2.3.0):** até 30 dias (`BACKFILL_DAYS` 7 → 30, constante única), só depois de confirmar "Editar este dia"; "Desfazer" depois de toda mudança. Não ampliar a janela sem pedido.
- O desbloqueio fica só em memória (nunca banco, storage local ou URL): outro dia, sair da tela, recarregar ou reiniciar o app bloqueia de novo.
- No mobile, "Editar este dia" usa o rodapé fixo (alcance de uma mão, nunca cobre um hábito) e vira "Concluir edição".
- Token `warning` para avisos que não são erro.
- Sem mudança de dados: heatmap, proporções e sequências são calculados, nunca armazenados.

### D17. Identidade visual "night"

- **Decisão (2.4.0 a 2.6.0):** redesenho em quatro etapas (tela do heatmap na web, demais telas da web, tela principal do mobile, demais telas do mobile) com a identidade "noite calma" descrita no [DESIGN.md](../DESIGN.md).
- Tokens `night` com hue 293 em OKLCH convertidos para hex; níveis do heatmap em passos iguais de luminosidade; texto sobre o acento em `night-accent-on`.
- Números do resumo vêm do core (`overviewStats`); um dia "forte" é ≥ 80% do possível (escolha do dono).
- A grade da web é um ARIA grid com uma parada de Tab, um único tooltip e uma lente que desliza (as células pararam de crescer no hover: uma varredura rápida animava muitas ao mesmo tempo).
- Na tela de um dia, Esc volta e ←/→ andam entre dias.
- No mobile, células de 28 dp em passo de 32 com toque no espaço inteiro e realce ao pressionar (44 dp mostrava só 7 semanas); um elemento acessível por semana em vez de 365.

### D18. Ordem dos hábitos

- **Decisão (2.4.0):** `sort_key` fracionário (base 62, comparado como texto): mover grava uma única chave, uma escrita por movimento, sem conflito entre aparelhos; renumerar exigiria N escritas. Migration `0006` preenche em ordem de criação.
- **Custo medido:** a migration lê ~13 e grava ~5 linhas por hábito; mover toca uma linha; os testes garantem isso.
- No mobile as escritas locais passaram por uma fila (`data/local/serial.ts`): várias transações exclusivas em paralelo davam "database is locked".

### D19. Navegação do mobile em abas

- **Decisão (2.6.0, depois de revisão de UX no aparelho):** abas Hoje (abre primeiro) · Histórico · Hábitos, como na web; Ajustes atrás de uma engrenagem. A ação diária competia com o heatmap e pedia rolagem.
- A notificação ainda manda `/day/hoje`, que o app mapeia para a aba Hoje (payloads antigos continuam funcionando).
- Toasts ficam acima do rodapé fixo (medido em coordenadas de janela).

### D20. Histórico do mobile com insights

- **Decisão (2.7.0):** "sem poluir": filtro por hábito, tendência semanal, destaques (só com amostra mínima: 8 hábito-dias por dia da semana, 15 por mês) e uma linha por hábito, abaixo do heatmap, que continua sendo o destaque. Só no mobile.
- Seletores de "Dias do mês" e "Todo ano" no desenho do calendário (uma grade 3 × 4 de meses foi testada e trocada a pedido do dono).

### D21. Hábitos atrasados

- **Decisão (2.8.0):** atrasado aparece só em hoje, por até 15 dias, marcado com a data de hoje; a falha fica no dia original e nada conta em dobro. Sem "Dispensar" nesta versão.
- **Custo:** a consulta de conclusões só se alarga para 17 dias; ~0,5 ms de CPU por 100 hábitos de dia fixo por chamada.
- Apps antigos simplesmente não mostram atrasados (o campo `overdue` é aditivo).

### D22. Ícone e abertura

- **Decisão (2.9.0):** a marca do app (quatro quadrados do heatmap) em ícone, ícone adaptativo e temático, notificação, splash e ícones da web, gerados de `packages/design-tokens/src/brand.ts` com `sharp` (devDependency só do design-tokens, só Node). Os PNGs são versionados; ninguém os edita à mão.
- As cores nativas do `app.json` seguem `nightColors` (`app-config.test.ts`).
- O fingerprint mudou: exigiu build de produção novo.

### D23. Consultar um dia segurando o quadrado

- **Decisão (2.10.0):** segurar um quadrado do heatmap mostra um balão com data e resultado; arrastar troca o dia; soltar só fecha (escolha do dono). Toque rápido continua abrindo o dia.
- Sem háptico (o DESIGN.md reserva o háptico para marcar).

### D24. Apagar hábitos

- **Decisão (2.11.0):** exclusão lógica, só de hábitos arquivados (arquivar continua o padrão), com "Desfazer" por 6 s.
- Mutations novas `habit.delete`/`habit.restore`, não um campo no `habit.update`: uma API antiga rejeita um tipo desconhecido (a mudança vai para "Falhas"), mas ignoraria em silêncio um campo desconhecido.

### D25. Descrição de hábito

- **Decisão (2.12.0):** texto com um pouco de Markdown, parser próprio no core (sem dependência), nada renderizado como HTML, links só http(s). Primeira linha sob o nome e um ícone de nota com resumo; página do hábito com o texto inteiro.
- **2.14.1 (pedido do dono):** "Abrir descrição completa" sempre presente, mesmo com texto curto. Um único renderizador por app (`DescriptionText` com `variant`).
- **Fora do parser** (relatado, não mudado): listas numeradas e aninhadas, citações, código, títulos e `_itálico_` ficam literais.

### D26. Tarefas com prazo

- **Decisão (2.13.0):** um tipo de agenda `deadline` com um prazo único, em vez de uma tabela nova; só a primeira conclusão conta; atraso depois do prazo como os hábitos de dia fixo. Sem "Dispensar".
- Prazo até 2 anos à frente; um prazo vencido não muda (é preciso arquivar e criar outra tarefa).
- Versão de agenda 3: clientes antigos nunca veem as tarefas. Atualizar o celular antes de criar a primeira.

### D27. Prévia dos próximos 7 dias

- **Decisão (2.14.0):** ver o que está programado sem ficar preso a hoje. Células tracejadas sem pista de conteúdo; a grade continua até 31/12 e só entra em janeiro quando os 7 dias atravessam o ano (escolha do dono).
- O conteúdo é o próprio `dayView`, calculado só ao abrir o dia. Estatísticas nunca veem a prévia.

### D28. Menu de ações do hábito

- **Decisão (2.15.0):** "⋮", botão direito (web) e toque longo de 1 s (`LONG_PRESS_MS`, mobile) abrem Editar, Ver descrição e Arquivar/Desarquivar. Arquivar é imediato com "Desfazer" (escolha do dono, mantendo a regra de arquivamento existente). Lista declarativa no core.
- **2.16.1 (correção do dono):** o menu vale em toda tela de dia (inclusive as abertas pelo Histórico e as da prévia); só o painel "Hoje" da home da web fica sem.
- Na web, um toque longo não abre o menu (o Radix e o Chrome do Android o abririam).

### D29. Adiar uma ocorrência

- **Decisão (2.16.0):** adiar só datas únicas e dias do mês, até 2 vezes, até 90 dias, sem falha na data nominal.
- Uma linha por adiamento numa tabela só de acréscimos (`habit_reschedules`), com índice único parcial para manter o limite entre aparelhos.
- Cumprimento antecipado definido a pedido do dono: uma ocorrência tem no máximo um cumprimento e uma falha.
- Um hábito arquivado não pode ser adiado nem ter o adiamento desfeito, mas os adiamentos existentes continuam tirando O.
- Offline, as mutations levam `action_date` (o dia local em que o usuário agiu), aceita dentro da janela de 30 dias.
- **Fora do escopo:** "Dispensar". Uma linha de exceção por ocorrência facilita fazer depois.

### D30. Confirmar antes de descartar

- **Decisão (2.16.2):** fechar o formulário de hábito com campos diferentes dos que ele abriu pergunta "Descartar alterações?"; a comparação é pura no core (`habit-form-dirty.ts`). A linha de base nunca muda com o formulário aberto (um sync não o deixa "sujo").
- "Continuar editando" é o botão primário e começa focado; "Descartar" usa o tom de aviso, nunca vermelho.
- **Fora (decisão do dono):** sair ou recarregar a página web (`beforeunload` atrapalha o PWA e não tem estilo), o diálogo "Adiar" e outros formulários.
- No mobile, as telas usam o `usePreventRemove` da cópia do React Navigation dentro do `expo-router` (sem dependência nova); o gesto de voltar preditivo está desligado.
