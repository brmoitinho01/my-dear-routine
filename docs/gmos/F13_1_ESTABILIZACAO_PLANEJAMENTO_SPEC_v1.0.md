# F13.1 — Correção e estabilização do Planejamento Estratégico (ESPECIFICAÇÃO)

Status: **aguardando aprovação**. Nada foi executado: zero migration, zero DML, nada publicado.

## 1. Arquivos que serão modificados

| Arquivo | Mudança |
|---|---|
| `src/components/gmos/diagnosis-tab.tsx` | Deixa de gravar missão/visão diretamente; passa a usar RPCs; bloqueio de ciclo aprovado; aviso de alterações não salvas; justificativa por item |
| `src/components/gmos/strategic-direction-builder.tsx` | Reutilizado dentro da aba Diagnóstico (sem mudar regra) |
| `src/lib/gmos/strategic-analysis.ts` | Normalização de notas/justificativas antes de enviar (`sanitizeAnalysisData`) e detecção de alterações pendentes (`isDirty`) |
| `src/lib/gmos/strategic-analysis.test.ts` | Novos testes (seção 6) |
| `src/lib/gmos/strategy.ts` | Funções `saveDiagnosis`, `saveAnalysis`, `reopenPlanReview` chamando as RPCs |
| `src/routes/_authenticated/planejamento.tsx` | Bloqueio de navegação entre abas com alterações pendentes |
| `docs/gmos/F13_1_ROLLBACK_v1.0.md` | Script de reversão |
| Migration nova (1 arquivo) | SQL da seção 3 |

## 2. Alterações propostas nas tabelas

**`strategic_analyses`** (criada na F13, hoje com 0 linhas)
- Novo trigger `f13_analysis_guard` (BEFORE INSERT/UPDATE):
  - `organization_id`, `business_unit_id`, `plan_id` e `tool_code` **imutáveis** após criação;
  - na inserção, confere que o ciclo pertence à mesma filial e organização (reforça a policy);
  - valida `data.scores`: cada valor deve ser inteiro de 1 a 5; ausência de nota é permitida;
  - valida `data.notes` / `data.labels`: apenas texto, até 1.000 caracteres por item;
  - preenche `updated_by := current_user_id()` em toda atualização e `created_by` na criação (não aceita valor vindo do cliente);
  - bloqueia gravação quando o ciclo está com revisão **aprovada** (mesma regra da missão).
- Nenhuma coluna removida ou renomeada. Nenhuma policy alterada.

**`plan_diagnostics`** (SWOT e Negócio; hoje 0 linhas)
- Novo trigger `f13_diagnostic_lock` (BEFORE UPDATE), executado antes do guard existente: se o diagnóstico ou o ciclo estiver aprovado e o conteúdo mudar, **recusa com mensagem clara** em vez de voltar silenciosamente para rascunho.

**`strategic_plans`** (missão, visão e valores)
- Sem novas colunas: `values_text` já existe.
- Novo trigger `f13_plan_identity_lock` (BEFORE UPDATE), antes do `f8_plan_review_guard`: se `review_status = 'approved'` e missão, visão, valores ou norte mudarem, **recusa** em vez de voltar silenciosamente para rascunho. O guard antigo continua existindo, mas deixa de ser alcançado nesse caso.

**Novas RPCs (SECURITY DEFINER, `search_path = ''`)**
- `f13_save_diagnosis(p_plan_id, p_payload jsonb)` — grava Negócio e SWOT; exige `strategy.manage`; organização e filial vêm do ciclo, nunca do cliente.
- `f13_reopen_plan_review(p_plan_id, p_reason text)` — exige `strategy.approve`; motivo obrigatório (mín. 10 caracteres); volta ciclo e diagnóstico para rascunho e grava evento de auditoria. É a **única** forma de editar um ciclo aprovado.
- Missão, visão e valores passam a ser salvos **somente** pelo assistente guiado já existente (`f8_confirm_structured_direction`), que já recusa ciclo aprovado. A aba Diagnóstico exibe o assistente; o modo manual avançado continua disponível pelo mesmo caminho.

