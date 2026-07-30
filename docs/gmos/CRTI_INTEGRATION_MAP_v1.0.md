# Mapa de integração CRTI → GMOS (v1.0 — preparação)

Status: **preparação documental**. Nenhuma integração automática, credencial ou job foi criado.
Enquanto a integração não existir, todo KPI alimentado manualmente continua obrigado a declarar
fórmula, fonte, responsável e periodicidade (regra dos KPIs do GMOS).

## Princípios
1. O CRTI é **fonte de origem**, não fonte de verdade do GMOS: cada carga gera medição rastreável em `kpi_measurements`.
2. Nenhuma carga cria KPI automaticamente. O KPI é cadastrado antes, com regra de cálculo declarada.
3. Toda carga registra evento em `audit_events` com `source = 'integration'` e `correlation_id` do lote.
4. Cargas são idempotentes por (`kpi_id`, `period_start`, `period_end`).
5. Medição integrada entra como `pending` e só vira `validated` após validação humana com responsável identificado.

## Mapeamento de campos

| Campo GMOS | Tabela | Origem esperada no CRTI | Situação |
| --- | --- | --- | --- |
| `kpi_measurements.kpi_id` | `kpi_measurements` | correspondência por código de indicador CRTI | **a validar** — falta a tabela de correspondência código CRTI ↔ `kpis.id` |
| `kpi_measurements.period_start` / `period_end` | `kpi_measurements` | competência do relatório CRTI | **a validar** — confirmar fechamento (mês civil x ciclo operacional) |
| `kpi_measurements.value` | `kpi_measurements` | valor consolidado do indicador | **a validar** — unidade e casas decimais |
| `kpi_measurements.source_evidence` | `kpi_measurements` | identificador do relatório/extração CRTI | **a validar** — formato do identificador |
| `kpi_measurements.status` | `kpi_measurements` | sempre `pending` na carga | definido |
| `kpi_measurements.business_unit_id` | `kpi_measurements` | unidade operacional CRTI | **a validar** — correspondência unidade CRTI ↔ `business_units` |
| Produção beneficiada (t) | `kpis` + medições | apontamento de produção | **a validar** |
| Custo operacional por tonelada (R$/t) | `kpis` + medições | custo por centro de custo ÷ produção | **a validar** — definir centros de custo elegíveis |
| Disponibilidade física dos equipamentos (%) | `kpis` + medições | horas disponíveis ÷ horas calendário | **a validar** — tratamento de paradas programadas |
| Consumo específico de combustível | `kpis` + medições | abastecimento por equipamento | **a validar** |
| Horas de parada não programada | `kpis` + medições | ordens de manutenção | **a validar** |

## Lacunas conhecidas (bloqueiam a automação)
- Não há credencial, endpoint ou contrato de dados CRTI aprovado.
- Não existe tabela de correspondência de códigos de indicador e de unidades.
- Regras de fechamento de competência e de arredondamento não estão homologadas.
- Política de reprocessamento (correção retroativa de competência já validada) não definida.

## Caminho técnico previsto (quando aprovado)
1. Rota pública verificada por assinatura em `src/routes/api/public/` recebendo o lote CRTI.
2. Validação de payload, resolução de `kpi_id` e `business_unit_id` pela tabela de correspondência.
3. Upsert idempotente em `kpi_measurements` com `status = 'pending'`.
4. Evento de auditoria por lote e por medição rejeitada.
5. Fila de validação humana no GMOS antes de qualquer efeito em semáforo executivo.
