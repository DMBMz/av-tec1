export class Contrato {
  private id: string;
  private organizacaoId: string;
  private dataAssinatura: Date;
  private dataVencimento: Date;
  private clausulas: string[];
  private valorMensal: number;
  private renovacaoAutomatica: boolean;

  constructor(
    id: string,
    organizacaoId: string,
    dataAssinatura: Date,
    dataVencimento: Date,
    clausulas: string[],
    valorMensal: number,
    renovacaoAutomatica: boolean = false
  ) {
    this.id = id;
    this.organizacaoId = organizacaoId;
    this.dataAssinatura = dataAssinatura instanceof Date ? dataAssinatura : new Date(dataAssinatura);
    this.dataVencimento = dataVencimento instanceof Date ? dataVencimento : new Date(dataVencimento);
    this.clausulas = clausulas;
    this.valorMensal = valorMensal;
    this.renovacaoAutomatica = renovacaoAutomatica;
  }

  public estaVigente(): boolean {
    return new Date().getTime() <= this.dataVencimento.getTime();
  }

  public renovar(novoVencimento: Date): void {
    const data = novoVencimento instanceof Date ? novoVencimento : new Date(novoVencimento);
    if (data.getTime() <= this.dataVencimento.getTime()) {
      throw new Error('A nova data de vencimento deve ser posterior à data atual de vencimento.');
    }
    this.dataVencimento = data;
  }

  public getId(): string { return this.id; }
  public getOrganizacaoId(): string { return this.organizacaoId; }
  public getDataAssinatura(): Date { return this.dataAssinatura; }
  public getDataVencimento(): Date { return this.dataVencimento; }
  public getClausulas(): string[] { return [...this.clausulas]; }
  public getValorMensal(): number { return this.valorMensal; }
  public isRenovacaoAutomatica(): boolean { return this.renovacaoAutomatica; }

  public toJSON(): any {
    return {
      id: this.id,
      organizacaoId: this.organizacaoId,
      dataAssinatura: this.dataAssinatura.toISOString(),
      dataVencimento: this.dataVencimento.toISOString(),
      clausulas: this.clausulas,
      valorMensal: this.valorMensal,
      renovacaoAutomatica: this.renovacaoAutomatica
    };
  }

  public static fromJSON(dados: any): Contrato {
    return new Contrato(
      dados.id,
      dados.organizacaoId,
      new Date(dados.dataAssinatura),
      new Date(dados.dataVencimento),
      dados.clausulas || [],
      dados.valorMensal,
      dados.renovacaoAutomatica
    );
  }
}

export class Organizacao {
  private id: string;
  private razaoSocial: string;
  private cnpj: string;
  private inscricaoEstadual: string;
  private enderecoCompleto: string;
  private telefone: string;
  private email: string;
  private dataCadastro: Date;
  private ativo: boolean;
  private contratoVigente?: Contrato;

  constructor(
    id: string,
    razaoSocial: string,
    cnpj: string,
    inscricaoEstadual: string,
    enderecoCompleto: string,
    telefone: string,
    email: string,
    dataCadastro: Date = new Date(),
    ativo: boolean = true,
    contratoVigente?: Contrato
  ) {
    this.id = id;
    this.razaoSocial = razaoSocial;
    this.cnpj = cnpj;
    this.inscricaoEstadual = inscricaoEstadual;
    this.enderecoCompleto = enderecoCompleto;
    this.telefone = telefone;
    this.email = email;
    this.dataCadastro = dataCadastro instanceof Date ? dataCadastro : new Date(dataCadastro);
    this.ativo = ativo;
    this.contratoVigente = contratoVigente;
  }

  public alterarEndereco(novoEndereco: string): void {
    if (!novoEndereco || novoEndereco.trim().length === 0) {
      throw new Error('Endereço não pode ser vazio.');
    }
    this.enderecoCompleto = novoEndereco.trim();
  }

  public desativar(): void {
    this.ativo = false;
  }

  public ativar(): void {
    this.ativo = true;
  }

  public associarContrato(contrato: Contrato): void {
    this.contratoVigente = contrato;
  }

  public getId(): string { return this.id; }
  public getRazaoSocial(): string { return this.razaoSocial; }
  public getCnpj(): string { return this.cnpj; }
  public getInscricaoEstadual(): string { return this.inscricaoEstadual; }
  public getEnderecoCompleto(): string { return this.enderecoCompleto; }
  public getTelefone(): string { return this.telefone; }
  public getEmail(): string { return this.email; }
  public getDataCadastro(): Date { return this.dataCadastro; }
  public isAtivo(): boolean { return this.ativo; }
  public getContratoVigente(): Contrato | undefined { return this.contratoVigente; }

  public toJSON(): any {
    return {
      id: this.id,
      razaoSocial: this.razaoSocial,
      cnpj: this.cnpj,
      inscricaoEstadual: this.inscricaoEstadual,
      enderecoCompleto: this.enderecoCompleto,
      telefone: this.telefone,
      email: this.email,
      dataCadastro: this.dataCadastro.toISOString(),
      ativo: this.ativo,
      contratoVigente: this.contratoVigente ? this.contratoVigente.toJSON() : null
    };
  }

  public static fromJSON(dados: any): Organizacao {
    return new Organizacao(
      dados.id,
      dados.razaoSocial,
      dados.cnpj,
      dados.inscricaoEstadual,
      dados.enderecoCompleto,
      dados.telefone,
      dados.email,
      new Date(dados.dataCadastro),
      dados.ativo,
      dados.contratoVigente ? Contrato.fromJSON(dados.contratoVigente) : undefined
    );
  }
}
