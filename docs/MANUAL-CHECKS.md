# Manual checks

Device and browser checks that automated tests do not cover, per version, newest first. Each list assumes the version is deployed in the order its [CHANGELOG](../CHANGELOG.md) entry gives and that the phone (Ajustes) shows that version. Use test habits: the owner's phone holds real data. Before any adb tap, confirm the app is in the foreground. Open items are tracked in the [roadmap](ROADMAP.md).

To simulate dates locally: `pnpm --filter api db:seed:local --today <YYYY-MM-DD>` with a development build on the local API (or the PC's date for the web); for the cron, `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/15+*+*+*+*&time=<ms>"`.

## 2.16.2: confirm before discarding changes

Pending, after the deploy (web, then the OTA; JS only, same fingerprint `9fc2aad…` before and after on Windows; the API carries only the version). Confirm in Ajustes that the phone runs 2.16.2. Use test habits (do not touch real data). The sheets have no drag to dismiss (the handle is only drawn), so "arrastar para baixo" does not apply. Implementation: `features/habits/use-discard-guard.ts`, `ui/confirm-dialog.tsx`, `BottomSheet` `overlay`, `usePreventRemove` in `habit-screens.tsx`.

The four ways in: (A) Hoje > "Novo hábito" (sheet); (B) Hábitos > "Novo hábito" (screen `habit/new`); (C) "⋮" (or 1 s hold) on a row > "Editar hábito" (sheet); (D) Hábitos > a card (screen `habit/[id]`), also "Editar" on the habit page.

1. Without changes, every exit closes at once, no question: A and C with "Fechar", a tap outside the sheet, the Android back button and the back gesture (check once with 3-button navigation and once with gestures, Settings > Display > Navigation bar); B and D with the header arrow, the back button and the back gesture.
2. With changes (type one letter in the name), every exit above shows "Descartar alterações?" with "Continuar editando" and "Descartar" (amber, never red); the sheet or screen stays behind it.
3. "Continuar editando": back to the form, the letter is still there. "Descartar": the sheet closes / the screen goes back, nothing is saved (the list does not change); opening again starts empty (A, B) or with the saved values (C, D).
4. Only one weekday changed (A, B: untoggle Monday) and leave: the question appears. Toggle it back and leave: closes at once. Type a name and erase it, or type only spaces: closes at once.
5. In C/D, change the repetition kind and switch back to the original, then leave: closes at once.
6. With the question open: press back (and the gesture) again: only the question closes (= "Continuar editando"); never two questions, the sheet never closes under it. Double tap "Descartar" quickly: one close only (no double back on B/D).
7. Keyboard open in the name field, then back (A, C: the first back may only close the keyboard; the next one asks): the question appears with the keyboard closed and both buttons visible.
8. Save with changes (Criar hábito / Salvar), and in D "Arquivar" / "Desarquivar" / "Apagar hábito": they close without the question.
9. "Adiar" (from "⋮") with a date chosen: "Fechar" or back closes without the question.
10. Font at the maximum: title and text whole, the buttons stay 44 dp and wrap to two lines without cutting. TalkBack: when the question opens it lands on "Continuar editando" and reads the question as its hint; the swipe reaches the title, "Descartar"; nothing behind the card is reachable.
11. "Remove animations" on: the question appears without fading or zooming; off: a short fade and zoom (~150 ms).
12. Airplane mode: everything above works the same (nothing needs the network); a discarded change never shows up as pending.

## 2.16.1: actions menu on every day screen

Pending, after the deploy (web, then the OTA; JS only, same fingerprint; the API carries only the version). Confirm in Ajustes that the phone runs 2.16.1. Use test habits (do not touch real data).

1. Web: open a past day from the heatmap (`/day/…`): every row has "⋮"; the right click inside a row opens the same menu ("Editar hábito", "Arquivar"/"Desarquivar", the description; no "Adiar" on a past day); neither marks the habit; the checkbox stays locked until "Editar este dia". The same on today opened from the heatmap and on a preview day (no "Arquivar" there; "Adiar" only on the rows that can move). The home "Hoje" panel still has no "⋮" and the right click there is the browser's.
2. Phone, Histórico: open a past day: tap "⋮" and hold a row for 1 s (light haptic): the sheet opens, the row is not marked; a short tap on a locked row does nothing, on an unlocked one it marks.
3. Phone, a preview day: every row has "⋮"; holding a row for 1 s shows the press highlight, a haptic and the sheet; a short tap does nothing; a single-date habit offers "Adiar", a weekday habit only "Editar hábito" and the description.
4. "Arquivar" from a past day opened from Histórico: the toast with "Desfazer", the row keeps its place with "Arquivado"; the preview days lose it; "Desfazer" brings it back.
5. TalkBack on a preview row: the row reads its name and badges; "Mais opções de …, botão" right after.

## 2.16.0: postponing an occurrence

Pending, after the deploy (backup, `db:migrate:remote` with `0008`, API, web, then the OTA; same fingerprint `9fc2aad…` before and after on Windows). Confirm in Ajustes that the phone runs 2.16.0 **before** postponing anything. Use test habits (do not touch real data); the dev seed has "Pagar conta (teste)" (days of the month, on the reference day) and "Consulta no dermatologista" (single date in 2 days).

1. A single date: "⋮" → "Adiar" → "Daqui a 1 semana": the effect says "O dia … deixa de contar este hábito (sem falha)", the row leaves today, "Adiado para …" shows below the list and in the toast with "Desfazer"; on the new day (Histórico, preview day) the row says "Adiado de …"; the heatmap's original day has no failure.
2. Postpone the same occurrence twice: the dialog warns "Este é o último adiamento"; on the next day "Adiar" stays, disabled, with "Limite de 2 adiamentos atingido" (TalkBack reads it).
3. "Desfazer" in the toast: the habit is back on its day and the slot is free again.
4. A days-of-month habit on the 20th: the date picker stops at the 19th of the next month; "Uma semana depois" past the next occurrence is disabled with the reason.
5. Miss the new date (simulate with a habit due today, postponed to tomorrow, then wait or check on the web with a later date): the failure is on the new date, never the original, and "Atrasado desde … · adiado" shows from the next day for 15 days.
6. Airplane mode: postpone, see it at once, reconnect on the same day and on the next day: it syncs (judged by the day it was made); "Falhas" stays empty.
7. Two devices (phone and web) postponing the same occurrence: the second one fails ("A ocorrência mudou em outro aparelho.") and the screen goes back to the server's date.
8. Morning digest at 09:00 and the reminder: they name the habit on the new date, not on the original one (a single date tomorrow is announced the day before its new date).
9. An older build (2.15.0) against the new API: it keeps showing the habit and its failure on the original day (known divergence until the OTA), nothing breaks; after updating, the first sync pulls everything again once.

## 2.15.0: habit actions menu

Pending, after the deploy (web, then the OTA; same fingerprint `9fc2aad…` before and after with `@expo/fingerprint` on Windows; the API carries only the version). Confirm in Ajustes that the phone runs 2.15.0. Use test habits (do not touch real data).

1. Web, `/today`: every row has "⋮" at the end; clicking it opens the menu under it (name, "Editar hábito · Vale para todos os dias", "Ver descrição completa" only with a description, "Arquivar" in amber); right click inside a row opens the same menu at the pointer, outside rows the browser menu; neither marks the habit. Keyboard: Tab to "⋮", Enter/Space, arrows, Esc back on the button. In the history (the home "Hoje" panel, a day opened from the heatmap, a preview day) there is no "⋮" and the right click is the browser's.
2. Phone, Hoje: tap "⋮": the sheet opens, the habit is not marked; a short tap on the row still marks it.
3. Hold a row for 1 s: the row is highlighted while held, a light haptic and the sheet open; lifting does not mark. Lifting before 1 s marks as usual. Scrolling the list from a row never opens the sheet.
4. "Editar hábito" on a habit with completions: the sheet becomes the form with its data; change the repetition: the confirmation about past days appears; save: still on the same day, the list updates; Histórico shows the recalculated days (completed days keep counting).
5. "Arquivar": the sheet closes, "Hábito arquivado · … Hoje e o histórico continuam no mapa." with "Desfazer"; the row stays today with "Arquivado" and the menu offers "Desarquivar"; tomorrow (strip or preview) no longer shows it. "Desfazer" within 6 s brings it back.
6. Airplane mode: edit a name and archive a habit; both show at once (pending changes); back online they sync and the web shows them.
7. Hoje strip, a past day (locked): "⋮" and the long press work, the checkbox still does not. Histórico, open a past day and a preview day: no "⋮", and holding a row does nothing. (Superseded by 2.16.1: the menu now shows on every day screen.)
8. Overdue and "Com prazo" rows: long badges and the "⋮" never overlap (also with a long name).
9. Font at the maximum: the sheet items and the "⋮" stay whole; TalkBack: "Mais opções de …, botão", the sheet starts on its title, closing returns to "⋮".
10. "Remove animations": the sheet appears without sliding (also "Novo hábito"); the row highlight never animates.

## 2.14.1: description quick look

Pending, after the deploy (web, then the OTA; same fingerprint `9fc2aad…` before and after with `@expo/fingerprint` on Windows; the API carries only the version). Confirm in Ajustes that the phone runs 2.14.1. Not yet checked on a device. On the local API, the test habits "Ler um capítulo do livro de cabeceira antes de dormir, sem celular por perto (teste)" (rich Markdown, long name) and "Água curta (teste)" (one line) exist in the dev database; create similar ones on a test habit otherwise.

1. Hoje, the note icon of a habit with a **short** description: the sheet shows the name (display face), the whole text in a lighter grey with bold in white, **no fade**, then a thin divider and "Abrir descrição completa" with an arrow, at the bottom, reachable with the thumb.
2. A **long** description (more than 4 lines): the last ~2 lines fade into the sheet; the action stays below the divider, not faded.
3. **Complex Markdown** (list, link, "> citação", `código`, "## título", a 60-letter word and a long URL): bullets violet, the link violet and underlined (opens the browser), the unsupported marks literal, the long word and URL break inside the sheet (nothing cut at the right edge).
4. **Long name** (three or more lines' worth): two lines with "…"; TalkBack reads the whole name as a header.
5. Tap "Abrir descrição completa": the press highlight shows, the sheet closes and the habit screen opens; on it the description reads in white with roomier lines than before, the list and link as in the sheet.
6. **Font at the maximum** (then back to 1.15): the name stays at two lines, the body scrolls inside the sheet, the divider and action stay visible at the bottom; nothing overlaps the close button.
7. **Remove animations** on: the sheet appears without sliding and the body without fading; off: it slides up and the body fades in (~150 ms).
8. **Small screen** (Screen zoom at the maximum): the same as item 6; the sheet never covers the status bar.
9. TalkBack: "Fechar", the name (header), the body, the links ("link") and "Abrir descrição completa, botão, Abre a página do hábito"; the "•" is not read.
10. Web, quick checks: the popover at 1440, 768 and 390 px, Tab goes from the body's links to the footer (focus ring inside the card), hover tints the footer and nudges the arrow (no nudge with OS reduced motion).

## 2.14.0: preview of the next 7 days

Pending, after the deploy (web, then the OTA; same fingerprint `43e73b2…` before and after on Windows; the API carries only the version). Confirm in Ajustes that the phone runs 2.14.0. Not yet checked on a device. To simulate dates locally: `pnpm --filter api db:seed:local --today <date>` with a development build on the local API, or the system date of the PC for the web.

1. Web (desktop): Histórico opens with today and the 7 dashed squares near the right edge (no color, no dot); hovering one shows only the date and "Dia futuro"; from the 8th day to December 31 the squares stay faint and inert (no tooltip, no link). The legend ends with "Futuro".
2. Web: click a dashed square: "Dia futuro, somente leitura", the planned habits without checkboxes, a task due that day with "Vence neste dia"; a day with nothing says "Nada programado para este dia". "Próximo dia" and → stop at today + 7; typing `/day/<today + 8>` says "Este dia ainda está longe".
3. Web, keyboard: Tab into the grid, → and ↓ reach the dashed days (focus and tooltip visible), Enter opens them.
4. Phone, Histórico: the grid opens with today and the 7 dashed squares in view (the current week visible); a tap opens the day read only (no footer); holding one shows the bubble "Dia futuro" and sliding sweeps the others; from the 8th day to December 31 the squares stay faint, a tap does nothing and the bubble hides over them.
5. Phone: the dashed outline draws as dashes on Android (with the rounded corners) and is visible on the dark background.
6. Year turn (seed with `--today 2026-12-28`): only now the grid continues into January, with the "jan" label; 04/01 opens, 05/01 does not exist. On 2026-12-24 (preview ending on 31/12) the grid stops at December as usual.
7. Today on a Sunday (seed with a Sunday): six dashed days in the current column and one in the next.
8. Airplane mode: open a dashed day; the list shows at once (local data).
9. System font at the maximum (then back to 1.15): the legend wraps without cutting "Futuro"; the read-only list reads well. TalkBack: a week reads "… dia futuro, toque para ver o que está programado" for a dashed day; double tap opens it.
10. Reduced motion ("Remover animações", then back): no sweep, the dashed cells appear at once; on the web, OS reduced motion the same.
11. The numbers do not change: "Esta semana", "Este mês", "Sequência atual" and "Melhor em" are the same before and after the update (compare with the web on 2.13.0 or a screenshot taken before).

## 2.13.0: deadline tasks

Pending, after the deploy (API, web, then the OTA). Confirm in Ajustes that the phone runs 2.13.0 **before** creating the first task (the app pulls everything again once after the update). To simulate dates locally: `pnpm --filter api db:seed:local --today <date>` (the seed's "Entregar relatório (teste)" is due 7 days after it).

1. Hoje > "Novo hábito" > "Até uma data": no "Começa em", the calendar starts today and stops 2 years ahead, the summary says "Pode ser concluído até DD/MM. Se passar do prazo, fica atrasado.". Create one due in 7 days: it shows under "Com prazo", after the day's habits, with "Até DD/MM · faltam 7 dias" (TalkBack reads it with the name).
2. Mark it today: haptic, the progress goes from "N de M" to "N+1 de M+1"; "Desfazer" brings it back. Marked, open another day on the strip and come back: it shows only today (checked), and not the next day.
3. Create another due tomorrow: "Vence amanhã"; the next day "Vence hoje" (warning tone) and it counts in today's progress; leave it open: the day after, it is first under the overdue habits with "Atrasado desde DD/MM", and the due day on the heatmap keeps the failure.
4. Mark the overdue task: it counts today, the due day still shows the failure; open the due day from Histórico: "Já concluída em DD/MM", no checkbox, even after "Editar este dia".
5. Hábitos: the card shows the deadline icon, "Até DD/MM" and the badge; done tasks move to "Passados"; editing a task whose due date passed shows the date read only with the note.
6. Airplane mode: create a task and mark it; both show at once and sync back online; the web shows the same.
7. Digest at 09:00: on the day before, "Vence amanhã: X."; on the day, "Vence hoje: X." (with names hidden: "Você tem compromissos hoje/amanhã."). The reminder counts the task only on its due date or while overdue.
8. Old app (2.12.x, before the OTA) against the new API: it keeps syncing and never shows the tasks (nothing breaks).

## 2.12.0: habit descriptions

Pending, after the deploy (backup, `0007`, API, web, then the OTA). Confirm in Ajustes that the phone runs 2.12.0. Use a test habit.

1. Hábitos > edit a habit: "Descrição (opcional)" below the name, several lines, the hint about **negrito**, _itálico_, lists and links. Save a description with a bold word, a list of 6 items and a link.
2. Hoje: the habit's row shows the description's first line under the name (one line, cut with …) and the note icon at the right; other habits show neither. The dev seed's "Rotina da noite (teste)" has a long description ready. Tapping the row still marks it; tapping the icon does not.
3. The icon opens a sheet: the name, the first lines (bold in bold, a bulleted list) and "Abrir descrição completa"; the link opens the browser.
4. "Abrir descrição completa": the habit screen (header panel with the week strip and badge, "Descrição" panel, both fading in; nothing moves with "Remover animações") with the whole text and "Editar" in the footer; "Editar" opens the edit screen with the text.
5. A short description (one line): the sheet shows it whole, without "Abrir descrição completa". (Superseded by 2.14.1: the action is always present.)
6. TalkBack: the icon reads "Descrição de …", the row still reads as a checkbox.
7. Airplane mode: change a description; it shows at once and syncs back online; the web shows it.

## 2.11.0: deleting habits

Pending, after the deploy (API, web, then the OTA). Confirm in Ajustes that the phone runs 2.11.0. Use a test habit (do not touch real data).

1. Hábitos: the edit screen of an active habit has "Arquivar" and no "Apagar". Archive the test habit: its edit screen now has "Desarquivar" and "Apagar hábito".
2. "Apagar hábito": the alert says the history leaves the map; "Cancelar" (and Android back) keeps it.
3. "Apagar": back on Hábitos, the habit is gone from "Arquivados", a toast "Hábito apagado" with "Desfazer"; Histórico no longer counts it on its past days.
4. "Desfazer" within 6 s: it is back in "Arquivados" and the past days count it again.
5. Airplane mode: delete, see it gone at once (pending change), reconnect: it syncs and the web no longer lists it.
6. Web: "Arquivados" shows a trash button per habit; the dialog starts on "Cancelar", Esc closes it; deleting removes it, "Desfazer" restores it.

## 2.10.1: new habit sheet and keyboard

1. Hoje > "Novo hábito", tap the name field: the keyboard opens, the sheet stays below the status bar with its title, and the name field is visible right above the form; the rest of the form scrolls inside the sheet above the keyboard (no gap the size of the navigation bar).
2. Close the keyboard: the sheet goes back to its normal height, above the navigation bar. Hábitos > "Novo hábito" (a full screen) works as before.

## 2.10.0: heatmap day preview

Pending, after the deploy (API and web carry only the version, then the OTA; same fingerprint as 2.9.0, so the phone needs the 2.9.0 build first). Confirm in Ajustes that the phone runs 2.10.0.

1. Histórico: a quick tap on a past square still opens that day; tapping today still opens Hoje.
2. Hold a past square (~0.3 s): a bubble appears above the finger with the date ("Qui, 8 de out") and "N de M · P%"; the square gets the violet ring. Lift: the bubble closes and no day opens.
3. Hold and slide across the grid, also sideways over other weeks: the bubble and the ring follow the day under the finger; the grid does not scroll meanwhile. Over future days or the padding days before January 1 the bubble hides and comes back on a valid day.
4. Normal swipes (without holding) still scroll the year horizontally, and a quick swipe never shows the bubble.
5. Top rows (Sunday, Monday): the bubble stays whole, over the year arrows. First and last visible columns: the bubble stays inside the screen, the arrow still points at the square.
6. A day without habits says "Nenhum hábito previsto"; with a habit chosen in the filter chips: "Feito", "Não feito" or "Sem previsão".
7. Reduced motion on: the bubble appears without fading. TalkBack: the grid reads and opens days as before (the bubble is not announced).
8. Font scale 1.15 and 1.3: the bubble's two lines fit.

## 2.9.0: app icon and splash

Pending, on a **new production build** (the fingerprint changed; an OTA cannot bring native icons). After the deploy: `gh workflow run mobile-build -f profile=production`, install the APK over the current one (same package: data kept), confirm in Ajustes that it runs 2.9.0.

1. Launcher: the icon is the four squares on the dark background (no "habits" text), whole in round, squircle and square shapes (change the icon shape in the launcher settings if available).
2. Themed icons on (Android 13+, Wallpaper & style > Themed icons): the four squares in the system tint.
3. Cold start (swipe the app away, open it): the splash shows only the mark on the dark background, then the app fades in; no white flash, no old "habits" text.
4. "Enviar notificação de teste" in Ajustes: the status bar shows the white squares; the notification accent is violet.
5. Recent apps and app info show the new icon.
6. Web: the tab shows the new favicon (light and dark browser themes); install the PWA on Android (new icon, no white border) and "Adicionar à Tela de Início" on the iPhone.

## 2.8.0: overdue habits

Pending, after the deploy (API, web, then the OTA: no migration, same fingerprint `e40c9bd…` before and after on Windows). Confirm in Ajustes that the phone runs 2.8.0. To simulate dates locally: `pnpm --filter api db:seed:local --today <date>` (the seed's single date is two days after it, so it is overdue from the third day) or a habit created days before; for the cron, `curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/15+*+*+*+*&time=<ms>"`.

1. Create "Pagar condomínio" on day 15 (Dias do mês) before the 15th and do not mark it. On the 16th, Hoje (phone) and the web's /today and "Hoje" panel show it first with "Atrasado desde 15/10" (icon and text); TalkBack reads "Pagar condomínio, atrasado desde 15 de outubro". Past days on the strip and the heatmap, and tomorrow, show no badge; weekday habits never have one.
2. Mark it on the 16th: haptic, it stays first, checked, with the badge; "Desfazer" brings it back to pending. Mark it again: the heatmap keeps the failure on the 15th and counts it as done on the 16th (the cell gets brighter); the progress goes from "N de M" to "N+1 de M+1".
3. Leave it unmarked past the limit (seed, or a habit whose day was 16 days ago): on day O+16 it is gone from Hoje and the 15th keeps the failure. With only overdue habits pending today, the list shows "Nada previsto para hoje além dos atrasados." instead of a "0 de 0" bar.
4. A habit on days 10 and 20 missed on the 10th: on the 20th only the normal item (no badge); on the 21st the badge says "desde 20/10".
5. Airplane mode: mark and unmark an overdue habit on the phone; it updates at once and the indicator shows pending changes; back online it syncs and the web shows the same.
6. Digest at 09:00 with an overdue habit: "… 1 atrasado: Pagar condomínio." With "Mostrar nomes nas notificações" off: "Você tem … 1 hábito atrasado." (no names). The reminder at its time counts it ("Você tem N hábitos pendentes hoje.") and stops counting it once marked.
7. Old app (2.7.x, before the OTA) against the new API: it keeps syncing and shows no overdue habits (nothing breaks); its notifications may already mention them.

## 2.7.0: history insights, pickers, motion

Pending, after the deploy (OTA, same fingerprint). Confirm in Ajustes that the phone runs 2.7.0.

1. Tab bar: the labels are whole, with room above the Android buttons (also with gesture navigation).
2. New habit: the name placeholder fits one line; "Dias do mês" shows the calendar-style grid (full width), and several neighbor days chosen side by side stay separate squares; "Todo ano" is a month calendar with arrows (December → January wraps), only that month's days (February up to 29), and the chosen day stays marked only in its month.
3. Press a button, a chip, a strip day or a habit card: it sinks a little; with reduced motion nothing moves.
4. Hoje: switching days on the strip fades the list in. Hábitos: "Reordenar" and move a habit: the cards slide (the order only sticks once the API with migration 0006 is deployed).
5. Histórico: the filter row, then the grid; a chip makes the grid, the numbers and the sections about that habit (the title shows its name); leaving the tab resets it.
6. Below the grid: "Tendência" (12 bars, one sentence), "Destaques" (only what applies), "Por hábito" (a tap filters and scrolls up; "Ver todos" with more than 5). The screen still reads as the heatmap first; check at font scale 1.15 and 1.3.

## 2.6.0: tabs, Hoje strip, every screen on night

Pending, after the deploy (API and web carry only the version, then the OTA update; no new build: same fingerprint). Confirm in Ajustes that the phone runs 2.6.0.

1. Cold start opens **Hoje**: the strip of the last 7 days (today with a dot), today's list in a panel, "Novo hábito" fixed at the bottom; the tab bar shows Hoje · Histórico · Hábitos with a pill behind the active icon.
2. Mark and unmark on Hoje: haptic, the box pulses (check) or dips (uncheck), the fill fades; "Desfazer" appears just above "Novo hábito", never over it.
3. Strip: tap yesterday: its list opens read-only with "Editar este dia" in the footer; confirm, mark, undo, "Concluir edição". Tap another day: locked again. Switch to Histórico and back: the strip is on today again.
4. A reminder or digest notification (or one sent before the update): a tap opens the Hoje tab, also from a cold start.
5. Histórico: tapping a past day opens its day screen (back returns); tapping today switches to Hoje.
6. Hábitos: cards with the week strip and "Hoje"/"Próxima"; "Reordenar" shows up/down arrows; move a habit, finish: the new order shows on Hoje and, after a sync, on the web. Offline too (airplane mode), then it syncs.
7. The gear on each tab opens Ajustes with a back arrow; Ajustes looks as before (only colors), sign-out and the time zone still work.
8. Login (sign out on a test account or check after a session expires): the mark, the glow and the "Entrar" title.
9. Big system font and reduced motion, as in 2.5.0 (items 6 and 7 below), on every tab.

## 2.5.0: redesigned home screen

Pending, after the deploy (API and web carry only the version, then the OTA update; no new build: same fingerprint). Confirm in Ajustes that the phone runs 2.5.0.

1. Cold start (swipe the app away, open it): the splash stays until the screen is ready, no white flash, the year and the numbers already in Bricolage (no font swap).
2. Heatmap: opens on the current week near the right edge; scroll horizontally to January and back, smooth; month and weekday labels line up with the rows (Saturday included).
3. Touch: press a past day and hold: the violet ring marks it; slide away and release: nothing opens; tap it: its day screen opens. Today opens "Hoje" (`/day/hoje`). Future days do nothing. Tap the gap between two cells: one of them opens, never nothing.
4. "Hoje" panel: mark a habit: haptic, checkbox pulse, today's cell pulses and changes level, the numbers update, "Marcado: …" with "Desfazer" for about 6 s; "Desfazer" restores it. "Abrir o dia de hoje" opens the day with "Próximos" and "Novo hábito".
5. Airplane mode: mark and unmark in the panel; everything updates at once and the indicator shows "Offline · N pendentes". Network back: "Sincronizando…" then "Sincronizado às HH:MM", and the web shows the change.
6. Big system font (Settings > Display > Font size at the maximum): the four numbers stay in one row (labels may take two lines), the sync state wraps below the mark, the grid labels stay inside their rows, nothing cut off or overlapping.
7. Reduced motion (Settings > Accessibility > Visibility enhancements > Remove animations): no sweep on opening, no pulse, no skeleton breathing; turning it off while the app runs brings the motion back.
8. TalkBack: the grid reads "Semana de 4 a 10 de outubro" and the chosen day ("sexta-feira, 9 de outubro de 2026 (hoje): 3 de 5 hábitos concluídos (60%)"); swipe up/down changes the day (skips future days); double tap opens it. Panel rows read as checkboxes.
9. Small screen (or Settings > Display > Screen zoom at the maximum): the panel still starts in the lower part, the arrows and rows keep 44 dp targets.
10. Other screens with the new palette (not redesigned): day (rows, past-day notice, "Editar este dia" sheet), habits (list, form chips, calendar, time picker), Ajustes (switches, time zone, sign-out sheet), sync screen and login: all text readable, pressed/disabled/error states visible, the primary button text white on violet, the check icon dark on green.
11. Year arrows: a past year opens at December, only "Melhor em" follows the year; the other numbers stay on today.

## 2.4.0: web redesign and habit order

Web, after the deploy (backup, `0006`, API, web, then the OTA).

1. Install the PWA (`pnpm --filter web build` + `preview`): the display font works offline; the installed PWA uses the `night-bg` theme color.
2. 390 px: the "Hoje" panel goes below the grid, a tap opens the day, 44 px targets; every screen at 390 px.
3. Keyboard on the heatmap: one Tab into the grid, arrows, Home/End, Enter; focus and tooltip visible.
4. OS reduced motion: no sweep, no pulse.
5. Check/uncheck in the panel with "Desfazer"; year arrows (only "Melhor em" follows the year).
6. Esc and ←/→ on a day opened from the heatmap, also with the "Editar este dia" dialog open (Esc closes only the dialog).
7. Create and edit a habit with the calendar; settings: "Hoje é …", "Usar o do dispositivo" saves at once, "Sair" asks first; login screen.
8. Habit order: drag with mouse and touch, the keyboard on the handle (with a screen reader if possible), the up/down buttons and the phone menu; the new order on the day view, the "Hoje" panel and the mobile after a sync; a new habit goes last.

## 2.3.0: editing past days

Pending, after the deploy (API, web, then the OTA update; no new build: the fingerprint did not change). Confirm in Ajustes that the phone runs 2.3.0.

1. Open a day 5 days back from the heatmap: read-only, "Editar este dia" in the footer (one thumb, never over the last habit). Tap it: the sheet asks "Editar o dia DD/MM?"; TalkBack starts on "Cancelar". Cancel (button, Android back and tap outside): still locked.
2. Confirm "Editar": "Editando dia passado" on top, the footer says "Concluir edição", checkboxes work without asking again. Mark and unmark; the heatmap cell and the progress follow. "Concluir edição" locks it again.
3. Repeat with a day 25 days back. A day 40 days back: no button, "Fora do período de edição de 30 dias". Tomorrow: read-only, no button. A past day without habits: no button.
4. Unlock a day, go back to the heatmap and open it again (or another day): locked. Unlock, send the app to the background and come back: still unlocked. Close the app and reopen: locked.
5. Desfazer: on today and on an unlocked past day, mark a habit: "Marcado: …" with "Desfazer" for about 6 s (TalkBack announces it); "Desfazer" restores it. Two quick changes: only the last one can be undone.
6. Airplane mode: unlock a day 10 days back, mark it and undo something; the indicator shows pending changes. Reconnect: it syncs and the web shows the same day.
7. Against the 2.2.0 API (before deploying it, or a local API at the old commit): mark a day 10 days back; the change ends in "Falhas" with "Fora do período editável (a partir de DD/MM)" and the day returns to the server state; after the API deploy, "Tentar de novo" applies it.
8. Web (desktop and phone): the same flow with the dialog (Esc closes, Tab stays inside, focus starts on "Cancelar"); reload the page while unlocked: locked again.

## 2.2.0: flexible schedules and morning digest

Pending, after the deploy (migration, API, web, then the OTA update; no new build: the fingerprint did not change). Confirm in Ajustes that the phone runs 2.2.0 before step 2.

1. Old app with the new API: before the OTA reaches the phone, the 2.1.0 app keeps syncing (habits of new types are simply absent) and the web still works. After the update, the app pulls everything again once and the new habits appear.
2. Create "Consulta no dermatologista" as a single date two days from today (web or phone). The next day at 09:00 (until 12:00) the digest says "Amanhã: Consulta no dermatologista"; on the day, at 09:00, it is in "Hoje: …". Tapping opens today (`/today` on the web, `/day/hoje` on the phone).
3. Create "Trocar filtro" every 8 days and "Pagar condomínio" on day 20: the form shows the summary and the next date; the day views and "Próximos" show them on the right days; the habits list shows "A cada 8 dias" and "Todo dia 20".
4. Create a habit offline (airplane mode) with a single date tomorrow; reconnect before 09:00 and the digest includes it. Created and not synced, it is not in the digest (documented).
5. Reminder time: only 00, 15, 30 and 45 can be chosen; the reminder arrives within 15 minutes of it, only with pending habits, and not when turned on more than an hour late.
6. Turn off "Mostrar nomes nas notificações": the digest says "Você tem compromissos hoje" (no names), also on the lock screen and on the web.
7. Change the time zone in Ajustes (e.g. to Asia/Tokyo): the digest and the reminder follow the new zone's 09:00 and reminder time.
8. Edit the repetition of an older habit: a confirmation appears; past completed days keep counting in the heatmap.
9. A single date in the past moves to "Passados" (collapsed) and is not archived.

## 2.1.0: new habit from today

Pending, on the 2.1.0 production build (the fingerprint changed once):

1. Today shows "Novo hábito" fixed at the bottom; the list scrolls above it and the last habit and its checkbox stay tappable. Reachable with one thumb.
2. Tap it: the sheet slides up, the name field has the focus and the keyboard pushes the sheet up (the "Criar hábito" button stays visible). All seven days start selected.
3. Type a name and press Enter on the keyboard: the habit is created and appears unchecked in today's list; the sheet closes.
4. Create a habit without today's weekday: the sheet closes, a toast says "Hábito criado. Aparece em: …", and today's list does not change. It appears on its weekdays from today on, never on past days.
5. Empty name, only spaces, or no day: inline errors, nothing created. Close with "Fechar", by tapping outside and with Android back.
6. Double tap "Criar hábito" quickly: only one habit appears (also on the web after syncing).
7. TalkBack: focus stays inside the sheet while it is open, and returns to "Novo hábito" when it closes.
8. Open a past day from the heatmap: no "Novo hábito".
9. Airplane mode: create a habit, see it in the list and mark it; the indicator shows pending changes. Turn the network back on: it syncs, and the web shows the habit and the completion.
10. No habits at all (new account): today's empty state says "Nenhum hábito ainda" and points at the footer button.

## 2.0.0: offline sync

On a development build with the API migrated (`db:migrate:local` or `db:migrate:remote`):

1. Initial sync: sign in with an empty device and watch "Baixando seus dados…" with progress; with airplane mode on (or the API down) the gate says so, and recovers by itself when the network/API returns.
2. Airplane mode: mark and unmark habits, create and edit a habit; the screens update at once and the indicator shows "Offline · N pendentes".
3. Close the app with pending changes (swipe it away), reopen offline: the changes are still there and still pending.
4. Reconnect: the indicator goes to "Sincronizando…" then "Sincronizado às HH:MM", and the web shows the changes.
5. Two devices (or the phone and the web) changing the same day: the one that syncs last wins; afterwards both show the same state, with one completion row on the server.
6. Wrong phone clock (turn off automatic time, move it a few days): marking "today" ends in "Falhas" as out of the editable period when outside the window, and the sync screen warns about the clock.
7. Sign out with pending changes: the warning lists them; "Sincronizar e sair" sends them first; "Sair mesmo assim" wipes them. Signing in as another user never shows the previous user's data.
8. Background: with the app closed, change something on the web and wait (at least 15 minutes, OS-scheduled); reopening shows it without a visible sync. In a development build, Sincronização > "Rodar a tarefa em segundo plano (debug)" runs the task at once (`triggerTaskWorkerForTestingAsync`).
9. Failures: create a habit offline, keep the phone offline for more than 30 days (or move the clock): the creation and its completions appear grouped in "Falhas"; "Descartar" removes them all.
