# Plano faseado — Meu Querido (Rotina & Padrão)

Sequência priorizada para evoluir do MVP atual (~25% do escopo) até cobrir os 17 módulos. A ordem privilegia: (1) fechar lacunas críticas do que já existe, (2) destravar valor diário (temperatura, validade, estoque), (3) só depois entrar nos módulos satélites (delivery, caixa, manutenção).

Cada fase é entregável de forma independente — ao fim de cada uma, o sistema fica utilizável em produção.

---

## Fase 1 — Consolidar o MVP atual (1 ciclo)

Objetivo: tornar o que já existe robusto antes de adicionar novos módulos.

- Frequência configurável por checklist: diária / semanal (dia da semana) / mensal (dia do mês) / sob demanda, com horário limite.
- Geração automática diária das execuções (job baseado em `pg_cron` chamando uma server route em `/api/public/cron/*`).
- Status estendidos de execução: `pendente`, `em_andamento`, `atrasada`, `finalizada`, `com_ressalva`.
- Peso por item + cálculo de ICO (Índice de Conformidade Operacional) por execução, setor e dia.
- Bloqueio de finalização quando item crítico está `nao_conforme` sem plano de ação imediato.
- Notificações in-app (sininho) para: execução atrasada, NC aberta, plano vencendo.
- Log de auditoria genérico (`audit_log` com `actor`, `entity`, `action`, `before`, `after`).

## Fase 2 — Cadastro de processos (POPs)

- Tabelas: `processes`, `process_steps`, `process_indicators`.
- Vínculo de checklist → processo (cada item pode referenciar um POP).
- Tela de leitura do POP a partir do item durante a execução (botão "Ver padrão").
- Tipos de pergunta expandidos: múltipla escolha, numérico (com faixa), texto livre, além de Conforme/NC/NA.

## Fase 3 — Controle de temperatura

- `equipments` (freezers, geladeiras, balcões) com faixa min/max.
- `temperature_readings` (equipamento, valor, foto opcional, usuário, timestamp).
- Alerta automático fora da faixa → cria NC com severidade `alta`.
- Card no Dashboard "Temperaturas do dia" com status por equipamento.

## Fase 4 — Validade de produtos

- `products` (nome, categoria, unidade, validade padrão pós-abertura).
- `product_batches` (lote, validade, setor, status).
- Alerta preventivo (D-3, D-1, vencido) e bloqueio de uso quando vencido.
- Checklist diário de validade gerado automaticamente por setor.

## Fase 5 — Estoque e movimentações

- `stock_items`, `stock_movements` (entrada, saída, perda, transferência, inventário).
- Inventário cíclico com checklist próprio.
- Indicador de ruptura e consumo médio.

## Fase 6 — Produção e ficha técnica

- `recipes` (ficha técnica: ingredientes, rendimento, custo).
- `production_orders` (produção diária de pré-preparados, com responsável e validade gerada).
- Integração com estoque (baixa automática de insumos).

## Fase 7 — Compras e fornecedores

- `suppliers`, `purchase_lists` (gerada a partir de ruptura/consumo).
- Aprovação de compra pelo Gerente; recebimento gera entrada de estoque + checklist de recebimento.

## Fase 8 — Manutenção de equipamentos

- `maintenances` (preventiva agendada / corretiva), vinculadas a `equipments`.
- Geração automática de OS quando NC envolve equipamento.

## Fase 9 — Atendimento, delivery e caixa

- Reclamações de cliente (origem, tipo, resolução, vínculo com NC).
- Checklist de embalagem de delivery + registro de erros por pedido.
- Caixa operacional: sangria, suprimento, divergência de fechamento.

## Fase 10 — Notificações externas e relatórios

- Canal e-mail (Resend) e WhatsApp (provedor a definir) além do in-app.
- Pacote de relatórios exportáveis (PDF/CSV): ICO por setor, NCs por tipo, ranking de colaboradores, temperatura, validade, produção, estoque.
- Biblioteca histórica de evidências (busca por data/setor/item).

---

## Detalhes técnicos transversais

- Todas as novas tabelas seguem o padrão já estabelecido: enums em migration própria, `GRANT` explícito, RLS habilitada, políticas via `has_role()` + `user_in_sector()`.
- Recorrência e alertas: `pg_cron` + server route pública em `/api/public/cron/*` com verificação por segredo no header.
- Validações compartilhadas em `src/lib/validators/` (zod schemas reutilizados client + server fn).
- Cada fase abre uma migration nova e um conjunto de rotas em `src/routes/_authenticated/{modulo}/`.
- ICO calculado em uma view materializada `mv_ico_daily` atualizada por trigger ao finalizar execução.

## O que NÃO entra agora

- Geolocalização do operador (custo/benefício baixo no MVP indoor).
- App nativo — segue como web mobile-first.
- IA Operacional real (segue mock até Fase 10, quando ganha contexto suficiente: POPs, histórico de NCs, indicadores).

---

Quer que eu comece pela **Fase 1** (consolidação) ou prefere pular direto para um módulo específico (ex.: Temperatura, Validade)?
