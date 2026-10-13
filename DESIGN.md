# DESIGN.md

Referência visual do Habits desde a 2.4.0. Os valores ficam só em `packages/design-tokens/src/tokens.ts` (fonte única); aqui só aparecem os **nomes** dos tokens. Vale em **todo o web** (2.4.0) e em **todo o mobile** (tela principal na 2.5.0, demais telas na 2.6.0). Regras próprias do celular em "Mobile".

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

Regras: só tokens (nada de hex nem classes de cor do Tailwind); alpha só por modificador (`/40`) ou `color-mix` sobre um token. Texto sempre ≥ 4,5:1 sobre o fundo onde aparece; componentes de UI ≥ 3:1. Web e mobile recebem exatamente os mesmos tokens; desde a 2.6.0 só existe o conjunto `night` (a paleta antiga e seus nomes foram removidos, e um teste em cada app falha com classes antigas).

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

**Célula do heatmap**: quadrado `night-heat-N`; nível 0 com contorno interno `night-border-strong`; níveis 4-5 com brilho estático (`night-glow`). Hoje: anel `night-foreground` com afastamento. Futuro: nível 0 a 40%, inerte. Hover: só `brightness` (a célula não se move). Hover e foco são marcados pela **lente** da grade. Ativo: abre o dia. Todo dia tem rótulo acessível com data e "N de M".

**Grade**: `role="grid"`, uma parada de Tab (hoje ou o último dia focado); ←/→ semana, ↑/↓ dia, Home/End ao longo do dia da semana; futuro é pulado. Coluna de dias fixa com esmaecimento. Rola na horizontal com a semana atual à vista.

**Lente**: um único anel `night-accent-text` que marca a célula sob o mouse ou com foco (é o indicador de foco das células) e desliza entre células, levando o tooltip junto. Nos vãos entre células fica parada; some ao sair da grade ou rolar.

**Barra de rolagem**: fina, trilho transparente, polegar `night-border-strong` arredondado; na área do heatmap clareia para `night-subtle` sob o mouse.

**Painel/cartão**: `night-surface` + borda `night-border` + `rounded-xl`; título na fonte de exibição. Use painel para agrupar ação (ex.: "Hoje"), não para cada número.

**Botões** (`Button`: `default` = `night-accent`, `secondary`, `outline`, `ghost`, `danger`, `success` só para "concluído", `link`): primário só um por área. Hover clareia o fundo; foco = anel global; desabilitado = 50% de opacidade, sem ponteiro; carregando = rótulo com "…" ("Salvando…") e desabilitado.

**Campos e toggles**: borda `night-border-strong`, fundo `night-bg`; marcado = `night-success` com ícone `night-bg`; erro = texto `night-danger` abaixo do campo, ligado por `aria-describedby`.

**Linha de hábito** (dia e painel Hoje): a linha inteira é o alvo (44 px), checkbox à esquerda, nome riscado em `night-muted` quando feito, pulso ao marcar.

**Cartão de hábito** (tela Hábitos): alça `⋮⋮` à esquerda, nome em destaque, selo "Hoje" (`night-success` sobre `night-success-surface`) ou "Próxima: …" (contorno `night-border`), e a **faixa de dias**: para dias da semana, as 7 iniciais em pílulas, acesas em `night-accent` nos dias do hábito, apagadas com contorno nos outros e um ponto `night-accent-text` sob hoje; para os demais tipos, o ícone do tipo em `night-accent-text` e o resumo. Lida como uma frase ("Repete: seg, qua, sex"); as pílulas são decorativas. Arquivados e passados ficam apagados e sem destaque.

**Reordenar**: arrastar pela alça (mouse e toque; o cartão erguido ganha borda `night-accent-text` e sombra, os outros abrem espaço em 150 ms, só com movimento); pelo teclado na alça (Espaço pega, ↑/↓ movem, Espaço solta, Esc cancela, tudo anunciado); botões subir/descer visíveis a partir de `md` e no menu "Mais ações" no celular. Mover não pede confirmação nem tem "Desfazer": basta mover de volta.

**Navegação**: a seção atual se destaca por mais que cor. No topo, pílula com fundo `night-accent` em 15% de opacidade, contorno interno `night-accent` em 40% e texto/ícone `night-accent-text`; inativas em `night-muted`; sob o mouse, fundo `night-surface-raised` e contorno interno em `night-foreground` a 45% (na pílula do topo e em volta do ícone na barra inferior), para o ponteiro nunca ficar sem indicação; a aba atual mantém o próprio contorno. Na barra inferior, pílula atrás do ícone e uma barrinha `night-accent-text` no topo do item.

