import { prisma } from '../config/prisma';

export class JournalRepository {
  public async record(
    operacao: string,
    entidade: string,
    usuarioResponsavel: string,
    dadosAntes?: any,
    dadosDepois?: any
  ) {
    return prisma.journalTransacao.create({
      data: {
        operacao,
        entidade,
        usuarioResponsavel,
        dadosAntes: dadosAntes ? JSON.stringify(dadosAntes) : null,
        dadosDepois: dadosDepois ? JSON.stringify(dadosDepois) : null
      }
    });
  }

  public async listRecent(limite: number = 50) {
    return prisma.journalTransacao.findMany({
      orderBy: { timestamp: 'desc' },
      take: limite
    });
  }
}
