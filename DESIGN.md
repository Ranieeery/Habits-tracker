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

**Célula do heatmap**: quadrado `night-heat-N`; nível 0 com contorno interno `night-border-strong`; níveis 4-5 com brilho estático (`night-glow`). Hoje: anel `night-foreground` com afastamento. Hover: só `brightness` (a célula não se move). Hover e foco são marcados pela **lente** da grade. Ativo: abre o dia. Todo dia tem rótulo acessível com data e "N de M".

**Prévia dos próximos dias** (2.14.0): no ano corrente, os 7 dias depois de hoje (`PREVIEW_DAYS`) são quadrados com **contorno tracejado** `night-subtle` (≥ 3:1 sobre o fundo e os painéis), sem preenchimento e sem nível. **Nenhum indicador de conteúdo** na grade (nada de ponto, contagem ou cor por tipo): o que está programado só aparece ao abrir o dia. A grade continua até 31/12: os dias depois da prévia seguem como marcadores inertes (nível 0 a 40%, sem abrir). Só quando os 7 dias passam de 31/12 a grade entra no ano seguinte, com o rótulo "jan", até o 7º dia; depois dele não se desenha nada. Rótulo "20 de outubro, dia futuro, toque para ver o que está programado"; tooltip (web) ou balão (celular) só com a data e "Dia futuro". Mesma varredura de entrada das outras células. A legenda termina com um quadrado tracejado e "Futuro".

**Dia futuro**: o cabeçalho de sempre, o aviso com ícone de olho "Dia futuro, somente leitura" e os hábitos programados numa lista **sem checkbox** (um círculo tracejado `night-subtle` no lugar), com a primeira linha da descrição e o ícone de nota; tarefa com prazo naquele dia leva o selo "Vence neste dia" (ícone e texto, estilo do selo de prazo). Sem nada: "Nada programado para este dia". Sem barra de progresso, "Novo hábito", edição ou "Desfazer". Uma data além de hoje+7 nunca abre: "Este dia ainda está longe" com o caminho de volta.

**Grade**: `role="grid"`, uma parada de Tab (hoje ou o último dia focado); ←/→ semana, ↑/↓ dia, Home/End ao longo do dia da semana; alcança os dias da prévia e nada além. Coluna de dias fixa com esmaecimento. Rola na horizontal; no ano corrente abre com a última coluna da prévia perto da borda direita (hoje, os 7 dias e a semana atual à vista).

**Lente**: um único anel `night-accent-text` que marca a célula sob o mouse ou com foco (é o indicador de foco das células) e desliza entre células, levando o tooltip junto. Nos vãos entre células fica parada; some ao sair da grade ou rolar.

**Barra de rolagem**: fina, trilho transparente, polegar `night-border-strong` arredondado; na área do heatmap clareia para `night-subtle` sob o mouse.

**Painel/cartão**: `night-surface` + borda `night-border` + `rounded-xl`; título na fonte de exibição. Use painel para agrupar ação (ex.: "Hoje"), não para cada número.

**Botões** (`Button`: `default` = `night-accent`, `secondary`, `outline`, `ghost`, `danger`, `success` só para "concluído", `link`): primário só um por área. Hover clareia o fundo; foco = anel global; desabilitado = 50% de opacidade, sem ponteiro; carregando = rótulo com "…" ("Salvando…") e desabilitado.

**Ações destrutivas** (2.11.0): arquivar é o caminho padrão; "Apagar" (`danger` ou ícone de lixeira) só aparece para hábitos já arquivados, sempre depois de uma confirmação com "Cancelar" em foco que diz o que se perde (o histórico sai do mapa), e termina com "Desfazer" por 6 s.

**Descrição de hábito** (2.12.0): opcional, texto com um pouco de Markdown (negrito, itálico, listas, links). Nas listas do dia, a primeira linha da descrição abaixo do nome (`night-muted`, uma linha com reticências) e um ícone de nota (`night-muted`, alvo próprio de 44 px, fora do checkbox), só quando há descrição; ele abre um resumo (popover no web, folha inferior no celular) com as primeiras linhas e, se o texto continuar, "Abrir descrição completa", que leva à página do hábito: painel de cabeçalho com o único brilho da página, nome na fonte de display, a faixa da semana e o selo do cartão, e "Descrição" em painel próprio (marcadores de lista em `night-accent-text`) ou um vazio tracejado com "Adicionar descrição"; os painéis entram com fade e subida de 200 ms, escalonados. Links em `night-accent-text` sublinhados; nada é renderizado como HTML.

