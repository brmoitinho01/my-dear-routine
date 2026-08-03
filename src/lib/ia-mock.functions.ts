import { createServerFn } from "@tanstack/react-start";

// TODO (próxima fase): substituir respostas mock por chamadas reais ao
// Lovable AI Gateway (process.env.LOVABLE_API_KEY).

type IaKind = "gerar_checklist" | "revisar_checklist" | "sugerir_plano" | "resumo_diario";

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const runIaMock = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: IaKind; prompt?: string }) => input)
  .handler(async ({ data }) => {
    await wait(600);
    switch (data.kind) {
      case "gerar_checklist":
        return {
          title: "Sugestão de checklist gerado pela IA (mock)",
          items: [
            "Conferir temperatura de geladeiras (crítico, foto)",
            "Higienizar bancadas e utensílios",
            "Verificar validade dos insumos (crítico)",
            "Conferir uniformes e EPIs da equipe",
            "Checar funcionamento dos equipamentos",
          ],
        };
      case "revisar_checklist":
        return {
          summary:
            "Revisão automática (mock): 2 itens podem ser desmembrados, 1 item está duplicado e 3 itens não exigem foto mesmo sendo críticos.",
          suggestions: [
            "Separar 'limpeza geral' em itens específicos por área.",
            "Remover item duplicado de 'temperatura'.",
            "Marcar itens críticos como 'foto obrigatória'.",
          ],
        };
      case "sugerir_plano":
        return {
          what: "Padronizar conferência de temperatura a cada 2 horas",
          why: "Reduzir risco de perda de insumos e contaminação cruzada.",
          how: "Criar planilha de registro + alerta no checklist de cada turno.",
          when_due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        };
      case "resumo_diario":
        return {
          summary:
            "Resumo do dia (mock): 87% dos checklists concluídos, 3 NCs abertas (1 crítica em Cozinha), 2 planos de ação em andamento. Atenção para fechamento do Bar pendente.",
          highlights: [
            "NC crítica: temperatura da geladeira 2 da cozinha acima do padrão.",
            "Fechamento do Bar não finalizado às 23h.",
            "Salão: 100% dos checklists concluídos.",
          ],
        };
    }
  });
