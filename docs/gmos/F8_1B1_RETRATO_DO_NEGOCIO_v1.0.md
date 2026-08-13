# F8.1-B1 — Retrato do Negócio (dados universais + fatos derivados)

## Escopo
Nova etapa **Retrato do negócio** na Jornada Estratégica (agora 7 etapas), entre
"Perfil da empresa" e "Maturidade de gestão".

## Banco (aditivo, já aplicado)
- `strategy_fact_definitions` — biblioteca versionada (31 definições universais + setoriais).
- `strategy_business_snapshots` — retrato por unidade/período, com `review_status`.
- `strategy_business_fact_values` — valor por fato, com `confidence` (exato/estimativa/não disponível).
- Triggers `f81_touch_authorship` (autoria server-side) e `f81_invalidate_snapshot_review`
  (editar fato essencial invalida a revisão).
- RPC `f81_review_business_snapshot` — **única porta de revisão**; valida os blocos essenciais.

## Domínio puro
- `src/lib/gmos/business-facts.ts` — normalização, validação, métricas derivadas,
  cobertura e readiness. "Não tenho este dado" nunca vira zero.
- `src/lib/gmos/recommendation-context.ts` — contrato v1 para a futura IA (F8.1-B2),
  allowlist de códigos, determinístico, sem PII/RBAC/auditoria e sem benchmark.

## Regras
- Cobertura (%) é **confiança de dados**, nunca qualidade da empresa, e nunca bloqueia a Jornada.
- A etapa só conclui com snapshot + blocos essenciais respondidos + revisão confirmada pelo banco.
- Contrato legado sem retrato informado permanece neutro (não bloqueia, não infla progresso).

## Validação
232 testes verdes (18 novos). Typecheck e build sem erros. Nenhum dado da RM alterado.
Nada publicado.
