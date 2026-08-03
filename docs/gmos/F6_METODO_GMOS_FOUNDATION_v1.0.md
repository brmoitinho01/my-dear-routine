# F6 — Fundação do Método GMOS (v1.0)

## Objetivo
Tornar visível e explícita a arquitetura universal, modular e evolutiva do GMOS, preparando as
próximas fases de banco sem quebrar nenhuma funcionalidade existente.

## Escopo implementado
- Catálogo canônico tipado em `src/lib/gmos/method.ts`: cinco etapas do método, cadeia central,
  quatro níveis organizacionais, quatro maturidades, doze domínios centrais e as seis empresas
  oficiais do Grupo com seus módulos setoriais.
- Nova rota autenticada `/metodo` ("Método GMOS") com visão resumida, fluxo das etapas, cadeia
  central, níveis, maturidades, domínios, cards das empresas, estado honesto de implementação e
  atalhos para rotas reais.
- Navegação reordenada: Painel, Método GMOS, Planejamento, Planos de ação, Rotinas, Apresentação,
  Estrutura, Acessos. Nenhum link removido.
- Bloco somente leitura "Estrutura oficial do Grupo" em `/estrutura`, comparando o catálogo com as
  empresas efetivamente retornadas pela consulta (Cadastrada / Pendente de cadastro).
- Card compacto do Método GMOS no painel inicial, com CTA para `/metodo`.
- Texto da tela de acesso atualizado para comunicar plataforma de governança modular.
- Elite Construção e Incorporação não consta em nenhuma área ativa (código, catálogo ou banco).

## Escopo explicitamente não tocado
Nenhuma migração, escrita no banco, alteração de RLS, permissões, usuários, dados demonstrativos,
secrets, integrações ou publicação. Todas as consultas envolvidas continuam somente leitura.

## Arquivos alterados ou criados
- `src/lib/gmos/method.ts` (novo)
- `src/routes/_authenticated/metodo.tsx` (novo)
- `src/components/gmos/app-shell.tsx`
- `src/routes/_authenticated/estrutura.tsx`
- `src/routes/_authenticated/index.tsx`
- `src/routes/auth.tsx`
- `docs/gmos/F6_METODO_GMOS_FOUNDATION_v1.0.md` (novo)
- `.lovable/plan.md` (marcação do incremento executado)

## Limitações desta fase
- Maturidade e módulos setoriais são conteúdo de catálogo, não configuração persistida por empresa.
- Direcionar e Diagnosticar não possuem entidades no banco; a página é descritiva.
- XRM Construtora, Blue House e Toca Hub aparecem como "Pendente de cadastro" porque ainda não
  existem no banco — o cadastro depende de migração autorizada.
- Reuniões, decisões, revisão estratégica, iniciativas, metas e orçamento seguem inexistentes.

## Próximos passos
1. Persistência de maturidade e módulos ativos por empresa, com feature flags de exibição.
2. Escopo flexível dos ciclos e objetivos entre Grupo, Empresa, Unidade e Área.
3. Identidade estratégica e diagnóstico tipado.
4. Iniciativas e metas por período.
5. Reuniões, decisões, evidências e revisão estratégica.
6. Orçamento essencial e rateio de custos compartilhados do Toca Hub.

## Rollback
Não há alteração de banco. A reversão é feita pelo commit desta entrega: reverter o commit restaura
navegação, `/estrutura`, painel e tela de acesso ao estado anterior e remove `/metodo` e o catálogo.