**Resumo da descrição** (2.14.1, popover no web, folha no celular): um cartão em três faixas com ritmo fixo. (1) O **nome** na fonte de exibição, `lg` no web e `xl` no celular, semibold, no máximo **2 linhas** com reticências (o nome inteiro continua no `title` e para o leitor de tela). (2) O **corpo** em texto secundário (`night-muted`, `sm`/15 dp, entrelinha 24), 8 px abaixo do nome; negrito sobe para `night-foreground`, o que dá hierarquia dentro do texto apagado. O corte é o de sempre (core: 4 linhas, 280 caracteres); quando há corte, as últimas ~2 linhas **esmaecem** até sumir (máscara no web, gradiente sobre `night-surface` no celular), indicando que o texto continua. Esse fim fica abaixo do AA de propósito, porque o texto inteiro está a um toque. (3) Um **divisor** de 1 px e a ação **"Abrir descrição completa"** (sempre presente, mesmo com texto curto) ocupando a largura toda: rótulo `night-accent-text` à esquerda e seta à direita, ≥ 44 px (56 dp no celular). No web, o divisor é `night-border-strong` (o `night-border` some sobre `night-surface-overlay`), o rodapé é um link com hover em `night-accent/15`, a seta anda 2 px (só com movimento) e o anel de foco fica por dentro. No celular, o divisor é `night-border`, a ação é um botão com dica e realce `night-surface-raised` no toque, fica fora da rolagem (fonte grande nunca a empurra para fora) e no terço de baixo. Espaço interno 16 px no web e 20 dp no celular. Sem descrição não há cartão: o ícone de nota nem aparece.

**Tipografia da descrição** (2.14.1, um só renderizador por app, `DescriptionText` com `variant`): `preview` (o resumo acima) e `reading` (a página do hábito: `night-foreground`, 15 px/16 dp, entrelinha 28, 16 px entre blocos). Em ambos: parágrafos mantêm as quebras de linha, 12-16 px entre blocos; lista com marcador `night-accent-text` e 6 px entre itens; negrito semibold em `night-foreground`; itálico; link `night-accent-text` com sublinhado a 50% que fica cheio no hover; palavras e URLs longas quebram em qualquer ponto (`wrap-anywhere` no web; o Android quebra sozinho). O parser só conhece parágrafos, listas com "- "/"* ", `**negrito**`, `*itálico*` e links; numeradas, aninhadas, citação, código, títulos e `_itálico_` aparecem literais (quebrando como texto), sem estilo próprio.

**Tarefas com prazo** (2.13.0): em Hoje, um grupo "Com prazo" depois dos hábitos do dia, com título e ícone de calendário em `night-accent-text`. O selo da tarefa traz ícone e texto ("Até 20/10 · faltam 7 dias", "Vence amanhã") em `night-accent-text` sobre `night-accent/15`; "Vence hoje" usa `warning`. Depois do prazo, a tarefa vai para os atrasados com o selo deles. Num dia passado com o prazo perdido e cumprido depois, a linha diz "Já concluída em DD/MM", com o checkbox marcado e desativado.

**Campos e toggles**: borda `night-border-strong`, fundo `night-bg`; marcado = `night-success` com ícone `night-bg`; erro = texto `night-danger` abaixo do campo, ligado por `aria-describedby`.

**Linha de hábito** (dia e painel Hoje): a linha inteira é o alvo (44 px), checkbox à esquerda, nome riscado em `night-muted` quando feito, pulso ao marcar. Na aba Hoje, o botão "mais opções" na ponta (2.15.0, abaixo).

**Botão "mais opções"** (2.15.0; desde 2.16.1 em **toda tela de dia**: `/today` e `/day/*` no web; no celular, a aba Hoje, inclusive os dias da faixa, e os dias abertos pelo Histórico, passados, hoje ou da prévia; itens normais, atrasados e com prazo. Só o painel Hoje da tela do heatmap no web não tem, e ali o botão direito continua sendo o do navegador): ícone de três pontos na **vertical** (`⋮`) em `night-muted`, sempre visível, na extremidade da linha, depois do ícone de nota, centralizado na vertical. Alvo próprio de 44 px (no celular, 44 dp mais um pequeno `hitSlop`), fora do alvo de marcar: tocar nele **nunca** marca o hábito. Hover e pressionado em `night-surface-raised` (o ícone sobe para `night-foreground` no web); aberto, fica com o mesmo fundo. Presente também nos dias somente leitura da aba Hoje: as ações mudam o hábito, não o dia. Rótulo "Mais opções de {nome}".