**Próximos** (aba Hoje): um cartão por ocorrência, no mesmo estilo dos hábitos, com um bloco de data à esquerda (dia da semana ou "amanhã" em `night-accent-text`, o dia grande na fonte de exibição, o mês), o nome e o resumo da repetição; somente leitura. Lido como "qua, 14/10: Consulta".

**Telas de leitura** (Hoje, dia, Hábitos, Ajustes): uma coluna centralizada de `max-w-2xl`, texto alinhado à esquerda; o heatmap usa a largura toda.

**Linha de ajuste** (`SettingRow`): cartão com ícone, título, descrição e switch; o cartão inteiro liga e desliga, como no mobile.

**Diálogos**: `night-surface` sobre fundo `night-bg/80` com leve desfoque; título na fonte de exibição; confirmações (`alertdialog`) abrem com "Cancelar" focado; Esc fecha.

**Chips de escolha** (repetição, dias): selecionado em `night-accent` + `night-accent-on`; os demais com borda `night-border-strong`.

**Calendário**: dias em `tabular-nums`, selecionado em `night-accent`, indisponíveis em `night-subtle`; mês com só a primeira letra maiúscula.

**Aviso de dia passado**: `night-warning` sobre `night-warning-surface`, sempre com ícone e texto.

**Datas e títulos**: só a primeira letra em maiúscula (`first-letter:uppercase`), nunca `capitalize` em frases ("5 de outubro", não "5 De Outubro").

**Estados de tela**:

- _Carregando_: esqueleto com a forma do conteúdo (a grade em `night-heat-0`), respiração de opacidade só com movimento, `aria-busy` e texto `sr-only` "Carregando…".
- _Vazio_: convite com a próxima ação ("Criar primeiro hábito"), nunca só "nada aqui".
- _Erro_: `night-danger-surface` + ícone + o que houve + "Tentar de novo".

## Movimento

- Só `transform` e `opacity`; preferencialmente CSS; nenhuma biblioteca de animação.
- Hover/foco: 120-200 ms, `ease-out`. Nada de várias peças animando ao mesmo tempo: na grade, uma lente desliza (120 ms) em vez de cada célula crescer.
- Entrada da grade: uma varredura da semana atual para o passado, 220 ms por célula e 6 ms por coluna (≤ ~540 ms), uma vez por ano exibido, cancelada por qualquer interação.
- Confirmação: pulso de `scale` de ~300 ms ao marcar um hábito (checkbox e célula de hoje).
- `prefers-reduced-motion: reduce` = **nenhuma** animação (classes `motion-safe:` e `usePrefersReducedMotion`).

## Teclado

- Heatmap: grade com setas, Home/End e Enter (ver "Grade").
- Tela de um dia aberta pelo heatmap: **Esc** volta ao histórico; **←/→** vão ao dia anterior/próximo (até hoje). Nada disso age com diálogo ou calendário aberto (o Esc fecha só ele) nem com foco num campo.
- Atalhos aparecem no próprio controle (`aria-keyshortcuts`, dica `Esc` visível a partir de `md`).

## Acessibilidade

Contraste AA no mínimo; foco sempre visível; nada só por cor (rótulos e tooltip dizem a proporção); teclado completo; `aria-live` para mudanças assíncronas (toasts do sonner); textos decorativos e ícones com `aria-hidden`; alvos de 44 px no toque.

## Mobile

O celular é o uso principal, quase sempre com **uma mão**. Mesma identidade, mesmos tokens; o que muda é a mão no lugar do mouse.

