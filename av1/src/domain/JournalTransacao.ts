export class JournalTransacao {
  private id: string;
  private timestamp: Date;
  private operacao: string;
  private entidade: string;
  private dadosAntes: any;
  private dadosDepois: any;
  private usuarioResponsavel: string;

  constructor(
    id: string,
    operacao: string,
    entidade: string,
    dadosAntes: any,
    dadosDepois: any,
    usuarioResponsavel: string,
    timestamp: Date = new Date()
  ) {
    this.id = id;
    this.operacao = operacao;
    this.entidade = entidade;
    this.dadosAntes = dadosAntes;
    this.dadosDepois = dadosDepois;
    this.usuarioResponsavel = usuarioResponsavel;
    this.timestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);
  }

  public registrar(): void {
    // Marcador de confirmação em memória
    // A persistência física no arquivo de log imutável é orquestrada pelo RepositorioArquivo
  }

  public reverter(): boolean {
    // Permite reverter transação caso existam dados anteriores
    return this.dadosAntes !== null && this.dadosAntes !== undefined;
  }

  public getId(): string { return this.id; }
  public getTimestamp(): Date { return this.timestamp; }
  public getOperacao(): string { return this.operacao; }
  public getEntidade(): string { return this.entidade; }
  public getDadosAntes(): any { return this.dadosAntes; }
  public getDadosDepois(): any { return this.dadosDepois; }
  public getUsuarioResponsavel(): string { return this.usuarioResponsavel; }

  public toJSON(): any {
    return {
      id: this.id,
      timestamp: this.timestamp.toISOString(),
      operacao: this.operacao,
      entidade: this.entidade,
      dadosAntes: this.dadosAntes,
      dadosDepois: this.dadosDepois,
      usuarioResponsavel: this.usuarioResponsavel
    };
  }

  public static fromJSON(dados: any): JournalTransacao {
    return new JournalTransacao(
      dados.id,
      dados.operacao,
      dados.entidade,
      dados.dadosAntes,
      dados.dadosDepois,
      dados.usuarioResponsavel,
      new Date(dados.timestamp)
    );
  }
}