**Menu de ações do hábito** (2.15.0): lista declarativa única no core (`habitActions`: rótulos e ordem num só lugar; os dois apps só mapeiam ícone e ação), na ordem **Editar hábito** (lápis, com a observação "Vale para todos os dias" em `xs` `night-muted`), **Ver descrição completa** (nota; só quando há descrição) e **Arquivar** (caixa; ou **Desarquivar** num hábito já arquivado). "Arquivar" é ação cuidadosa: ícone e texto `night-warning`, realce `night-warning-surface`, nunca vermelho. Cabeçalho com o nome do hábito (truncado, nome inteiro no `title`) e um divisor `night-border-strong`.

- _Web_: `night-surface-overlay` com borda `night-border`, `rounded-xl`, sombra `night-bg/70`, 16 rem de largura; itens de 44 px com ícone `night-muted` e rótulo; o item sob o ponteiro ou o teclado ganha `night-accent/15` (o `surface-raised` é mais escuro que o overlay e sumiria) e, pelo teclado, um anel interno `night-accent-text`. Abre ancorado ao botão (alinhado à direita) ou, com o **botão direito dentro da linha**, no cursor (o menu do navegador é cancelado só ali; fora da linha continua normal; no toque o web não abre nada com toque longo). Mesma definição de itens nos dois caminhos. Esc e clique fora fecham; o foco volta ao botão (ou ao checkbox da linha, quando aberto pelo botão direito). Abertura: fade e zoom de 95% a 100% em 150 ms, só com movimento.
- _Celular_: folha inferior (a mesma do "Novo hábito": `night-surface`, alça, nome em `DisplayText` em até 2 linhas, "Fechar"), itens de 56 dp com ícone de 22 dp, rótulo e dica, realce `night-surface-raised` no toque (`night-warning-surface` em "Arquivar") e o afundar de 0,97 dos botões. Abre pelo `⋮` ou por **toque longo de 1 s** na linha (`LONG_PRESS_MS`), com háptico leve no instante em que abre; soltar antes de 1 s é um toque curto e marca como sempre; depois do toque longo, soltar não marca. Enquanto o dedo está na linha, o fundo vai para `night-surface-raised` na hora, sem animação. "Editar hábito" troca o conteúdo da mesma folha pelo formulário (nunca duas folhas empilhadas). Com "remover animações", a folha aparece sem deslizar. O foco do TalkBack vai para o título ao abrir e volta ao `⋮` ao fechar.
- _Efeitos_: editar abre o formulário da tela Hábitos (dialog no web, folha no celular) sem sair do dia. Arquivar é imediato, com o aviso "Hábito arquivado · Sai dos próximos dias. Hoje e o histórico continuam no mapa." e "Desfazer" por 6 s (desarquiva). O hábito arquivado continua em hoje e nos dias passados (regra do core: arquivado durante o dia D ainda conta em D) com o selo **"Arquivado"** (ícone de caixa e texto `night-muted`, contorno `night-border-strong`, `rounded-md`, `xs`), e sai dos dias seguintes, dos atrasados e de "Com prazo".

**Adiar** (2.16.0): item do menu entre "Editar hábito" e "Ver descrição completa", ícone de calendário com seta, observação "Só esta ocorrência". Só nas linhas de hábitos de data única ou de dias do mês **cuja ocorrência vale naquele dia**, em **hoje** e nos **7 dias da prévia** (o menu da prévia não tem "Arquivar"); nunca em dias passados, atrasados, outros tipos ou arquivados. No limite de 2 adiamentos o item **continua no lugar, indisponível**, com o motivo como observação ("Limite de 2 adiamentos atingido", texto `night-muted`/`night-subtle`, sem realce): esconder pareceria defeito; no web é `aria-disabled` (focável, o leitor de tela lê o motivo), no celular `accessibilityState.disabled`.

