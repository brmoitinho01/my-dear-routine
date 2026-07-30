# GMOS — Fase 4: Presentation Ready v1.0

## Escopo
Fase exclusivamente de frontend, identidade visual e navegação. Nenhuma migração, política de RLS,
permissão, usuário, dado ou integração foi criada, alterada ou removida. Nenhum número exibido é
simulado: todos vêm de `fetchStructure`, `fetchWorkspaceOptions` e `fetchUnitSummary`, já limitados
pela RLS ao que o perfil autenticado pode ler.

## Identidade
- Marca única GMOS — Grupo Moitinho, com símbolo geométrico local em SVG (`src/components/gmos/gmos-brand.tsx`).
- Paleta executiva: azul-marinho/slate profundo (`--brand`, `--sidebar`), superfícies claras e acento
  teal/esmeralda (`--brand-accent`). Tokens semânticos preservados em `src/styles.css`.
- Toda referência visível a "Daily Restaurant" / "Meu Querido" como identidade do produto foi
  removida. "Meu Querido" permanece apenas como nome de empresa real do Grupo, vindo do banco.
- Titles, descriptions e metadados atualizados por rota, com `robots: noindex` nas telas internas.

## Navegação oficial
1. Apresentação — `/apresentacao`
2. Visão do Grupo — `/`
3. Estrutura — `/estrutura`
4. Planejamento — `/planejamento`
5. Planos de ação — `/planos-de-acao`
6. Rotinas — `/rotinas`
7. Acessos — `/acessos`

Desktop usa sidebar fixa com marca, contexto Empresa/Filial, navegação por ícones e bloco do usuário.
Mobile usa cabeçalho enxuto com menu lateral acessível (Sheet), sem comprimir sete itens em uma barra.
O seletor Empresa/Filial continua sendo apenas preferência de UX; autorização segue em RLS e
`public.has_permission`.

## Roteiro técnico da apresentação
1. **Login** (`/auth`) — tela institucional: marca, proposta "Sistema operacional de gestão do Grupo
   Moitinho", quatro benefícios e aviso de acesso restrito. Nenhuma credencial é exibida.
2. **Apresentação** (`/apresentacao`) — hero com CTAs e botão "Modo apresentação" (tela cheia via API
   do navegador, apenas após clique, com mensagem de fallback quando indisponível).
3. **Fluxo de gestão** — cinco etapas: Planejar, Medir, Agir, Executar, Governar. Cada etapa marca
   "Disponível agora" e leva à rota real correspondente.
4. **Visão real do Grupo** — contagens reais de empresas, filiais, ciclos, objetivos, KPIs, planos,
   rotinas ativas e execuções pendentes; um card por filial com estado "Configurado" (há ciclo) ou
   "Aguardando configuração" (não há). Nenhum score, percentual ou tendência é exibido sem dado.
5. **Mapa de capacidades** — dois blocos visualmente distintos (ver abaixo).
6. **Segurança e governança** — acesso por escopo, menor privilégio, auditoria, histórico preservado,
   isolamento entre empresas, em linguagem executiva.
7. **Encerramento** — CTAs "Abrir o GMOS" e "Configurar próxima empresa"; versão identificada apenas
   como "Fase 4 · Presentation Ready".
8. **Visão do Grupo** (`/`) — consolidado e, para filial sem ciclo, jornada de configuração:
   criar ciclo → definir pilares → objetivos/KPIs → ações/rotinas.
9. **Planejamento → Planos de ação → Rotinas** — CRUDs reais preservados, com confirmações mantidas
   antes de arquivar, cancelar ou pausar.

## Disponível agora
- Multiempresa e seleção de contexto.
- Planejamento estratégico (ciclos, pilares, objetivos).
- KPIs e validação de medições.
- Planos de ação 5W2H.
- Rotinas e execuções com evidências.
- Perfis, escopos, RLS e auditoria.

## Próxima evolução (não implementado)
- Reuniões, atas e decisões.
- Pessoas, posições, competências e PDI.
- Alertas e notificações.
- Execução offline.
- Integrações e cockpit CRTI.
- Cockpit consolidado avançado.

Estes itens aparecem somente sob o rótulo "Próxima evolução", sem link de acesso e sem qualquer
linguagem que sugira funcionamento atual.

## Arquivos
- Novos: `src/components/gmos/gmos-brand.tsx`, `page-header.tsx`, `executive-metric.tsx`,
  `capability-card.tsx`, `presentation-flow.tsx`, `src/routes/_authenticated/apresentacao.tsx`,
  este documento.
- Alterados: `src/components/gmos/app-shell.tsx`, `src/routes/auth.tsx`, `src/routes/__root.tsx`,
  `src/routes/_authenticated/index.tsx`, `estrutura.tsx`, `planejamento.tsx`, `planos-de-acao.tsx`,
  `rotinas.tsx`, `acessos.tsx`, `src/styles.css`.

## Validação
- Typecheck: sem erros.
- Lint nos arquivos tocados: sem erros (apenas avisos pré-existentes de dependências de hooks).
- Build de produção: sem erros.
- Rotas `/`, `/auth`, `/apresentacao`, `/estrutura`, `/planejamento`, `/planos-de-acao`, `/rotinas`,
  `/acessos` respondem 200 no preview.
- Banco inalterado: nenhuma migração, insert, update ou delete foi executado nesta fase.