## 3. SQL da migration (proposta, NÃO executada)

```sql
-- F13.1 — estabilização. Aditiva e idempotente.

CREATE OR REPLACE FUNCTION public.f13_plan_is_approved(p_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT review_status = 'approved' FROM public.strategic_plans WHERE id = p_plan_id), false)
$$;
REVOKE ALL ON FUNCTION public.f13_plan_is_approved(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.f13_analysis_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k text; v jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.strategic_plans p
                    WHERE p.id = NEW.plan_id AND p.business_unit_id = NEW.business_unit_id
                      AND p.organization_id = NEW.organization_id) THEN
      RAISE EXCEPTION 'A análise deve pertencer ao mesmo ciclo, filial e organização.';
    END IF;
    NEW.created_by := public.current_user_id();
  ELSE
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.business_unit_id IS DISTINCT FROM OLD.business_unit_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.tool_code IS DISTINCT FROM OLD.tool_code THEN
      RAISE EXCEPTION 'Não é permitido mover a análise para outro ciclo, filial ou ferramenta.';
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;
  IF public.f13_plan_is_approved(NEW.plan_id) THEN
    RAISE EXCEPTION 'Ciclo aprovado: reabra a revisão para alterar as análises.';
  END IF;

  IF NEW.data ? 'scores' THEN
    IF jsonb_typeof(NEW.data->'scores') <> 'object' THEN
      RAISE EXCEPTION 'Formato de notas inválido.';
    END IF;
    FOR k, v IN SELECT * FROM jsonb_each(NEW.data->'scores') LOOP
      IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric NOT IN (1,2,3,4,5) THEN
        RAISE EXCEPTION 'Nota inválida em %: use valores inteiros de 1 a 5.', k;
      END IF;
    END LOOP;
  END IF;
  FOR k IN SELECT unnest(ARRAY['notes','labels']) LOOP
    IF NEW.data ? k THEN
      IF jsonb_typeof(NEW.data->k) <> 'object' OR EXISTS (
           SELECT 1 FROM jsonb_each(NEW.data->k) e
            WHERE jsonb_typeof(e.value) <> 'string' OR length(e.value #>> '{}') > 1000) THEN
        RAISE EXCEPTION 'Textos inválidos ou acima de 1.000 caracteres.';
      END IF;
    END IF;
  END LOOP;

  NEW.updated_by := public.current_user_id();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.f13_analysis_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS f13_analysis_guard_trg ON public.strategic_analyses;
CREATE TRIGGER f13_analysis_guard_trg BEFORE INSERT OR UPDATE ON public.strategic_analyses
  FOR EACH ROW EXECUTE FUNCTION public.f13_analysis_guard();

-- Bloqueio explícito de identidade em ciclo aprovado (nome "a_" garante execução antes do f8_)
CREATE OR REPLACE FUNCTION public.f13_plan_identity_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.review_status = 'approved' AND NEW.review_status = 'approved' AND (
       COALESCE(NEW.mission,'') IS DISTINCT FROM COALESCE(OLD.mission,'')
    OR COALESCE(NEW.vision,'') IS DISTINCT FROM COALESCE(OLD.vision,'')
    OR COALESCE(NEW.values_text,'') IS DISTINCT FROM COALESCE(OLD.values_text,'')
    OR COALESCE(NEW.strategic_north,'') IS DISTINCT FROM COALESCE(OLD.strategic_north,'')) THEN
    RAISE EXCEPTION 'Ciclo aprovado: reabra a revisão antes de alterar missão, visão ou valores.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.f13_plan_identity_lock() FROM PUBLIC;
DROP TRIGGER IF EXISTS a_f13_plan_identity_lock_trg ON public.strategic_plans;
CREATE TRIGGER a_f13_plan_identity_lock_trg BEFORE UPDATE ON public.strategic_plans
  FOR EACH ROW EXECUTE FUNCTION public.f13_plan_identity_lock();

CREATE OR REPLACE FUNCTION public.f13_diagnostic_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (OLD.review_status = 'approved' OR public.f13_plan_is_approved(OLD.plan_id))
     AND NEW.review_status = OLD.review_status AND (
       COALESCE(NEW.context_summary,'') IS DISTINCT FROM COALESCE(OLD.context_summary,'')
    OR COALESCE(NEW.strengths,'') IS DISTINCT FROM COALESCE(OLD.strengths,'')
    OR COALESCE(NEW.weaknesses,'') IS DISTINCT FROM COALESCE(OLD.weaknesses,'')
    OR COALESCE(NEW.opportunities,'') IS DISTINCT FROM COALESCE(OLD.opportunities,'')
    OR COALESCE(NEW.threats,'') IS DISTINCT FROM COALESCE(OLD.threats,'')) THEN
    RAISE EXCEPTION 'Diagnóstico aprovado: reabra a revisão antes de alterar.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.f13_diagnostic_lock() FROM PUBLIC;
DROP TRIGGER IF EXISTS a_f13_diagnostic_lock_trg ON public.plan_diagnostics;
CREATE TRIGGER a_f13_diagnostic_lock_trg BEFORE UPDATE ON public.plan_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.f13_diagnostic_lock();

CREATE OR REPLACE FUNCTION public.f13_save_diagnosis(p_plan_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.strategic_plans%ROWTYPE; v_id uuid;
  f text := 'context_summary,strengths,weaknesses,opportunities,threats';
BEGIN
  SELECT * INTO v_plan FROM public.strategic_plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN RETURN jsonb_build_object('ok',false,'message','Ciclo não encontrado.'); END IF;
  IF NOT public.has_permission('strategy.manage'::public.citext,'business_unit',
                               public.f2_bu_scope_id(v_plan.business_unit_id)) THEN
    RETURN jsonb_build_object('ok',false,'message','Sem permissão para gerir este planejamento.');
  END IF;
  SELECT id INTO v_id FROM public.plan_diagnostics WHERE plan_id = p_plan_id ORDER BY created_at LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.plan_diagnostics (organization_id, business_unit_id, plan_id,
      context_summary, strengths, weaknesses, opportunities, threats, created_by)
    VALUES (v_plan.organization_id, v_plan.business_unit_id, p_plan_id,
      NULLIF(btrim(p_payload->>'context_summary'),''), NULLIF(btrim(p_payload->>'strengths'),''),
      NULLIF(btrim(p_payload->>'weaknesses'),''), NULLIF(btrim(p_payload->>'opportunities'),''),
      NULLIF(btrim(p_payload->>'threats'),''), public.current_user_id())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.plan_diagnostics SET
      context_summary = NULLIF(btrim(p_payload->>'context_summary'),''),
      strengths       = NULLIF(btrim(p_payload->>'strengths'),''),
      weaknesses      = NULLIF(btrim(p_payload->>'weaknesses'),''),
      opportunities   = NULLIF(btrim(p_payload->>'opportunities'),''),
      threats         = NULLIF(btrim(p_payload->>'threats'),''),
      updated_by      = public.current_user_id()
    WHERE id = v_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v_id);
END $$;
REVOKE ALL ON FUNCTION public.f13_save_diagnosis(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f13_save_diagnosis(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.f13_reopen_plan_review(p_plan_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan public.strategic_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.strategic_plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN RETURN jsonb_build_object('ok',false,'message','Ciclo não encontrado.'); END IF;
  IF NOT public.has_permission('strategy.approve'::public.citext,'business_unit',
                               public.f2_bu_scope_id(v_plan.business_unit_id)) THEN
    RETURN jsonb_build_object('ok',false,'message','Somente quem aprova o planejamento pode reabrir a revisão.');
  END IF;
  IF length(btrim(COALESCE(p_reason,''))) < 10 THEN
    RETURN jsonb_build_object('ok',false,'message','Informe o motivo (mínimo de 10 caracteres).');
  END IF;
  IF v_plan.review_status <> 'approved' THEN
    RETURN jsonb_build_object('ok',true,'message','O ciclo já está em edição.');
  END IF;
  UPDATE public.strategic_plans SET review_status='draft', approved_by=NULL, approved_at=NULL WHERE id=p_plan_id;
  UPDATE public.plan_diagnostics SET review_status='draft', approved_by=NULL, approved_at=NULL
   WHERE plan_id=p_plan_id AND review_status='approved';
  INSERT INTO public.audit_events (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (v_plan.organization_id, public.current_user_id(), 'f13.plan.review_reopened',
          'public.strategic_plans', p_plan_id, 'update', 'rpc', jsonb_build_object('reason', btrim(p_reason)));
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.f13_reopen_plan_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f13_reopen_plan_review(uuid, text) TO authenticated;
```

