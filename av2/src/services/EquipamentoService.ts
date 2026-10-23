import { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import { LoteRepository } from '../repositories/LoteRepository';
import { JournalRepository } from '../repositories/JournalRepository';
import { ORDEM_ESTADO_FISICO, StatusRastreamento } from '../types';

export class EquipamentoService {
  private equipRepo: EquipamentoRepository;
  private loteRepo: LoteRepository;
  private journalRepo: JournalRepository;

  constructor() {
    this.equipRepo = new EquipamentoRepository();
    this.loteRepo = new LoteRepository();
    this.journalRepo = new JournalRepository();
  }

  public static calcularDepreciacao(anoFabricacao: number, estadoFisico: string): number {
    const anoAtual = new Date().getFullYear();
    const idadeAnos = Math.max(0, anoAtual - anoFabricacao);
    const depreciacaoTemporal = Math.min(0.90, idadeAnos * 0.20);

    const fatorEstado: Record<string, number> = {
      NOVO: 0.0,
      BOM_ESTADO: 0.10,
      USADO_LEVE: 0.25,
      USADO_MODERADO: 0.45,
      DANIFICADO_LEVE: 0.65,
      DANIFICADO_GRAVE: 0.85,
      INSERVIVEL: 0.98
    };

    const depreciacaoFisica = fatorEstado[estadoFisico] ?? 0.50;
    const depreciacaoTotal = Math.min(1.0, (depreciacaoTemporal * 0.4) + (depreciacaoFisica * 0.6));
    return Number(depreciacaoTotal.toFixed(4));
  }

  public async buscarPorIdOuCodigo(idOuCodigo: string) {
    let eq = await this.equipRepo.findById(idOuCodigo);
    if (!eq) {
      eq = await this.equipRepo.findByBarcode(idOuCodigo);
    }
    if (!eq) {
      throw new Error(`Equipamento '${idOuCodigo}' não encontrado.`);
    }
    return eq;
  }

  public async rastrear(idOuCodigo: string) {
    const eq = await this.buscarPorIdOuCodigo(idOuCodigo);
    const depreciacao = EquipamentoService.calcularDepreciacao(eq.anoFabricacao, eq.estadoFisico);

    return {
      equipamento: eq,
      depreciacaoPercentual: Number((depreciacao * 100).toFixed(2)),
      historicoMovimentacoes: eq.movimentacoes
    };
  }

  public async atualizarStatus(
    id: string,
    novoStatus: string,
    justificativa: string | undefined,
    operador: string,
    versaoEsperada?: number
  ) {
    const eq = await this.buscarPorIdOuCodigo(id);

    // REGRA DE NEGÓCIO: Desmonte exige que o lote tenha concluído triagem
    const statusDesmonte = [
      StatusRastreamento.AGUARDANDO_DESMONTE,
      StatusRastreamento.EM_DESMONTE,
      StatusRastreamento.PECAS_REAPROVEITADAS,
      StatusRastreamento.MATERIAL_RECICLAVEL,
      StatusRastreamento.DESCARTE_SEGURO
    ];

    if (statusDesmonte.includes(novoStatus as any)) {
      const lote = await this.loteRepo.findById(eq.loteId);
      if (lote && !['TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO'].includes(lote.statusProcessamento)) {
        throw new Error(
          `Restrição de Negócio: O equipamento só pode ir para desmonte após o Lote '${eq.loteId}' passar por triagem completa (Status do lote: ${lote.statusProcessamento}).`
        );
      }
    }

    const ultimaMov = eq.movimentacoes.length > 0 ? eq.movimentacoes[eq.movimentacoes.length - 1] : null;
    const origem = ultimaMov ? ultimaMov.destino : 'RECEBIMENTO_LOTE';
    const destino = `SETOR_${novoStatus}`;

    const res = await this.equipRepo.updateStatusWithMovement(
      eq.id,
      novoStatus,
      justificativa,
      {
        origem,
        destino,
        responsavel: operador,
        observacao: justificativa || `Transição de status para ${novoStatus}`
      },
      versaoEsperada
    );

    await this.journalRepo.record('ATUALIZAR_STATUS_EQUIP', 'Equipamento', operador, eq, res.equipamento);
    return res;
  }

  public async atualizarEstadoFisico(
    id: string,
    novoEstado: string,
    justificativa: string | undefined,
    operador: string,
    versaoEsperada?: number
  ) {
    const eq = await this.buscarPorIdOuCodigo(id);
    const nivelAnterior = ORDEM_ESTADO_FISICO[eq.estadoFisico] ?? 3;
    const nivelNovo = ORDEM_ESTADO_FISICO[novoEstado] ?? 3;

    // REGRA DE NEGÓCIO: Queda de 2 ou mais níveis exige justificativa textual obrigatória
    if (nivelAnterior - nivelNovo >= 2) {
      if (!justificativa || justificativa.trim().length < 5) {
        throw new Error(
          `Queda acentuada de integridade física (${eq.estadoFisico} -> ${novoEstado}) exige justificativa técnica obrigatória de no mínimo 5 caracteres.`
        );
      }
    }

    const atualizado = await this.equipRepo.updateEstadoFisicoWithMovement(
      eq.id,
      novoEstado,
      justificativa,
      operador,
      versaoEsperada
    );

    await this.journalRepo.record('ATUALIZAR_ESTADO_EQUIP', 'Equipamento', operador, eq, atualizado);
    return atualizado;
  }

  public async listar(filtro?: { tipo?: string; status?: string; loteId?: string }) {
    return this.equipRepo.listAll(filtro);
  }
}