- _Dialog/folha_: título "Adiar {nome}", "Só a ocorrência de 20/10. A repetição do hábito não muda.", atalhos como opções de 44 px+ ("Amanhã" e "Daqui a 1 semana" a partir de hoje; "Dia seguinte" e "Uma semana depois" a partir de um dia da prévia; a data à direita em `night-muted`), selecionada com contorno `night-accent` sobre `night-accent/15`; inválida sem realce, texto `night-subtle` e o motivo embaixo. "Escolher data" abre o seletor de datas do formulário, limitado ao intervalo válido. Embaixo, o efeito em `night-bg` com borda `night-border` ("O dia 20/10 deixa de contar este hábito (sem falha). Passa para 27/10." e "Resta 1 adiamento."; o último em `night-warning`: "Este é o último adiamento desta ocorrência."). Botão primário "Adiar". Uma falha aparece em `night-danger` e a escolha fica.
- _Depois_: "Adiado para 27/10" com "Desfazer" por 6 s. No novo dia, o selo **"Adiado de 20/10"** (ícone de calendário com seta e texto `night-muted`, contorno `night-border-strong`, como "Arquivado"), lido ", adiado de 20 de outubro". Atrasada, a ocorrência mostra só "Atrasado desde 27/10 · adiado" (o selo de atraso prevalece). No dia de origem (hoje ou prévia, nunca dias passados), uma nota somente leitura sob a lista: ícone `night-subtle`, "Pagar conta · Adiado para 27/10" em `night-muted`, sem checkbox.

**Cartão de hábito** (tela Hábitos): alça `⋮⋮` à esquerda, nome em destaque, selo "Hoje" (`night-success` sobre `night-success-surface`) ou "Próxima: …" (contorno `night-border`), e a **faixa de dias**: para dias da semana, as 7 iniciais em pílulas, acesas em `night-accent` nos dias do hábito, apagadas com contorno nos outros e um ponto `night-accent-text` sob hoje; para os demais tipos, o ícone do tipo em `night-accent-text` e o resumo. Lida como uma frase ("Repete: seg, qua, sex"); as pílulas são decorativas. Arquivados e passados ficam apagados e sem destaque.

**Reordenar**: arrastar pela alça (mouse e toque; o cartão erguido ganha borda `night-accent-text` e sombra, os outros abrem espaço em 150 ms, só com movimento); pelo teclado na alça (Espaço pega, ↑/↓ movem, Espaço solta, Esc cancela, tudo anunciado); botões subir/descer visíveis a partir de `md` e no menu "Mais ações" no celular. Mover não pede confirmação nem tem "Desfazer": basta mover de volta.

**Navegação**: a seção atual se destaca por mais que cor. No topo, pílula com fundo `night-accent` em 15% de opacidade, contorno interno `night-accent` em 40% e texto/ícone `night-accent-text`; inativas em `night-muted`; sob o mouse, fundo `night-surface-raised` e contorno interno em `night-foreground` a 45% (na pílula do topo e em volta do ícone na barra inferior), para o ponteiro nunca ficar sem indicação; a aba atual mantém o próprio contorno. Na barra inferior, pílula atrás do ícone e uma barrinha `night-accent-text` no topo do item.

**Próximos** (aba Hoje): um cartão por ocorrência, no mesmo estilo dos hábitos, com um bloco de data à esquerda (dia da semana ou "amanhã" em `night-accent-text`, o dia grande na fonte de exibição, o mês), o nome e o resumo da repetição; somente leitura. Lido como "qua, 14/10: Consulta".

**Telas de leitura** (Hoje, dia, Hábitos, Ajustes): uma coluna centralizada de `max-w-2xl`, texto alinhado à esquerda; o heatmap usa a largura toda.

**Linha de ajuste** (`SettingRow`): cartão com ícone, título, descrição e switch; o cartão inteiro liga e desliga, como no mobile.

**Diálogos**: `night-surface` sobre fundo `night-bg/80` com leve desfoque; título na fonte de exibição; confirmações (`alertdialog`) abrem com "Cancelar" focado; Esc fecha.

**Descartar alterações** (2.16.2): fechar o formulário de hábito (criar ou editar) com algo diferente do que ele tinha ao abrir pergunta antes; sem mudança (ou digitando e apagando de volta, ou só espaços) fecha direto. Mesmo texto nos dois apps: título "Descartar alterações?", "Você tem alterações que não foram salvas." e dois botões, "Continuar editando" (o botão primário, preenchido em `night-accent`, e o foco começa nele: destaque, foco e ação segura no mesmo botão, e um Enter ou toque por engano nunca descarta) e "Descartar" (ação cuidadosa: borda e texto `night-warning`, pressionado/hover `night-warning-surface`; nunca vermelho, igual a "Arquivar"). Sem terceiro botão. O aviso fica por cima do formulário: Esc, clique ou toque fora e o voltar do Android fecham só o aviso e voltam à edição, com os dados e o foco onde estavam. Entra em 150 ms (opacidade e escala), nada com movimento reduzido. Salvar, criar ou arquivar fecham sem perguntar; sair da página ou fechar a aba do navegador não pergunta (sem aviso nativo).

