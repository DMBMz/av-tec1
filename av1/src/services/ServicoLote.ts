import { Lote } from '../domain/Lote';
import { Equipamento } from '../domain/Equipamento';
import { StatusLote } from '../domain/enums';
import { ValidadorDataEntrada } from '../validators/ValidadorDataEntrada';
import { RepositorioArquivo } from '../storage/RepositorioArquivo';

export class ServicoLote {
  private repositorio: RepositorioArquivo;
  private validadorDataEntrada: ValidadorDataEntrada;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
    this.validadorDataEntrada = new ValidadorDataEntrada();
  }

  public criarLote(
    dados: {
      id?: string;
      dataEntrada: string | Date;
      organizacaoId: string;
      notaFiscal: string;
      transportadora: string;
      observacoes?: string;
    },
    usuarioLogado: string
  ): Lote {
    // Validação da data de entrada (não futura e não anterior a 90 dias)
    if (!this.validadorDataEntrada.validar(dados.dataEntrada)) {
      throw new Error(`Data de entrada inválida: ${this.validadorDataEntrada.obterMensagemErro()}`);
    }

    // Verifica existência da organização vinculada
    const orgData = this.repositorio.carregarEntidade('organizacoes', dados.organizacaoId);
    if (!orgData) {
      throw new Error(`Organização geradora com ID '${dados.organizacaoId}' não encontrada.`);
    }

    const id = dados.id || `LOT-${Date.now()}`;
    const novoLote = new Lote(
      id,
      new Date(dados.dataEntrada),
      dados.organizacaoId,
      dados.notaFiscal,
      dados.transportadora,
      StatusLote.RECEBIDO,
      dados.observacoes || ''
    );

    this.repositorio.salvarEntidade('lotes', novoLote, usuarioLogado);
    return novoLote;
  }

  public buscarLote(id: string): Lote {
    const dados = this.repositorio.carregarEntidade('lotes', id);
    if (!dados) {
      throw new Error(`Lote com ID '${id}' não encontrado.`);
    }
    return Lote.fromJSON(dados);
  }

  public adicionarEquipamentoLote(loteId: string, equipamento: Equipamento, usuarioLogado: string): void {
    const lote = this.buscarLote(loteId);
    lote.adicionarEquipamento(equipamento);
    this.repositorio.salvarEntidade('lotes', lote, usuarioLogado);

    // Salva também no arquivo global de equipamentos
    this.repositorio.salvarEntidade('equipamentos', equipamento, usuarioLogado);
  }

  public processarTriagem(loteId: string, usuarioLogado: string): string {
    const lote = this.buscarLote(loteId);
    lote.concluirTriagem();

    // Persiste o lote com status atualizado
    this.repositorio.salvarEntidade('lotes', lote, usuarioLogado);

    // Atualiza individualmente cada equipamento na base de equipamentos
    for (const eq of lote.getEquipamentos()) {
      this.repositorio.salvarEntidade('equipamentos', eq, usuarioLogado);
    }

    return lote.gerarRelatorioTriagem();
  }

  public consultarLotePorPeriodo(dataInicio: Date, dataFim: Date): Lote[] {
    const todos = this.repositorio.listarEntidades('lotes').map(l => Lote.fromJSON(l));
    const inicio = dataInicio.getTime();
    const fim = dataFim.getTime();

    return todos.filter(l => {
      const entrada = l.getDataEntrada().getTime();
      return entrada >= inicio && entrada <= fim;
    });
  }

  public listarTodosLotes(): Lote[] {
    return this.repositorio.listarEntidades('lotes').map(l => Lote.fromJSON(l));
  }
}