Antes de aplicar, será conferido: (a) as colunas `approved_by/approved_at/updated_by` existem em `plan_diagnostics` e `strategic_plans` (já confirmadas na auditoria); (b) a ordem alfabética dos triggers garante que `a_f13_*` rode antes de `f8_*`; (c) o `f8_plan_review_guard` não é alterado.

## 4. Impacto em permissões e segurança

- **Nenhuma policy criada, removida ou ampliada.** Nenhuma permissão nova no catálogo.
- As RPCs checam `strategy.manage` / `strategy.approve` no escopo da filial e derivam organização/filial do ciclo — o cliente não escolhe escopo.
- `EXECUTE` revogado de `PUBLIC` e `anon`; concedido só a `authenticated`.
- Funções de trigger sem `EXECUTE` público.
- O efeito líquido é **mais restritivo**: impede mover análises, notas inválidas e edição silenciosa de ciclo aprovado.

## 5. Riscos e plano de reversão

| Risco | Mitigação |
|---|---|
| Algum fluxo antigo (assistente F8 oculto) contava com a volta automática para rascunho | Fluxos antigos estão ocultos; o assistente F8 já recusa ciclo aprovado; reabertura explícita substitui o comportamento |
| Ordem de triggers | Nomes `a_f13_*` + teste funcional específico |
| Dados existentes rejeitados pelas novas regras | Hoje: 0 análises e 0 diagnósticos; os triggers só agem em novas gravações |