**Chips de escolha** (repetição, dias): selecionado em `night-accent` + `night-accent-on`; os demais com borda `night-border-strong`.

**Calendário**: dias em `tabular-nums`, selecionado em `night-accent`, indisponíveis em `night-subtle`; mês com só a primeira letra maiúscula.

**Selo de atrasado** (2.8.0, só na lista de hoje): hábito de dia fixo que passou sem marcar fica no topo da lista com um selo "Atrasado desde 11/10": ícone de calendário com relógio + texto em `night-warning` sobre `night-warning-surface`, contorno `night-warning` a 60%, `rounded-md`, texto `xs`. Nunca só cor; lido como "Nome, atrasado desde 11 de outubro". No web fica ao lado do nome (quebra para baixo se faltar espaço); no celular, abaixo do nome. Marcado, continua no lugar com o selo (o nome riscado), para que desmarcar o devolva ao estado anterior. Sem ação "Dispensar". Quando só há atrasados pendentes, a barra de progresso dá lugar a "Nada previsto para hoje além dos atrasados."

**Aviso de dia passado**: `night-warning` sobre `night-warning-surface`, sempre com ícone e texto.

**Datas e títulos**: só a primeira letra em maiúscula (`first-letter:uppercase`), nunca `capitalize` em frases ("5 de outubro", não "5 De Outubro").

**Estados de tela**:

- _Carregando_: esqueleto com a forma do conteúdo (a grade em `night-heat-0`), respiração de opacidade só com movimento, `aria-busy` e texto `sr-only` "Carregando…".
- _Vazio_: convite com a próxima ação ("Criar primeiro hábito"), nunca só "nada aqui".
- _Erro_: `night-danger-surface` + ícone + o que houve + "Tentar de novo".

## Ícone e abertura (2.9.0)

- **Marca**: os quatro quadrados do heatmap (`night-heat-4` e `-5` em cima, `-2` e `-3` embaixo), a mesma do `Wordmark`. Fonte única em `packages/design-tokens/src/brand.ts`; os PNGs são gerados (`pnpm --filter @habits/design-tokens brand`), nunca editados à mão.
- **Ícone do app**: marca sobre `night-bg`, sem texto. Android: ícone adaptativo com fundo `night-bg` e a marca dentro da zona segura (cabe em máscaras redondas); ícone temático com a marca em branco.
- **Abertura**: só a marca, centralizada sobre `night-bg`, sem texto (nada troca de fonte); no Android 12+ cabe no círculo da splash.
- **Notificação**: marca branca na barra de status, acento `night-accent`.
- **Web**: favicon com a marca num quadrado arredondado `night-bg` (visível em abas claras e escuras), ícones da PWA e do iPhone sobre `night-bg`, e um ícone "maskable" para o Android.

## Movimento

- Só `transform` e `opacity`; preferencialmente CSS; nenhuma biblioteca de animação.
- Hover/foco: 120-200 ms, `ease-out`. Nada de várias peças animando ao mesmo tempo: na grade, uma lente desliza (120 ms) em vez de cada célula crescer.
- Entrada da grade: uma varredura da semana atual para o passado, 220 ms por célula e 6 ms por coluna (≤ ~540 ms), uma vez por ano exibido, cancelada por qualquer interação.
- Confirmação: pulso de `scale` de ~300 ms ao marcar um hábito (checkbox e célula de hoje).
- `prefers-reduced-motion: reduce` = **nenhuma** animação (classes `motion-safe:` e `usePrefersReducedMotion`).

## Teclado

