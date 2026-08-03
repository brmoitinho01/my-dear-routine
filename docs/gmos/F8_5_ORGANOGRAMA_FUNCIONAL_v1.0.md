# F8.5 — Organograma funcional e validação de responsabilidades (v1.0)

## Objetivo

Transformar o organograma em ferramenta de governança: quem ocupa cada cargo, a quem
responde, qual o propósito da função, quais responsabilidades/autoridade/entregas existem,
em qual escopo atua e quais itens reais do GMOS estão atribuídos ao ocupante.

Nada é preenchido automaticamente. Nenhuma pessoa, cargo, chefia ou atribuição é
inventada ou sugerida pelo sistema.

## Conceitos (não confundir)

- **Pessoa (`org_people`)**: ser humano real do Grupo. Pode existir sem login.
- **Posição (`organizational_positions`)**: cargo/função com propósito, responsabilidades,
  autoridade de decisão, entregas-chave, escopo e chefia.
- **Papel de acesso (RBAC: `roles`/`user_role_assignments`)**: o que o usuário PODE fazer no
  sistema. É independente do organograma e continua sendo a única fonte de autorização.
- **Responsabilidade operacional**: itens reais atribuídos via `owner_user_id` em objetivos,
  KPIs, planos de ação e modelos de rotina. Só aparece quando a pessoa tem `user_id` vinculado.

## Modelo de dados (migration aditiva F8.5)

- `org_people`: `organization_id`, `home_scope_id`, `user_id` (nullable), `full_name`,
  `work_email`, `employee_code`, `status active|inactive`, auditoria. Índice único parcial
  garante um único vínculo por usuário na organização.
- `organizational_positions`: `scope_id`, `parent_position_id`, `title`, `purpose`,
  `responsibilities_text`, `decision_authority_text`, `key_deliverables_text`,
  `expected_headcount > 0`, `status`, `sort_order`, auditoria. Guard `f85_position_cycle_guard`
  impede autoc chefia, ciclos e pai de outra organização.
- `position_assignments`: `position_id`, `person_id`, `assignment_type primary|acting|support`,
  `start_date`, `end_date`, `status active|ended`, `notes`. Guard `f85_headcount_guard` impede
  ultrapassar `expected_headcount` (apenas `primary` consome vaga) e datas inválidas; índice
  único parcial garante uma única titularidade ativa por pessoa.
- Sem DELETE físico: posições e pessoas são inativadas; atribuições são encerradas.

## Segurança

- RLS habilitada nas três tabelas, com GRANT explícito para `authenticated` e `service_role`.
- Leitura por `structure.read` no escopo do registro (herança de escopo preservada);
  escrita/encerramento por `structure.manage`. Nenhuma policy ampla para `authenticated`.
- `structure.manage` concedida a `group_owner` e `group_admin`.
- Funções de guard são `SECURITY DEFINER` com `search_path` fixo e sem EXECUTE para
  `public`/`anon`/`authenticated`.

## Camada de regras — `src/lib/gmos/org-chart.ts`

Funções puras: `buildOrgTree`, `flattenTree`, `positionDefinitionCompleteness`,
`validateOrgChart`, `responsibilitySummary`, `orgSummary`, `matchesFilters`,
`orgManagementActions`.

Códigos estáveis de validação: `position.vacant`, `position.over_headcount`,
`position.no_parent`, `position.scope_mismatch`, `person.without_primary`,
`person.multiple_primary`, `definition.purpose`, `definition.responsibilities`,
`definition.authority`, `definition.deliverables`.

Ausência de objetivos/KPIs/ações/rotinas **não** é erro: aparece como informação de
governança, pois funções de suporte podem não ter itens estratégicos vinculados.

## Experiência `/organograma`

- Visível com `structure.read`; item "Organograma" na navegação ao lado de "Estrutura" e
  CTA em `/estrutura`.
- Indicadores: posições ativas, ocupadas, vagas, pessoas sem posição, funções incompletas.
- Busca por pessoa/cargo e filtros por escopo, status e situação (ocupado, vago, incompleto).
- Lista (padrão, melhor em telas pequenas) e Árvore com conectores CSS simples.
- Detalhe da posição: escopo, chefia, propósito, responsabilidades, autoridade, entregas,
  ocupantes, subordinados diretos, responsabilidades reais no GMOS com links para
  `/planejamento`, `/planos-de-acao` e `/rotinas`, e alertas de validação.
- Seção "Pessoas sem posição definida" — nunca encaixadas artificialmente na árvore.
- Gestão (posição, pessoa, atribuição, substituição, chefia) apenas com `structure.manage`
  no escopo; sem permissão a tela é somente leitura.
- Pessoa sem `user_id`: "Sem acesso vinculado" e nenhum item executável do GMOS.

## Integração com o planejamento

Nesta etapa os seletores de responsável não foram refatorados. Uma evolução futura poderá
filtrar responsáveis por posição/escopo. Hoje o organograma apenas reflete os vínculos
existentes por `owner_user_id` e destaca pessoa com itens atribuídos e sem titularidade.

## Procedimento de implantação real

1. Cadastrar as posições.
2. Definir propósito, responsabilidades, autoridade e entregas-chave.
3. Cadastrar as pessoas.
4. Atribuir posições (titular, substituto, apoio).
5. Revisar as lacunas apontadas na tela.
6. Vincular usuários somente para quem precisa executar no GMOS.

## Validação

- Tabelas criadas vazias; nenhuma pessoa/cargo/atribuição criada automaticamente.
- Guards verificados: autochefia, ciclo, headcount excedido, segunda titularidade ativa e
  `end_date < start_date` são rejeitados.
- Contagens de planejamento, ações e rotinas permanecem inalteradas.
- `bunx tsgo --noEmit` limpo; `bunx vitest run` com 89 testes aprovados (14 novos em
  `src/lib/gmos/org-chart.test.ts`); `bun run build` concluído.
