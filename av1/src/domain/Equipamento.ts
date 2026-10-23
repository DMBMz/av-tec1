import { EstadoFisico, ORDEM_ESTADO_FISICO, StatusRastreamento, TipoEquipamento } from './enums';

export class Movimentacao {
  private id: string;
  private equipamentoId: string;
  private dataHora: Date;
  private origem: string;
  private destino: string;
  private responsavel: string;
  private observacao: string;

  constructor(
    id: string,
    equipamentoId: string,
    dataHora: Date = new Date(),
    origem: string,
    destino: string,
    responsavel: string,
    observacao: string = ''
  ) {
    this.id = id;
    this.equipamentoId = equipamentoId;
    this.dataHora = dataHora instanceof Date ? dataHora : new Date(dataHora);
    this.origem = origem;
    this.destino = destino;
    this.responsavel = responsavel;
    this.observacao = observacao;
  }

  public getId(): string { return this.id; }
  public getEquipamentoId(): string { return this.equipamentoId; }
  public getDataHora(): Date { return this.dataHora; }
  public getOrigem(): string { return this.origem; }
  public getDestino(): string { return this.destino; }
  public getResponsavel(): string { return this.responsavel; }
  public getObservacao(): string { return this.observacao; }

  public toJSON(): any {
    return {
      id: this.id,
      equipamentoId: this.equipamentoId,
      dataHora: this.dataHora.toISOString(),
      origem: this.origem,
      destino: this.destino,
      responsavel: this.responsavel,
      observacao: this.observacao
    };
  }

  public static fromJSON(dados: any): Movimentacao {
    return new Movimentacao(
      dados.id,
      dados.equipamentoId,
      new Date(dados.dataHora),
      dados.origem,
      dados.destino,
      dados.responsavel,
      dados.observacao
    );
  }
}

export class Equipamento {
  private id: string;
  private codigoBarrasInterno: string;
  private tipo: TipoEquipamento;
  private marca: string;
  private modelo: string;
  private anoFabricacao: number;
  private estadoFisico: EstadoFisico;
  private pesoQuilogramas: number;
  private loteId: string;
  private posicaoNoLote: number;
  private statusRastreamento: StatusRastreamento;
  private historicoMovimentacao: Movimentacao[];
  private justificativaUltimaAlteracao?: string;

  constructor(
    id: string,
    codigoBarrasInterno: string,
    tipo: TipoEquipamento,
    marca: string,
    modelo: string,
    anoFabricacao: number,
    estadoFisico: EstadoFisico,
    pesoQuilogramas: number,
    loteId: string,
    posicaoNoLote: number,
    statusRastreamento: StatusRastreamento = StatusRastreamento.AGUARDANDO_TRIAGEM,
    historicoMovimentacao: Movimentacao[] = [],
    justificativaUltimaAlteracao?: string
  ) {
    this.id = id;
    this.codigoBarrasInterno = codigoBarrasInterno;
    this.tipo = tipo;
    this.marca = marca;
    this.modelo = modelo;
    this.anoFabricacao = anoFabricacao;
    this.estadoFisico = estadoFisico;
    this.pesoQuilogramas = pesoQuilogramas;
    this.loteId = loteId;
    this.posicaoNoLote = posicaoNoLote;
    this.statusRastreamento = statusRastreamento;
    this.historicoMovimentacao = [...historicoMovimentacao];
    this.justificativaUltimaAlteracao = justificativaUltimaAlteracao;
  }

  public atualizarStatus(novoStatus: StatusRastreamento, justificativa: string = ''): void {
    this.statusRastreamento = novoStatus;
    if (justificativa) {
      this.justificativaUltimaAlteracao = justificativa;
    }
  }

  public atualizarEstadoFisico(novoEstado: EstadoFisico, justificativa?: string): void {
    const nivelAnterior = ORDEM_ESTADO_FISICO[this.estadoFisico];
    const nivelNovo = ORDEM_ESTADO_FISICO[novoEstado];

    // Regra de negócio: queda de 2 ou mais níveis exige justificativa textual obrigatória
    if (nivelAnterior - nivelNovo >= 2) {
      if (!justificativa || justificativa.trim().length < 5) {
        throw new Error(
          `Queda acentuada de estado físico (${this.estadoFisico} -> ${novoEstado}) exige justificativa textual obrigatória de pelo menos 5 caracteres.`
        );
      }
      this.justificativaUltimaAlteracao = justificativa.trim();
    }

    this.estadoFisico = novoEstado;
  }