- Heatmap: grade com setas, Home/End e Enter (ver "Grade").
- Tela de um dia aberta pelo heatmap: **Esc** volta ao histórico; **←/→** vão ao dia anterior/próximo (até hoje+7, os dias da prévia em somente leitura). Nada disso age com diálogo ou calendário aberto (o Esc fecha só ele) nem com foco num campo.
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
- **Heatmap**: colunas = semanas, células de 28 dp em passo de 32, rolagem horizontal abrindo na semana atual. **Consultar um dia** (2.10.0, o equivalente ao hover do web): segurar um quadrado mostra um balão acima do dedo com a data e o resultado ("Qui, 8 de out" / "3 de 5 · 60%"), em `night-surface-overlay` com borda `night-border` e setinha; arrastar sem soltar troca o dia (a grade não rola enquanto segura); soltar só fecha. Toque rápido continua abrindo o dia. Os 7 dias da prévia (2.14.0) usam o mesmo toque e o mesmo balão ("Dia futuro", sem conteúdo) e abrem o dia em somente leitura, também offline. Para leitor de tela, **um elemento por semana** ("Semana de 4 a 10 de outubro"): deslizar para cima/baixo escolhe o dia, toque duplo abre.
- **Adiar** (2.16.0): na folha do menu, a visão "Adiar" troca o conteúdo da mesma folha (atalhos de 56 dp, seletor de datas, efeito, "Adiar"); a prévia de 7 dias ganha o `⋮` só nas linhas que podem ser adiadas (sem toque longo: as linhas da prévia não são alvo de marcar).
- **Menu de ações** (2.15.0; desde 2.16.1 em toda tela de dia): `⋮` na ponta de cada linha e toque longo de 1 s na linha abrem a mesma folha, na aba Hoje e nos dias abertos pelo Histórico, inclusive os da prévia (ver "Menu de ações do hábito"); o toque curto continua marcando.
- **Descartar alterações** (2.16.2): nas folhas ("Novo hábito", "Editar hábito" do menu) o aviso é um cartão centralizado `night-surface-overlay` dentro da mesma janela da folha (nunca dois Modals); nas telas `habit/new` e `habit/[id]`, a seta do cabeçalho e o voltar do Android (botão e gesto) param antes de sair e mostram o mesmo cartão. Ao abrir, o teclado fecha (não cobre os botões) e o TalkBack começa em "Continuar editando"; botões de 44 dp que descem para duas linhas com fonte grande. A alça das folhas é só visual: não há arrastar para baixo.
- **Folha de descrição** (2.14.1): folha inferior `night-surface` com alça, nome em `DisplayText` (2 linhas), corpo que rola sozinho entrando com fade de 150 ms e, embaixo, fixo, o divisor e "Abrir descrição completa" (ver "Resumo da descrição"). Com "remover animações", a folha aparece sem deslizar e o corpo sem fade.
- **Safe areas**: Android é edge-to-edge; telas usam `Screen` (safe area em cima nas abas, teclado empurra o conteúdo). O brilho do fundo passa por baixo da barra de status.
- **Háptico**: `selection` ao marcar/desmarcar um hábito; nunca em rolagem, navegação ou carregamento.
- **Movimento**: Reanimated no thread de UI, só `transform` e `opacity`, nenhum `setState` por quadro. Toques frequentes (marcar, abrir dia) têm só retorno curto (≤ 150 ms ou nada); abas nunca deslizam. Varredura de entrada e pulso como em "Movimento". Preferência "remover animações" do sistema (`AccessibilityInfo`) = nenhuma animação.
- **Fontes**: números, ano, títulos de painel e marca em Bricolage Grotesque (`DisplayText`, arquivos locais carregados por JS); texto na **fonte do sistema** (Roboto). Tudo acompanha a escala de fonte do Android; só rótulos minúsculos de grade (mês, dia da semana) têm teto de crescimento para não sair do espaço.
- **Cores fora do NativeWind** (`boxShadow`, gradiente, ícones, navegação): sempre de `@habits/design-tokens` (`nightColors.*`), alpha só com o helper sobre um token.

| Fazer no celular                                         | Evitar no celular                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ação diária ao alcance do polegar, sem trocar de tela    | Botão importante no canto superior                                                                 |
| Realce no toque no lugar do hover                        | Depender de hover ou de toque longo para descobrir algo (o toque longo do menu é só atalho do `⋮`) |
| Gradiente e sombra do próprio React Native (vão por OTA) | Módulo nativo para enfeite (gradiente, blur, SVG): exige build novo                                |
| Um elemento acessível por grupo com rótulo útil          | Centenas de elementos soltos para o TalkBack                                                       |
| Splash até fonte e dados estarem prontos                 | Tela branca ou texto trocando de fonte depois de aparecer                                          |

## Fazer / evitar

| Fazer                                                       | Evitar                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Deixar o heatmap ser a peça mais clara da tela              | Roxo em fundos, bordas e ícones decorativos                             |
| Números grandes na fonte de exibição, rótulo em frase curta | Cartões iguais em série, gradientes de enfeite, sombras cinza genéricas |
| Um brilho fixo e sutil no fundo                             | Imagens pesadas, fontes de CDN, novas dependências de animação          |
| Estados vazios que convidam a agir                          | Rótulos em caixa alta, "→" em botões, meta-texto com "·"                |
| Frases em sentence case, pt-BR                              | Cores soltas (hex, `violet-500`) no código de app                       |
