# F12.1-C2B — Completude oficial do F8, Home dinâmica e fechamento da continuidade

## 1. Fonte única da validação formal
`f8_plan_completeness` (RPC oficial, delegando a `f8_plan_completeness_core`) é a
ÚNICA fonte da validação formal do Planejamento. O frontend a consome via
`fetchCompleteness(planId)` em `src/lib/gmos/strategy.ts` e apenas propaga os
fatos: `ready`, `issues` (com `code`/`section`/`message`), `status`,
`reviewStatus` e `counts`.

Nenhuma regra do frontend recalcula `ready`, e nenhuma tela usa
`issues.length === 0` como substituto de `ready`.

## 2. Por que NÃO existe percentual de completude do F8
A função oficial não devolve percentual. Inventar um número seria criar regra de
negócio no frontend. Portanto:

- o percentual exibido é sempre `derived.percent` — progresso de construção da
  **Jornada Estratégica** (6 gates substantivos, teto de 95% enquanto o F8 tem
  pendências);
- o contrato `officialPlanCompleteness` permanece `null` por definição;
- a validação do F8 aparece separadamente como estado binário + pendências:
  `Sem pendências de completude` ou `N pendência(s)`.

Microcopy fixa na etapa Review:
> O percentual acima representa a construção da Jornada Estratégica. A validação
> abaixo vem diretamente das regras oficiais do Planejamento.

## 3. Estados e próximas ações após a aplicação
A máquina central `deriveJourneyStatus` continua **pura** e recebe apenas o fato
`officialPlanReady`:

| Situação | Fase | Percentual |
| --- | --- | --- |
| Nenhum item aplicado | fases da Jornada | conforme gates |
| Aplicado, sem pendentes, `ready` false/null | `formalizing_plan` | máx. 95% |
| Aplicado, sem pendentes, `ready` true | `complete` | 100% |

`complete` significa **Jornada estruturada + F8 sem pendências de completude**.
NÃO significa aprovado nem ativo — `status` e `reviewStatus` são exibidos
separadamente.

A ação do workflow oficial é uma função pura pequena,
`deriveOfficialPlanAction(completeness)`, composta na UI:

| `ready` | `reviewStatus` / `status` | Ação | Destino |
| --- | --- | --- | --- |
| false | — | `Resolver pendências no Planejamento` (motivo = 1ª issue oficial, ou `Existem N pendências formais no plano.`) | `/planejamento` |
| true | `draft` | `Enviar plano para revisão` (sem chamar RPC automaticamente) | `/planejamento` |
| true | `in_review` | `Acompanhar revisão do plano` | `/planejamento` |
| true | `approved` e status ≠ active | `Ativar ciclo no Planejamento` | `/planejamento` |
| true | status `active` | `Abrir ciclo ativo` | `/planejamento` |

## 4. Etapa Review da Jornada
Bloco `Validação formal do Planejamento`:
- badge `Sem pendências de completude` quando `ready`;
- badge `N pendência(s)` quando não;
- até 3 issues oficiais com `message` e seção; excedente como
  `+ N outras pendências`;
- `status`/`reviewStatus` exibidos explicitamente;
- CTAs `Abrir Planejamento` + ação oficial;
- sem plano: `A unidade ainda não possui ciclo de planejamento.`;
- falha da RPC: `Validação do Planejamento indisponível` (a Jornada continua).

Nenhuma mensagem inventada substitui a issue do banco.

## 5. Card dinâmico da Home e arquitetura do snapshot
`src/routes/_authenticated/index.tsx` deixou de ter um card estático. O novo
`JourneyCard` representa **apenas a unidade em contexto** e mostra fase humana,
`X% da Jornada estruturada`, maturidade (provisória ou faixa/score), objetivos no
rascunho, já levados ao Planejamento, validação F8 quando há plano, próxima
melhor ação e CTA coerente com essa ação.

Arquitetura, sem segunda máquina de regras:

```text
strategy-journey.ts  fetchJourneySnapshot(businessUnitId)   -> só busca dados
                     Promise.all(perfil, questões, respostas,
                       sinais, decisões, decisões de KPI, prioridades, ciclo)
                     + fetchCompleteness(plan.id) SOMENTE se houver plano
journey-snapshot.ts  summarizeJourneySnapshot(input)         -> PURA
                     calculateMaturityScore + deriveJourneyStatus
                     + deriveOfficialPlanAction  -> { maturity, derived,
                       officialAction, completeness, cta }
index.tsx            1 useQuery por unidade em contexto (sem waterfall)
```

Regras de acesso: RLS + `public.has_permission` continuam a autoridade. Sem
`strategy.read` no escopo atual nenhuma query F12 é disparada; sem unidade o card
mostra `Selecione uma unidade para acompanhar a Jornada Estratégica.`

Erros/carregamento: o card carrega isolado; erro F12 não derruba o restante da
Home (`Não foi possível carregar o estado da Jornada` + tentar novamente/abrir);
erro apenas da completude mantém a Jornada visível.

## 6. Diagnóstico da Jornada (F12) x Diagnóstico do Planejamento (F8)
- **Diagnóstico da Jornada (F12)**: sinais guiados + `diagnosis_reviewed_at`,
  invalidado por trigger quando as seleções mudam.
- **Diagnóstico do Planejamento (F8)**: `plan_diagnostics`, contexto, SWOT,
  premissas — pendências oficiais (`diagnosis.missing`, `diagnosis.context`).

A UI nomeia os dois de forma distinta. **Nenhuma automação** copia sinais do F12
para o SWOT do F8, e nada preenche responsáveis, baseline ou metas: continua
decisão humana no Planejamento.

## 7. Escopo desta fase
- **Zero migrations.** Fase de leitura/integração: nenhuma alteração de schema,
  nenhuma nova RPC, nenhuma permissão nova.
- Nenhum dado oficial da RM criado ou alterado; `f12_apply_strategy_draft` não
  foi executada no ciclo real; nada publicado.
- Testes: 14 novos (validação formal + resumo compartilhado), total **187**.
