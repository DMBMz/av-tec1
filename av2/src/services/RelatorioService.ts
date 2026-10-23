import { prisma } from '../config/prisma';
import { EquipamentoService } from './EquipamentoService';

export class RelatorioService {
  public async relatorioPorOrganizacao(organizacaoId: string) {
    const org = await prisma.organizacao.findUnique({
      where: { id: organizacaoId },
      include: {
        contrato: true,
        lotes: {
          include: {
            equipamentos: true
          }
        }
      }
    });

    if (!org) {
      throw new Error(`Organização '${organizacaoId}' não encontrada.`);
    }

    let pesoTotalGeral = 0;
    let totalEquipamentos = 0;

    const lotesDetalhados = org.lotes.map(l => {
      const pesoLote = l.equipamentos.reduce((acc, eq) => acc + eq.pesoQuilogramas, 0);
      pesoTotalGeral += pesoLote;
      totalEquipamentos += l.equipamentos.length;

      return {
        id: l.id,
        notaFiscal: l.notaFiscal,
        dataEntrada: l.dataEntrada,
        statusProcessamento: l.statusProcessamento,
        quantidadeEquipamentos: l.equipamentos.length,
        pesoTotalKg: Number(pesoLote.toFixed(3))
      };
    });

    // Fator estimado de crédito de carbono por kg de resíduo tecnológico desviado de aterro
    const creditosCarbonoEstimados = Number((pesoTotalGeral * 0.0014).toFixed(4));

    return {
      organizacao: {
        id: org.id,
        razaoSocial: org.razaoSocial,
        cnpj: org.cnpj,
        contratoAtivo: org.contrato ? org.contrato.dataVencimento.getTime() >= Date.now() : false
      },
      metricasSustentabilidade: {
        totalLotesProcessados: org.lotes.length,
        totalItensDestinados: totalEquipamentos,
        massaTotalRecuperadaKg: Number(pesoTotalGeral.toFixed(3)),
        creditosCarbonoEstimadosTCO2e: creditosCarbonoEstimados
      },
      lotes: lotesDetalhados
    };
  }

  public async relatorioPorStatus(status?: string) {
    const equipamentos = await prisma.equipamento.findMany({
      where: status ? { statusRastreamento: status } : undefined,
      include: {
        lote: {
          select: { id: true, notaFiscal: true, organizacaoId: true }
        }
      }
    });

    const distribuicao = equipamentos.map(eq => ({
      id: eq.id,
      codigoBarrasInterno: eq.codigoBarrasInterno,
      tipo: eq.tipo,
      marca: eq.marca,
      modelo: eq.modelo,
      anoFabricacao: eq.anoFabricacao,
      estadoFisico: eq.estadoFisico,
      pesoQuilogramas: eq.pesoQuilogramas,
      statusRastreamento: eq.statusRastreamento,
      depreciacaoPercentual: Number((EquipamentoService.calcularDepreciacao(eq.anoFabricacao, eq.estadoFisico) * 100).toFixed(1))
    }));

    return {
      statusFiltro: status || 'TODOS',
      totalUnidades: equipamentos.length,
      equipamentos: distribuicao
    };
  }

  public async relatorioFinanceiro() {
    const contratos = await prisma.contrato.findMany();
    const receitaRecorrenteMensalMRR = contratos.reduce((acc, c) => acc + c.valorMensal, 0);

    const equipamentos = await prisma.equipamento.findMany();
    let valorEstimadoMateriaisReciclaveis = 0;

    for (const eq of equipamentos) {
      const taxaDepreciacao = EquipamentoService.calcularDepreciacao(eq.anoFabricacao, eq.estadoFisico);
      const taxaRecuperacao = Math.max(0.2, 1.0 - taxaDepreciacao);
      valorEstimadoMateriaisReciclaveis += eq.pesoQuilogramas * 12.50 * taxaRecuperacao;
    }

    return {
      dataEmissao: new Date().toISOString(),
      metricas: {
        totalOrganizacoesComContrato: contratos.length,
        receitaRecorrenteMensalMRR: Number(receitaRecorrenteMensalMRR.toFixed(2)),
        totalEquipamentosInventariados: equipamentos.length,
        valorEstimadoMateriaisReciclaveisBRL: Number(valorEstimadoMateriaisReciclaveis.toFixed(2))
      }
    };
  }

  public async relatorioAuditoria(limite: number = 30) {
    const journals = await prisma.journalTransacao.findMany({
      orderBy: { timestamp: 'desc' },
      take: limite
    });

    return {
      totalTransacoesExibidas: journals.length,
      historicoTransacoes: journals.map(j => ({
        id: j.id,
        timestamp: j.timestamp,
        operacao: j.operacao,
        entidade: j.entidade,
        usuarioResponsavel: j.usuarioResponsavel,
        dadosAntes: j.dadosAntes ? JSON.parse(j.dadosAntes) : null,
        dadosDepois: j.dadosDepois ? JSON.parse(j.dadosDepois) : null
      }))
    };
  }
}