- **Zona do polegar**: o que só se lê ou se usa pouco fica no alto (marca, sincronização, engrenagem de Ajustes, números); a ação do dia fica no terço de baixo (lista de Hoje, rodapés fixos como "Novo hábito" e "Editar este dia"). Nada de ação frequente no canto superior.
- **Alvos de toque**: ≥ 44 dp (`min-h-touch`, `size-touch`); a linha inteira é o alvo. Quando o desenho precisa ser menor (célula de 28 dp do heatmap), a área de toque é o espaço inteiro sem vãos entre vizinhos e um **realce no toque** (anel `night-accent-text`) mostra o que vai abrir antes de soltar; arrastar para fora cancela.
- **Navegação** (2.6.0, igual ao web): abas **Hoje** (abre primeiro), **Histórico** (o heatmap) e **Hábitos**; Ajustes é a engrenagem no topo de cada aba, uma tela empilhada com voltar. Aba ativa: pílula `night-accent` em 20% atrás do ícone, ícone e rótulo `night-accent-text` e uma barrinha no topo (nunca só cor). Abas nunca deslizam.
- **Hoje**: faixa dos últimos 7 dias no topo (pílulas com inicial, dia na fonte de exibição, quadradinho do nível e ponto em hoje; a escolhida em `night-accent` com texto `night-accent-on`), depois o dia escolhido com as regras de sempre (dia passado só leitura até "Editar este dia"). A escolha fica só em memória e volta para hoje ao sair da aba.
- **Avisos** ("Desfazer"): ficam logo acima do rodapé fixo da tela em foco; sem rodapé, acima da barra de abas. Nunca cobrem uma ação fixa.
- **Histórico** (2.7.0): o heatmap continua no alto e é o que brilha. Acima da grade, uma linha de chips filtra por hábito. Abaixo, seções quietas que respondem uma pergunta cada: Tendência (12 barras finas, sem eixo, a semana atual em `night-accent-text`, uma frase), Destaques (até 3 frases, só o que os dados sustentam) e Por hábito (um painel, uma linha por hábito com o mês, uma faixa de 30 dias em que dia sem previsão é só uma linha de base, e a sequência quando maior que zero). Sem cartões iguais em série, sem gráfico com grade.
- **Seletores de dia e mês** (2.7.0): "Dias do mês" e "Todo ano" usam o desenho do calendário (7 colunas que preenchem a largura, dias sem borda de 44 dp, escolhido em `night-accent`, cada dia escolhido como um quadrado separado, para dias vizinhos não virarem uma faixa). "Dias do mês" não mostra mês nem ano; "Todo ano" é um calendário como o de "Começa em", com setas passando pelos meses, sem ano.
- **Toque**: botões, chips, pílulas e cartões afundam um pouco (escala 0,97 em 100 ms); a lista do dia entra com fade ao trocar de dia; cartões reordenados deslizam. Nada disso com movimento reduzido.
- **Hábitos**: cartões como no web (faixa D S T Q Q S S ou ícone do tipo, selo "Hoje"/"Próxima"), "Novo hábito" no rodapé fixo e um modo "Reordenar" com setas subir/descer de 44 dp (arrastar fica para depois).
- **Heatmap**: colunas = semanas, células de 28 dp em passo de 32, rolagem horizontal abrindo na semana atual. Para leitor de tela, **um elemento por semana** ("Semana de 4 a 10 de outubro"): deslizar para cima/baixo escolhe o dia, toque duplo abre.
- **Safe areas**: Android é edge-to-edge; telas usam `Screen` (safe area em cima nas abas, teclado empurra o conteúdo). O brilho do fundo passa por baixo da barra de status.
- **Háptico**: `selection` ao marcar/desmarcar um hábito; nunca em rolagem, navegação ou carregamento.
- **Movimento**: Reanimated no thread de UI, só `transform` e `opacity`, nenhum `setState` por quadro. Toques frequentes (marcar, abrir dia) têm só retorno curto (≤ 150 ms ou nada); abas nunca deslizam. Varredura de entrada e pulso como em "Movimento". Preferência "remover animações" do sistema (`AccessibilityInfo`) = nenhuma animação.
- **Fontes**: números, ano, títulos de painel e marca em Bricolage Grotesque (`DisplayText`, arquivos locais carregados por JS); texto na **fonte do sistema** (Roboto). Tudo acompanha a escala de fonte do Android; só rótulos minúsculos de grade (mês, dia da semana) têm teto de crescimento para não sair do espaço.
- **Cores fora do NativeWind** (`boxShadow`, gradiente, ícones, navegação): sempre de `@habits/design-tokens` (`nightColors.*`), alpha só com o helper sobre um token.

| Fazer no celular                                         | Evitar no celular                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| Ação diária ao alcance do polegar, sem trocar de tela    | Botão importante no canto superior                                  |
| Realce no toque no lugar do hover                        | Depender de hover ou de toque longo para descobrir algo             |
| Gradiente e sombra do próprio React Native (vão por OTA) | Módulo nativo para enfeite (gradiente, blur, SVG): exige build novo |
| Um elemento acessível por grupo com rótulo útil          | Centenas de elementos soltos para o TalkBack                        |
| Splash até fonte e dados estarem prontos                 | Tela branca ou texto trocando de fonte depois de aparecer           |

## Fazer / evitar

| Fazer                                                       | Evitar                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Deixar o heatmap ser a peça mais clara da tela              | Roxo em fundos, bordas e ícones decorativos                             |
| Números grandes na fonte de exibição, rótulo em frase curta | Cartões iguais em série, gradientes de enfeite, sombras cinza genéricas |
| Um brilho fixo e sutil no fundo                             | Imagens pesadas, fontes de CDN, novas dependências de animação          |
| Estados vazios que convidam a agir                          | Rótulos em caixa alta, "→" em botões, meta-texto com "·"                |
| Frases em sentence case, pt-BR                              | Cores soltas (hex, `violet-500`) no código de app                       |
