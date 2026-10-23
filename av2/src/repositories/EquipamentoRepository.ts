import { prisma } from '../config/prisma';

export class EquipamentoRepository {
  public async findById(id: string) {
    return prisma.equipamento.findUnique({
      where: { id },
      include: {
        lote: {
          include: {
            organizacao: true
          }
        },
        movimentacoes: {
          orderBy: { dataHora: 'asc' }
        }
      }
    });
  }

  public async findByBarcode(codigoBarrasInterno: string) {
    return prisma.equipamento.findUnique({
      where: { codigoBarrasInterno },
      include: {
        lote: {
          include: {
            organizacao: true
          }
        },
        movimentacoes: {
          orderBy: { dataHora: 'asc' }
        }
      }
    });
  }

  public async countAll() {
    return prisma.equipamento.count();
  }

  public async listAll(filtro?: { tipo?: string; status?: string; loteId?: string }) {
    return prisma.equipamento.findMany({
      where: {
        tipo: filtro?.tipo,
        statusRastreamento: filtro?.status,
        loteId: filtro?.loteId
      },
      include: {
        lote: true,
        movimentacoes: {
          orderBy: { dataHora: 'desc' },
          take: 1
        }
      },
      orderBy: { criadoEm: 'desc' }
    });
  }

  public async updateStatusWithMovement(
    id: string,
    novoStatus: string,
    justificativa: string | undefined,
    movimentacao: {
      origem: string;
      destino: string;
      responsavel: string;
      observacao?: string;
    },
    versaoEsperada?: number
  ) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.equipamento.findUnique({
        where: { id },
        include: { lote: true }
      });

      if (!atual) {
        throw new Error(`Equipamento '${id}' não encontrado.`);
      }

      if (versaoEsperada !== undefined && atual.versao !== versaoEsperada) {
        throw new Error(`Conflito de concorrência: O equipamento foi modificado por outro operador.`);
      }

      const atualizado = await tx.equipamento.update({
        where: { id },
        data: {
          statusRastreamento: novoStatus,
          justificativaEstado: justificativa || atual.justificativaEstado,
          versao: { increment: 1 }
        }
      });

      const movCriada = await tx.movimentacao.create({
        data: {
          equipamentoId: id,
          origem: movimentacao.origem,
          destino: movimentacao.destino,
          responsavel: movimentacao.responsavel,
          observacao: movimentacao.observacao || justificativa || `Transição para ${novoStatus}`
        }
      });

      return { equipamento: atualizado, movimentacao: movCriada };
    });
  }

  public async updateEstadoFisicoWithMovement(
    id: string,
    novoEstado: string,
    justificativa: string | undefined,
    responsavel: string,
    versaoEsperada?: number
  ) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.equipamento.findUnique({
        where: { id }
      });

      if (!atual) {
        throw new Error(`Equipamento '${id}' não encontrado.`);
      }

      if (versaoEsperada !== undefined && atual.versao !== versaoEsperada) {
        throw new Error(`Conflito de concorrência: O equipamento foi modificado por outro operador.`);
      }

      const atualizado = await tx.equipamento.update({
        where: { id },
        data: {
          estadoFisico: novoEstado,
          justificativaEstado: justificativa || atual.justificativaEstado,
          versao: { increment: 1 }
        }
      });

      await tx.movimentacao.create({
        data: {
          equipamentoId: id,
          origem: 'INSPECAO_TECNICA',
          destino: 'INSPECAO_TECNICA',
          responsavel,
          observacao: `Reavaliação de estado físico para ${novoEstado}. Justificativa: ${justificativa || 'N/A'}`
        }
      });

      return atualizado;
    });
  }
}
