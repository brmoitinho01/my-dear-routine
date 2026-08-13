# F8.1-C — Painel executivo de KPIs na Home (v1.0)

## Escopo
Uma única capacidade nova: painel executivo de KPIs na primeira página (`/`), consolidando
todas as empresas/unidades visíveis ao perfil. Nenhuma migration, nenhum dado alterado.

## Arquivos
- `src/lib/gmos/executive-kpis.ts` — regras puras (status, resumo, agrupamento, formatação, filtro, última medição).
- `src/lib/gmos/executive-kpis-data.ts` — leitura Supabase/RLS.
- `src/components/gmos/executive-kpi-dashboard.tsx` — UI do painel.
- `src/lib/gmos/executive-kpis.test.ts` — 22 testes puros.
- `src/routes/_authenticated/index.tsx` — integração e hierarquia da Home.

## Fonte oficial dos KPIs
Somente `kpis`, `kpi_measurements`, `strategic_plans` e o escopo de empresas/unidades já
resolvido por `fetchWorkspaceOptions()` (`companies` + `business_units`). `strategy_business_fact_values`
(Retrato do negócio) **não** é usado como KPI: é outro conceito.

## Regra de última medição
`period_end DESC`, empate por `created_at DESC`, empate final por `id DESC` (`pickLatestMeasurement`).
A seleção é feita em TypeScript sobre as linhas que a RLS retornou — determinística e testada.

## Regra de meta por `direction`
- `higher_better`: `on_target` se `latestValue >= targetValue`.
- `lower_better`: `on_target` se `latestValue <= targetValue`.
- `range`: `on_target` se `targetMin <= latestValue <= targetMax`.
- `range` sem min **ou** max ⇒ `no_target`; `higher/lower` sem `targetValue` ⇒ `no_target`.
- sem valor ⇒ `no_measurement`. O valor `0` é medição válida.

## Meta ≠ validação
A situação contra a meta é factual e independente do status da medição. A validação
(`validated` / `pending` / `rejected`) é exibida como informação secundária
("Medição pendente de validação"). Uma medição pendente mostra valor e comparação,
mas nunca é apresentada como número homologado.

## Ausência deliberada de heurísticas
Não existe faixa amarela, tolerância de 90%/95%, "quase meta", benchmark, ranking nem
classificação de empresas como boas/ruins. Só quatro estados objetivos.

## Permissões e RLS
- O painel só é buscado e renderizado quando `can("dashboard.group")` é verdadeiro.
- Nenhuma policy de `kpis` / `kpi_measurements` foi ampliada; nenhuma RPC criada.
- Cliente publishable no browser; nunca service role. RLS é a autoridade final.
- Painel é somente leitura: não permite registrar nem validar medições.

## Empresa/unidade sem KPI
Unidades do escopo selecionado aparecem sempre, com
`Nenhum KPI cadastrado nesta unidade.` — a lacuna de gestão fica visível.
Grupo inteiro sem KPI ⇒ empty state neutro orientando o cadastro no Planejamento.

## Competência
Cabeçalho mostra `Dados até <mês/ano>` usando a competência máxima visível, sem afirmar que
todos os KPIs estão atualizados. Sem lógica de "atrasado" inventada.

## Hierarquia da Home
1. Painel executivo de KPIs · 2. Destaque por perfil e Jornada Estratégica · 3. Método ·
4. Consolidado / Por empresa · 5. Estrutura do Grupo (cadastros) por último.

## Dados reais
Nenhum `INSERT`, `UPDATE` ou `DELETE` foi executado. Os dados da RM Mineração
(9 KPIs, 54 medições) permanecem intactos. Nada foi publicado.