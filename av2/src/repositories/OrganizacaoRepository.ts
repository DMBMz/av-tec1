import { prisma } from '../config/prisma';

export class OrganizacaoRepository {
  public async findById(id: string) {
    return prisma.organizacao.findUnique({
      where: { id },
      include: {
        contrato: true,
        lotes: {
          include: {
            equipamentos: true
          }
        }
      }
    });
  }

  public async findByCnpj(cnpj: string) {
    return prisma.organizacao.findUnique({
      where: { cnpj },
      include: { contrato: true }
    });
  }

  public async listAll(somenteAtivas: boolean = true) {
    return prisma.organizacao.findMany({
      where: somenteAtivas ? { ativo: true } : undefined,
      include: {
        contrato: true
      },
      orderBy: { dataCadastro: 'desc' }
    });
  }

  public async createWithContract(
    dadosOrg: {
      id?: string;
      razaoSocial: string;
      cnpj: string;
      inscricaoEstadual: string;
      enderecoCompleto: string;
      telefone: string;
      email: string;
    },
    dadosContrato?: {
      dataAssinatura?: Date;
      dataVencimento: Date;
      clausulasJson?: string;
      valorMensal: number;
      renovacaoAutomatica?: boolean;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organizacao.create({
        data: {
          id: dadosOrg.id,
          razaoSocial: dadosOrg.razaoSocial,
          cnpj: dadosOrg.cnpj,
          inscricaoEstadual: dadosOrg.inscricaoEstadual,
          enderecoCompleto: dadosOrg.enderecoCompleto,
          telefone: dadosOrg.telefone,
          email: dadosOrg.email
        }
      });

      let contrato = null;
      if (dadosContrato) {
        contrato = await tx.contrato.create({
          data: {
            organizacaoId: org.id,
            dataAssinatura: dadosContrato.dataAssinatura || new Date(),
            dataVencimento: dadosContrato.dataVencimento,
            clausulasJson: dadosContrato.clausulasJson || '[]',
            valorMensal: dadosContrato.valorMensal,
            renovacaoAutomatica: dadosContrato.renovacaoAutomatica ?? false
          }
        });
      }

      return { ...org, contrato };
    });
  }

  public async updateWithOptimisticLock(
    id: string,
    versaoEsperada: number,
    data: {
      razaoSocial?: string;
      enderecoCompleto?: string;
      telefone?: string;
      email?: string;
      ativo?: boolean;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const resultado = await tx.organizacao.updateMany({
        where: { id, versao: versaoEsperada },
        data: {
          ...data,
          versao: { increment: 1 }
        }
      });

      if (resultado.count === 0) {
        throw new Error(`Conflito de concorrência: A organização '${id}' foi modificada por outro processo.`);
      }

      return tx.organizacao.findUnique({
        where: { id },
        include: { contrato: true }
      });
    });
  }

  public async renewContract(organizacaoId: string, novoVencimento: Date, versaoEsperada?: number) {
    return prisma.$transaction(async (tx) => {
      const contrato = await tx.contrato.findUnique({
        where: { organizacaoId }
      });

      if (!contrato) {
        throw new Error(`Organização '${organizacaoId}' não possui contrato ativo.`);
      }

      if (versaoEsperada !== undefined && contrato.versao !== versaoEsperada) {
        throw new Error(`Conflito de concorrência: O contrato foi atualizado concorrentemente.`);
      }

      return tx.contrato.update({
        where: { organizacaoId },
        data: {
          dataVencimento: novoVencimento,
          versao: { increment: 1 }
        }
      });
    });
  }
}
