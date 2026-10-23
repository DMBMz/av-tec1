import { Equipamento } from './Equipamento';
import { StatusLote, StatusRastreamento } from './enums';

export class Lote {
  private id: string;
  private dataEntrada: Date;
  private organizacaoId: string;
  private notaFiscal: string;
  private transportadora: string;
  private equipamentos: Equipamento[];
  private statusProcessamento: StatusLote;
  private observacoes: string;

  constructor(
    id: string,
    dataEntrada: Date,
    organizacaoId: string,
    notaFiscal: string,
    transportadora: string,
    statusProcessamento: StatusLote = StatusLote.RECEBIDO,
    observacoes: string = '',
    equipamentos: Equipamento[] = []
  ) {
    this.id = id;
    this.dataEntrada = dataEntrada instanceof Date ? dataEntrada : new Date(dataEntrada);
    this.organizacaoId = organizacaoId;
    this.notaFiscal = notaFiscal;
    this.transportadora = transportadora;
    this.statusProcessamento = statusProcessamento;
    this.observacoes = observacoes;
    this.equipamentos = [...equipamentos];
  }

  public adicionarEquipamento(equip: Equipamento): void {
    if (this.statusProcessamento === StatusLote.FINALIZADO) {
      throw new Error('Não é possível adicionar equipamentos a um lote finalizado.');
    }
    this.equipamentos.push(equip);
  }

  public removerEquipamento(equipId: string): boolean {
    if (this.statusProcessamento === StatusLote.FINALIZADO) {
      throw new Error('Não é possível remover equipamentos de um lote finalizado.');
    }
    const idx = this.equipamentos.findIndex(e => e.getId() === equipId);
    if (idx >= 0) {
      this.equipamentos.splice(idx, 1);
      return true;
    }
    return false;
  }

  public calcularPesoTotal(): number {
    const total = this.equipamentos.reduce((acc, eq) => acc + eq.getPesoQuilogramas(), 0);
    return Number(total.toFixed(3));
  }

  public atualizarStatusProcessamento(novoStatus: StatusLote): void {
    this.statusProcessamento = novoStatus;
  }

  public concluirTriagem(): void {
    if (this.equipamentos.length === 0) {
      throw new Error('Não é possível concluir a triagem de um lote sem equipamentos cadastrados.');
    }
    this.statusProcessamento = StatusLote.TRIAGEM_CONCLUIDA;
    // Atualiza equipamentos que estavam aguardando
    for (const eq of this.equipamentos) {
      if (eq.getStatusRastreamento() === StatusRastreamento.AGUARDANDO_TRIAGEM ||
          eq.getStatusRastreamento() === StatusRastreamento.EM_TRIAGEM) {
        eq.atualizarStatus(StatusRastreamento.AGUARDANDO_DESMONTE, 'Triagem do lote concluída');
      }
    }
  }

  public gerarRelatorioTriagem(): string {
    const totalEquip = this.equipamentos.length;
    const pesoTotal = this.calcularPesoTotal();

    const porTipo: Record<string, number> = {};
    const porEstado: Record<string, number> = {};

    for (const eq of this.equipamentos) {
      porTipo[eq.getTipo()] = (porTipo[eq.getTipo()] || 0) + 1;
      porEstado[eq.getEstadoFisico()] = (porEstado[eq.getEstadoFisico()] || 0) + 1;
    }

    let relatorio = `=== RELATÓRIO DE TRIAGEM DO LOTE ${this.id} ===\n`;
    relatorio += `Organização: ${this.organizacaoId} | NF: ${this.notaFiscal} | Transp: ${this.transportadora}\n`;
    relatorio += `Data de Entrada: ${this.dataEntrada.toISOString().split('T')[0]} | Status: ${this.statusProcessamento}\n`;
    relatorio += `Total de Equipamentos: ${totalEquip} | Peso Total: ${pesoTotal} kg\n`;
    relatorio += `--- Distribuição por Tipo ---\n`;
    for (const [tipo, qtd] of Object.entries(porTipo)) {
      relatorio += `  - ${tipo}: ${qtd} unidade(s)\n`;
    }
    relatorio += `--- Distribuição por Estado Físico ---\n`;
    for (const [estado, qtd] of Object.entries(porEstado)) {
      relatorio += `  - ${estado}: ${qtd} unidade(s)\n`;
    }
    relatorio += `Observações: ${this.observacoes || 'Nenhuma'}\n`;
    relatorio += `==============================================\n`;
    return relatorio;
  }

  public getId(): string { return this.id; }
  public getDataEntrada(): Date { return this.dataEntrada; }
  public getOrganizacaoId(): string { return this.organizacaoId; }
  public getNotaFiscal(): string { return this.notaFiscal; }
  public getTransportadora(): string { return this.transportadora; }
  public getEquipamentos(): Equipamento[] { return [...this.equipamentos]; }
  public getStatusProcessamento(): StatusLote { return this.statusProcessamento; }
  public getObservacoes(): string { return this.observacoes; }

  public toJSON(): any {
    return {
      id: this.id,
      dataEntrada: this.dataEntrada.toISOString(),
      organizacaoId: this.organizacaoId,
      notaFiscal: this.notaFiscal,
      transportadora: this.transportadora,
      statusProcessamento: this.statusProcessamento,
      observacoes: this.observacoes,
      equipamentos: this.equipamentos.map(e => e.toJSON())
    };
  }

  public static fromJSON(dados: any): Lote {
    return new Lote(
      dados.id,
      new Date(dados.dataEntrada),
      dados.organizacaoId,
      dados.notaFiscal,
      dados.transportadora,
      dados.statusProcessamento,
      dados.observacoes,
      (dados.equipamentos || []).map((e: any) => Equipamento.fromJSON(e))
    );
  }
}