**Reversão** (`F13_1_ROLLBACK_v1.0.md`): `DROP TRIGGER IF EXISTS` dos 3 triggers e `DROP FUNCTION IF EXISTS` das 6 funções F13.1. Não toca em dados nem em policies; o comportamento volta exatamente ao atual.

## 6. Plano de testes

**Automatizados (vitest)**
1. `sanitizeAnalysisData` remove notas fora de 1–5, não inteiras e não numéricas; mantém itens sem nota.
2. Justificativas e conclusões preservadas e cortadas em 1.000 caracteres.
3. `isDirty` detecta notas, rótulos, justificativas e conclusão alteradas, e ignora ordem de chaves.
4. Médias continuam ignorando notas inválidas (testes atuais mantidos).
5. Regra de bloqueio: com ciclo aprovado, a aba fica somente leitura e exibe "Reabrir revisão" apenas para quem tem `strategy.approve`.

**Funcionais (ambiente isolado de rascunho, sem dados reais)**
Executados em um **draft com banco isolado**, nunca no banco atual:
1. Salvar Negócio/SWOT → recarregar a página → valores iguais.
2. Salvar notas, justificativas e conclusão de cada uma das 7 ferramentas → recarregar → iguais; `updated_by` preenchido.
3. Tentar gravar nota 0, 6, 2.5 e "x" via chamada direta → recusado.
4. Tentar alterar `plan_id`/`business_unit_id` de uma análise → recusado.
5. Ciclo aprovado: editar missão, SWOT ou análise → recusado com mensagem; reabrir sem permissão → recusado; reabrir com motivo → liberado e auditado.
6. Usuário de outra empresa → não vê nem grava (cenário cross-company).
7. Alterar notas e trocar de aba ou recarregar → aviso de alterações não salvas.
8. Gates: prettier, `tsgo --noEmit`, `vitest run`, `build`.
