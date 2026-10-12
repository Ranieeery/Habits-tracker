# DESIGN.md

Referência visual do Habits desde a 2.4.0. Os valores ficam só em `packages/design-tokens/src/tokens.ts` (fonte única); aqui só aparecem os **nomes** dos tokens. Hoje a identidade nova vale na tela principal do web (`/`); as próximas etapas levam o resto (ver "Etapas" no `CLAUDE.md`).

## Identidade e tom

**Noite calma.** Um instrumento silencioso que mostra constância. O fundo é quase preto com leve tom violeta, as superfícies sobem em camadas discretas e o roxo fica reservado para **dado e ação**: o heatmap é a única coisa que brilha. Só tema escuro. Texto direto, em pt-BR, na segunda pessoa, sem exclamações.

## Princípios

1. **O heatmap é o herói.** Uma ousadia só por tela; o resto fica quieto e alinhado a ele.
2. **Roxo é informação.** Fundo e superfícies quase neutros; intensidade de roxo = quanto foi feito. Verde só para "concluído".
3. **Números com personalidade, texto neutro.** Números e títulos na fonte de exibição; corpo na fonte de texto.
4. **Nada decorativo que não informe.** Sem gradientes de enfeite, sem cartões iguais em série, sem rótulos em caixa alta.
5. **Movimento responde ou orienta**, nunca enfeita (ver "Movimento").

## Cores (conjunto `night`, `--color-night-*`)

| Papel           | Tokens                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fundo da página | `night-bg` (+ brilho radial com `night-glow` em alpha baixo, fixo)                                                                                                             |
| Superfícies     | `night-surface` (painéis) → `night-surface-raised` (hover, elevação) → `night-surface-overlay` (tooltip, popover)                                                              |
| Bordas          | `night-border` (divisórias), `night-border-strong` (campos, célula vazia)                                                                                                      |
| Texto           | `night-foreground` (principal), `night-muted` (secundário), `night-subtle` (rótulos pequenos; ainda AA)                                                                        |
| Ação            | `night-accent` (fundo de botão primário, toggle ligado), `night-accent-hover`, `night-accent-on` (texto sobre o acento), `night-accent-text` (links, anel de foco, item ativo) |
| Heatmap         | `night-heat-0` … `night-heat-5` (mais feito = mais claro; passos iguais de luminosidade)                                                                                       |
| Estados         | `night-success`/`-surface`, `night-danger`/`-surface`, `night-warning`/`-surface`                                                                                              |

Regras: só tokens (nada de hex nem classes de cor do Tailwind); alpha só por modificador (`/40`) ou `color-mix` sobre um token. Texto sempre ≥ 4,5:1 sobre o fundo onde aparece; componentes de UI ≥ 3:1. O conjunto antigo (`background`, `surface`, `heatmap-*`…) continua servindo as telas ainda não migradas e o mobile.

## Tipografia

- **Exibição** (`font-display`, Bricolage Grotesque, auto-hospedada, latino, eixo de peso): ano, números do resumo, títulos de painel, wordmark. Pesos 600-700; `tracking-tight` só em tamanhos grandes.
- **Texto** (`font-sans`, Inter): todo o resto. 400-600.
- Escala: 5xl (ano) · 3xl (números) · xl (título de painel) · base (lista) · sm (secundário) · xs (rótulos, legenda).
- Números que se comparam: `tabular-nums`. Títulos de mais de uma linha: `text-balance`.

## Espaçamento e raios

- Escala padrão do Tailwind (4 px). Entre seções: 8 (32 px); dentro de painel: 4-5; entre células: 1 (4 px).
- Raios: célula `rounded-md` (44 px) / `rounded-sm` (28 px); botões e campos `rounded-md`; painéis `rounded-xl`. Hierarquia: quanto maior o objeto, maior o raio.
- Alvo de toque ≥ 44 px (`min-h-touch`, `size-touch`) em telas estreitas; a linha inteira de um item é o alvo.

## Componentes e estados

**Célula do heatmap**: quadrado `night-heat-N`; nível 0 com contorno interno `night-border-strong`; níveis 4-5 com brilho estático (`night-glow`). Hoje: anel `night-foreground` com afastamento. Futuro: nível 0 a 40%, inerte. Hover: `scale` leve (só com movimento) + `brightness`. Foco: anel `night-accent-text` + tooltip. Ativo: abre o dia. Todo dia tem rótulo acessível com data e "N de M".

**Grade**: `role="grid"`, uma parada de Tab (hoje ou o último dia focado); ←/→ semana, ↑/↓ dia, Home/End ao longo do dia da semana; futuro é pulado. Coluna de dias fixa com esmaecimento. Rola na horizontal com a semana atual à vista.

**Painel/cartão**: `night-surface` + borda `night-border` + `rounded-xl`; título na fonte de exibição. Use painel para agrupar ação (ex.: "Hoje"), não para cada número.

**Botões** (`Button` variantes `night`, `night-secondary`, `night-ghost`): primário só um por área. Hover clareia o fundo; foco = anel global; desabilitado = 50% de opacidade, sem ponteiro; carregando = rótulo com "…" ("Salvando…") e desabilitado.

**Campos e toggles**: borda `night-border-strong`, fundo `night-bg`; marcado = `night-success` com ícone `night-bg`; erro = texto `night-danger` abaixo do campo, ligado por `aria-describedby`.

**Estados de tela**:

- _Carregando_: esqueleto com a forma do conteúdo (a grade em `night-heat-0`), respiração de opacidade só com movimento, `aria-busy` e texto `sr-only` "Carregando…".
- _Vazio_: convite com a próxima ação ("Criar primeiro hábito"), nunca só "nada aqui".
- _Erro_: `night-danger-surface` + ícone + o que houve + "Tentar de novo".

## Movimento

- Só `transform` e `opacity`; preferencialmente CSS; nenhuma biblioteca de animação.
- Hover/foco: 120-200 ms, `ease-out`.
- Entrada da grade: uma varredura da semana atual para o passado, 220 ms por célula e 6 ms por coluna (≤ ~540 ms), uma vez por ano exibido, cancelada por qualquer interação.
- Confirmação: pulso de `scale` de ~300 ms ao marcar um hábito (checkbox e célula de hoje).
- `prefers-reduced-motion: reduce` = **nenhuma** animação (classes `motion-safe:` e `usePrefersReducedMotion`).

## Acessibilidade

Contraste AA no mínimo; foco sempre visível; nada só por cor (rótulos e tooltip dizem a proporção); teclado completo; `aria-live` para mudanças assíncronas (toasts do sonner); textos decorativos e ícones com `aria-hidden`; alvos de 44 px no toque.

## Fazer / evitar

| Fazer                                                       | Evitar                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Deixar o heatmap ser a peça mais clara da tela              | Roxo em fundos, bordas e ícones decorativos                             |
| Números grandes na fonte de exibição, rótulo em frase curta | Cartões iguais em série, gradientes de enfeite, sombras cinza genéricas |
| Um brilho fixo e sutil no fundo                             | Imagens pesadas, fontes de CDN, novas dependências de animação          |
| Estados vazios que convidam a agir                          | Rótulos em caixa alta, "→" em botões, meta-texto com "·"                |
| Frases em sentence case, pt-BR                              | Cores soltas (hex, `violet-500`) no código de app                       |
