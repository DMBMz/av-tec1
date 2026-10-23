import { Equipamento } from '../domain/Equipamento';
import { EstadoFisico, StatusLote, StatusRastreamento, TipoEquipamento } from '../domain/enums';
import { RepositorioArquivo } from '../storage/RepositorioArquivo';
import { Lote } from '../domain/Lote';

export class ServicoEquipamento {
  private repositorio: RepositorioArquivo;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public gerarCodigoBarras(tipo: TipoEquipamento, sequencia: number): string {
    const ano = new Date().getFullYear();
    const seqStr = String(sequencia).padStart(5, '0');
    return `GC-${tipo}-${ano}-${seqStr}`;
  }

  public cadastrarEquipamento(
    dados: {
      id?: string;
      tipo: TipoEquipamento;
      marca: string;
      modelo: string;
      anoFabricacao: number;
      estadoFisico: EstadoFisico;
      pesoQuilogramas: number;
      loteId: string;
      posicaoNoLote: number;
    },
    usuarioLogado: string
  ): Equipamento {
    const loteData = this.repositorio.carregarEntidade('lotes', dados.loteId);
    if (!loteData) {
      throw new Error(`Lote '${dados.loteId}' não encontrado para associar o equipamento.`);
    }

    const todosEquipamentos = this.repositorio.listarEntidades('equipamentos');
    const codigoBarras = this.gerarCodigoBarras(dados.tipo, todosEquipamentos.length + 1);
    const id = dados.id || `EQP-${Date.now()}-${todosEquipamentos.length + 1}`;

    const novoEquipamento = new Equipamento(
      id,
      codigoBarras,
      dados.tipo,
      dados.marca,
      dados.modelo,
      dados.anoFabricacao,
      dados.estadoFisico,
      dados.pesoQuilogramas,
      dados.loteId,
      dados.posicaoNoLote,
      StatusRastreamento.AGUARDANDO_TRIAGEM
    );

    // Registra a primeira movimentação de entrada
    novoEquipamento.registrarMovimentacao('ALMOXARIFADO_ENTRADA', usuarioLogado, 'Recepção e tombamento no lote');

    // Adiciona ao lote e persiste
    const lote = Lote.fromJSON(loteData);
    lote.adicionarEquipamento(novoEquipamento);
    this.repositorio.salvarEntidade('lotes', lote, usuarioLogado);
    this.repositorio.salvarEntidade('equipamentos', novoEquipamento, usuarioLogado);

    return novoEquipamento;
  }

  public buscarEquipamento(idOuCodigo: string): Equipamento {
    const lista = this.repositorio.listarEntidades('equipamentos');
    const dados = lista.find((e: any) => e.id === idOuCodigo || e.codigoBarrasInterno === idOuCodigo);
    if (!dados) {
      throw new Error(`Equipamento '${idOuCodigo}' não encontrado.`);
    }
    return Equipamento.fromJSON(dados);
  }

  public rastrearEquipamento(idOuCodigo: string): { equipamento: Equipamento; depreciacao: number; historico: any[] } {
    const equip = this.buscarEquipamento(idOuCodigo);
    return {
      equipamento: equip,
      depreciacao: equip.calcularDepreciacao(),
      historico: equip.getHistoricoMovimentacao().map(m => m.toJSON())
    };
  }

  public atualizarStatus(
    id: string,
    novoStatus: StatusRastreamento,
    justificativa: string,
    usuarioLogado: string
  ): void {
    const equip = this.buscarEquipamento(id);

    // REGRA DE NEGÓCIO MANDATÓRIA (AV1):
    // "restrição de que um equipamento só pode ser movimentado para o status de desmonte após passar por triagem completa"
    const statusDesmonte = [
      StatusRastreamento.AGUARDANDO_DESMONTE,
      StatusRastreamento.EM_DESMONTE,
      StatusRastreamento.PECAS_REAPROVEITADAS,
      StatusRastreamento.MATERIAL_RECICLAVEL,
      StatusRastreamento.DESCARTE_SEGURO
    ];

    if (statusDesmonte.includes(novoStatus)) {
      const loteData = this.repositorio.carregarEntidade('lotes', equip.getLoteId());
      if (loteData) {
        const lote = Lote.fromJSON(loteData);
        if (lote.getStatusProcessamento() !== StatusLote.TRIAGEM_CONCLUIDA &&
            lote.getStatusProcessamento() !== StatusLote.FINALIZADO &&
            lote.getStatusProcessamento() !== StatusLote.ENCAMINHADO) {
          throw new Error(
            `Restrição de Negócio: O equipamento '${id}' só pode avançar para desmonte após o Lote '${equip.getLoteId()}' passar por triagem completa (Status atual: ${lote.getStatusProcessamento()}).`
          );
        }
      }
    }

    equip.atualizarStatus(novoStatus, justificativa);
    equip.registrarMovimentacao(`SETOR_${novoStatus}`, usuarioLogado, justificativa || `Transição para ${novoStatus}`);

    this.repositorio.salvarEntidade('equipamentos', equip, usuarioLogado);

    // Atualiza também dentro do lote
    const loteData = this.repositorio.carregarEntidade('lotes', equip.getLoteId());
    if (loteData) {
      const lote = Lote.fromJSON(loteData);
      lote.removerEquipamento(equip.getId());
      lote.adicionarEquipamento(equip);
      this.repositorio.salvarEntidade('lotes', lote, usuarioLogado);
    }
  }

  public atualizarEstadoFisico(
    id: string,
    novoEstado: EstadoFisico,
    justificativa: string,
    usuarioLogado: string
  ): void {
    const equip = this.buscarEquipamento(id);
    // Dispara a regra interna de queda de 2 ou mais níveis
    equip.atualizarEstadoFisico(novoEstado, justificativa);

    equip.registrarMovimentacao(
      'INSPECAO_TECNICA',
      usuarioLogado,
      `Reavaliação de estado físico para ${novoEstado}. Justificativa: ${justificativa || 'N/A'}`
    );

    this.repositorio.salvarEntidade('equipamentos', equip, usuarioLogado);
  }

  public listarTodos(): Equipamento[] {
    return this.repositorio.listarEntidades('equipamentos').map(e => Equipamento.fromJSON(e));
  }
}
