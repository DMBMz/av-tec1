import { RepositorioArquivo } from '../storage/RepositorioArquivo';
import { Lote } from '../domain/Lote';
import { Equipamento } from '../domain/Equipamento';
import { StatusRastreamento } from '../domain/enums';

export class ServicoRelatorio {
  private repositorio: RepositorioArquivo;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public gerarRelatorioPorOrganizacao(
    organizacaoId: string,
    periodo?: { inicio: Date; fim: Date }
  ): string {
    const orgData = this.repositorio.carregarEntidade('organizacoes', organizacaoId);
    if (!orgData) {
      throw new Error(`Organização '${organizacaoId}' não encontrada.`);
    }

    const todosLotes = this.repositorio.listarEntidades('lotes').map(l => Lote.fromJSON(l));
    const lotesOrg = todosLotes.filter(l => {
      if (l.getOrganizacaoId() !== organizacaoId) return false;
      if (!periodo) return true;
      const t = l.getDataEntrada().getTime();
      return t >= periodo.inicio.getTime() && t <= periodo.fim.getTime();
    });

    let pesoTotalGeral = 0;
    let equipamentosTotalGeral = 0;

    let out = `\n======================================================\n`;
    out += `RELATÓRIO DE SUSTENTABILIDADE POR ORGANIZAÇÃO\n`;
    out += `Organização: ${orgData.razaoSocial} (CNPJ: ${orgData.cnpj})\n`;
    out += `Período: ${periodo ? `${periodo.inicio.toISOString().split('T')[0]} até ${periodo.fim.toISOString().split('T')[0]}` : 'Histórico Completo'}\n`;
    out += `------------------------------------------------------\n`;

    if (lotesOrg.length === 0) {
      out += `Nenhum lote registrado para esta organização no período informado.\n`;
    } else {
      for (const lote of lotesOrg) {
        const peso = lote.calcularPesoTotal();
        const qtd = lote.getEquipamentos().length;
        pesoTotalGeral += peso;
        equipamentosTotalGeral += qtd;
        out += `* Lote [${lote.getId()}] - NF: ${lote.getNotaFiscal()} | Data: ${lote.getDataEntrada().toISOString().split('T')[0]} | Status: ${lote.getStatusProcessamento()}\n`;
        out += `  Qtd Equipamentos: ${qtd} | Peso: ${peso} kg\n`;
      }
      out += `------------------------------------------------------\n`;
      out += `TOTAL CONSOLIDADO:\n`;
      out += `Lotes Processados: ${lotesOrg.length}\n`;
      out += `Total de Itens Destinados: ${equipamentosTotalGeral} unidades\n`;
      out += `Massa Total Recuperada/Desviada de Aterro: ${pesoTotalGeral.toFixed(3)} kg\n`;
      out += `Créditos de Carbono Estimados: ${(pesoTotalGeral * 0.0014).toFixed(3)} tCO2e\n`;
    }
    out += `======================================================\n`;
    return out;
  }

  public gerarRelatorioPorStatus(status: StatusRastreamento): string {
    const todosEquip = this.repositorio.listarEntidades('equipamentos').map(e => Equipamento.fromJSON(e));
    const filtrados = todosEquip.filter(e => e.getStatusRastreamento() === status);

    let out = `\n======================================================\n`;
    out += `RELATÓRIO OPERACIONAL - EQUIPAMENTOS EM STATUS: ${status}\n`;
    out += `Total Encontrado: ${filtrados.length} unidade(s)\n`;
    out += `------------------------------------------------------\n`;

    if (filtrados.length === 0) {
      out += `Nenhum equipamento neste status operacional.\n`;
    } else {
      for (const eq of filtrados) {
        out += `* [${eq.getCodigoBarrasInterno()}] ${eq.getTipo()} - ${eq.getMarca()} ${eq.getModelo()} (${eq.getAnoFabricacao()})\n`;
        out += `  Estado Físico: ${eq.getEstadoFisico()} | Peso: ${eq.getPesoQuilogramas()} kg | Lote: ${eq.getLoteId()}\n`;
        out += `  Depreciação Calculada: ${(eq.calcularDepreciacao() * 100).toFixed(1)}%\n`;
      }
    }
    out += `======================================================\n`;
    return out;
  }

  public gerarRelatorioFinanceiro(periodo?: { inicio: Date; fim: Date }): string {
    const orgs = this.repositorio.listarEntidades('organizacoes');
    let receitaRecorrenteContratos = 0;

    for (const org of orgs) {
      if (org.contratoVigente && org.contratoVigente.valorMensal) {
        receitaRecorrenteContratos += org.contratoVigente.valorMensal;
      }
    }

    const todosEquip = this.repositorio.listarEntidades('equipamentos').map(e => Equipamento.fromJSON(e));
    let valorEstimadoRecuperacaoMateriais = 0;

    // Estimativa de valor por kg de matéria-prima recuperável (cobre, alumínio, ouro residual)
    for (const eq of todosEquip) {
      const taxaRecuperacao = 1.0 - eq.calcularDepreciacao();
      valorEstimadoRecuperacaoMateriais += eq.getPesoQuilogramas() * 12.50 * Math.max(0.2, taxaRecuperacao);
    }

    let out = `\n======================================================\n`;
    out += `RELATÓRIO FINANCEIRO & VALOR RESIDUAL (GREENCODE)\n`;
    out += `Data de Emissão: ${new Date().toISOString().split('T')[0]}\n`;
    out += `------------------------------------------------------\n`;
    out += `Receita Recorrente Mensal (MRR de Contratos): R$ ${receitaRecorrenteContratos.toFixed(2)}\n`;
    out += `Total de Organizações Clientes: ${orgs.length}\n`;
    out += `Equipamentos Catalogados no Inventário: ${todosEquip.length}\n`;
    out += `Valor Estimado de Matérias-Primas Secundárias: R$ ${valorEstimadoRecuperacaoMateriais.toFixed(2)}\n`;
    out += `======================================================\n`;
    return out;
  }

  public gerarRelatorioAuditoria(): string {
    const journals = this.repositorio.listarJournals();
    let out = `\n======================================================\n`;
    out += `RELATÓRIO DE AUDITORIA E JOURNAL DE TRANSAÇÕES (IMUTÁVEL)\n`;
    out += `Total de Transações Registradas: ${journals.length}\n`;
    out += `------------------------------------------------------\n`;

    for (const j of journals.slice(-15)) { // exibe as últimas 15
      out += `[${j.getTimestamp().toISOString()}] ${j.getOperacao()} na Entidade '${j.getEntidade()}' | Operador: ${j.getUsuarioResponsavel()}\n`;
      out += `  ID Transação: ${j.getId()}\n`;
    }
    out += `======================================================\n`;
    return out;
  }
}
