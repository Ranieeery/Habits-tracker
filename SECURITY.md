# Política de segurança

## Versões suportadas

Só a versão mais recente (a primeira do [CHANGELOG](CHANGELOG.md)) recebe correções. API, web e mobile compartilham a mesma versão.

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use o **Private vulnerability reporting** do GitHub: aba **Security** do repositório → **Report a vulnerability**. Inclua o que é afetado (API, web, mobile, workflows), como reproduzir e o impacto esperado.

A resposta inicial vem em até 7 dias. Correções saem numa versão nova, com uma entrada `Security` no CHANGELOG.

## Escopo

Dentro do escopo:

- o código deste repositório (`apps/`, `packages/`, `.github/`);
- a configuração versionada (cabeçalhos da web, `wrangler.jsonc`, workflows).

Fora do escopo:

- instâncias de terceiros feitas a partir deste repositório;
- o histórico do app 1.x (tag `legacy-1.x`), que não roda mais. As chaves VAPID que aparecem nele são de teste e nunca devem ser reutilizadas;
- identificadores públicos por natureza: `database_id` do D1, `projectId` do EAS, package Android e `google-services.json` (o Firebase trata essa chave de API como pública; ela deve ser restrita no Google Cloud Console).

## Boas práticas de quem publica uma instância

Segredos só por `wrangler secret`, ambientes do GitHub e credenciais do EAS; nunca em arquivos versionados. O runbook em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) lista os nomes, como gerar e como fazer a rotação.
