# Roadmap

Projeto pessoal em uso, com desenvolvimento ocasional. Nada aqui tem prazo nem compromisso: são ideias e pendências registradas para não se perderem. O que já saiu está no [CHANGELOG](../CHANGELOG.md).

## Ideias

Sem ordem nem versão definida; a versão só é escolhida quando algo for feito.

- **Marcar hábitos pela notificação:** ações na notificação do mobile (categorias do `expo-notifications`), com um `categoryId` aditivo e os ids dos hábitos pendentes no payload do Expo. Perguntas em aberto: "Marcar todos" ou uma notificação por hábito? Ações em segundo plano precisam de um build novo ou de uma tarefa headless?
- **CPU da API no plano Free (10 ms):** criar o Better Auth uma vez por isolate em vez de por requisição (hoje `createAuth` é chamado em `apps/api/src/http/context.ts`), medir de novo com `wrangler tail habits-api --format json` e `pnpm --filter api cpu-report` ([procedimento](DEPLOYMENT.md#medir-o-tempo-de-login-cpu)). Se não bastar, migrar para o Workers Paid e subir o scrypt para o padrão ([D5](DECISIONS.md#d5-better-auth-dono-único-e-hash-de-senha-leve)).
- **NativeWind 5:** migrar quando sair do RC ([D9](DECISIONS.md#d9-nativewind-4-com-tailwind-3)).
- **TypeScript 7:** só quando o typescript-eslint suportar ([D8](DECISIONS.md#d8-versões-fixadas-de-ferramentas)).
- **Hermes e `Intl`:** confirmar no aparelho que `Intl.DateTimeFormat` com `timeZone` e `formatToParts` funciona no Hermes (usado por `localDateAt` no core); se faltar, criar um fallback no core.

## Pendências de operação

Valem mesmo sem desenvolvimento novo: parte do que já foi feito ainda não está em produção. Comandos em [DEPLOYMENT.md](DEPLOYMENT.md).

- Publicar as versões ainda não implantadas, na ordem do CHANGELOG. A 2.12.0 (`0007`) e a 2.16.0 (`0008`) têm migration: backup e `db:migrate:remote` antes da API. Atualizar o celular antes de criar a primeira tarefa com prazo (2.13.0) e antes de adiar (2.16.0).
- Builds de produção: a 2.9.0 mudou o fingerprint (ícones nativos) e precisa de um build novo (`gh workflow run mobile-build -f profile=production`); as versões seguintes vão por OTA para esse build.
- Configuração inicial do CI/CD, se ainda faltar: ambientes e segredos do GitHub, tokens da Cloudflare, bucket R2, variável do EAS e o [checklist pós-deploy](DEPLOYMENT.md#checklist-pós-deploy).
- Medir a CPU de login em produção de novo depois de mudanças na autenticação.
- Restringir a chave de API do Firebase (`google-services.json`) no Google Cloud Console ao package Android e ao SHA-1 do app.

Verificações manuais pendentes, por versão: [MANUAL-CHECKS.md](MANUAL-CHECKS.md).

## Limitações conhecidas

Aceitas por enquanto; cada uma vira ideia se incomodar.

- Sem "Dispensar" para atrasados e tarefas com prazo: os 15 dias ou arquivar são as saídas. Uma linha de exceção por ocorrência (como as de adiamento) facilitaria.
- Sem versionamento de agenda: editar a repetição recalcula os dias passados perdidos.
- Uma conclusão offline ainda não sincronizada pode gerar um lembrete desnecessário.
- Um hábito criado offline e ainda não sincronizado não entra no resumo da manhã.
- Parser de descrição sem listas numeradas e aninhadas, citações, código, títulos e `_itálico_`.
- No mobile, reordenar hábitos é por setas (arrastar fica para depois); a folha "Editar este dia" (`edit-day-sheet.tsx`) ainda desliza com "remover animações".
- Tema claro fora do escopo até ser pedido.