  public registrarMovimentacao(destino: string, responsavel: string, observacao: string = ''): Movimentacao {
    const movId = `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const origem = this.historicoMovimentacao.length > 0
      ? this.historicoMovimentacao[this.historicoMovimentacao.length - 1].getDestino()
      : 'RECEBIMENTO_LOTE';

    const novaMov = new Movimentacao(movId, this.id, new Date(), origem, destino, responsavel, observacao);
    this.historicoMovimentacao.push(novaMov);
    return novaMov;
  }

  public calcularDepreciacao(): number {
    const anoAtual = new Date().getFullYear();
    const idadeAnos = Math.max(0, anoAtual - this.anoFabricacao);
    // Taxa básica anual de depreciação contábil (20% ao ano para TI)
    const depreciacaoTemporal = Math.min(0.90, idadeAnos * 0.20);

    // Fator de desgaste físico
    const fatorEstado: Record<EstadoFisico, number> = {
      [EstadoFisico.NOVO]: 0.0,
      [EstadoFisico.BOM_ESTADO]: 0.10,
      [EstadoFisico.USADO_LEVE]: 0.25,
      [EstadoFisico.USADO_MODERADO]: 0.45,
      [EstadoFisico.DANIFICADO_LEVE]: 0.65,
      [EstadoFisico.DANIFICADO_GRAVE]: 0.85,
      [EstadoFisico.INSERVIVEL]: 0.98
    };

    const depreciacaoFisica = fatorEstado[this.estadoFisico];
    // Depreciação combinada ponderada
    const depreciacaoTotal = Math.min(1.0, (depreciacaoTemporal * 0.4) + (depreciacaoFisica * 0.6));
    return Number(depreciacaoTotal.toFixed(4));
  }

  public getId(): string { return this.id; }
  public getCodigoBarrasInterno(): string { return this.codigoBarrasInterno; }
  public getTipo(): TipoEquipamento { return this.tipo; }
  public getMarca(): string { return this.marca; }
  public getModelo(): string { return this.modelo; }
  public getAnoFabricacao(): number { return this.anoFabricacao; }
  public getEstadoFisico(): EstadoFisico { return this.estadoFisico; }
  public getPesoQuilogramas(): number { return this.pesoQuilogramas; }
  public getLoteId(): string { return this.loteId; }
  public getPosicaoNoLote(): number { return this.posicaoNoLote; }
  public getStatusRastreamento(): StatusRastreamento { return this.statusRastreamento; }
  public getHistoricoMovimentacao(): Movimentacao[] { return [...this.historicoMovimentacao]; }
  public getJustificativaUltimaAlteracao(): string | undefined { return this.justificativaUltimaAlteracao; }

  public toJSON(): any {
    return {
      id: this.id,
      codigoBarrasInterno: this.codigoBarrasInterno,
      tipo: this.tipo,
      marca: this.marca,
      modelo: this.modelo,
      anoFabricacao: this.anoFabricacao,
      estadoFisico: this.estadoFisico,
      pesoQuilogramas: this.pesoQuilogramas,
      loteId: this.loteId,
      posicaoNoLote: this.posicaoNoLote,
      statusRastreamento: this.statusRastreamento,
      historicoMovimentacao: this.historicoMovimentacao.map(m => m.toJSON()),
      justificativaUltimaAlteracao: this.justificativaUltimaAlteracao
    };
  }

  public static fromJSON(dados: any): Equipamento {
    return new Equipamento(
      dados.id,
      dados.codigoBarrasInterno,
      dados.tipo,
      dados.marca,
      dados.modelo,
      dados.anoFabricacao,
      dados.estadoFisico,
      dados.pesoQuilogramas,
      dados.loteId,
      dados.posicaoNoLote,
      dados.statusRastreamento,
      (dados.historicoMovimentacao || []).map((m: any) => Movimentacao.fromJSON(m)),
      dados.justificativaUltimaAlteracao
    );
  }
}
