import { OrganizacaoRepository } from '../repositories/OrganizacaoRepository';
import { JournalRepository } from '../repositories/JournalRepository';

export class OrganizacaoService {
  private orgRepo: OrganizacaoRepository;
  private journalRepo: JournalRepository;

  constructor() {
    this.orgRepo = new OrganizacaoRepository();
    this.journalRepo = new JournalRepository();
  }

  public static validarCNPJ(cnpjInput: string): boolean {
    if (!cnpjInput || typeof cnpjInput !== 'string') return false;
    const cnpj = cnpjInput.replace(/[^\d]+/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    let tamanho = 12;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

    tamanho = 13;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1), 10);
  }

  public async cadastrarOrganizacao(
    dados: {
      id?: string;
      razaoSocial: string;
      cnpj: string;
      inscricaoEstadual?: string;
      enderecoCompleto: string;
      telefone: string;
      email: string;
      contrato?: {
        dataAssinatura?: string | Date;
        dataVencimento: string | Date;
        clausulas?: string[];
        valorMensal: number;
        renovacaoAutomatica?: boolean;
      };
    },
    operador: string
  ) {
    if (!OrganizacaoService.validarCNPJ(dados.cnpj)) {
      throw new Error(`CNPJ '${dados.cnpj}' inválido segundo a legislação brasileira (dígitos verificadores incorretos).`);
    }

    const cnpjLimpo = dados.cnpj.replace(/[^\d]+/g, '');
    const existente = await this.orgRepo.findByCnpj(dados.cnpj);
    if (existente) {
      throw new Error(`Conflito: Organização com CNPJ '${dados.cnpj}' já está cadastrada.`);
    }

    const orgCriada = await this.orgRepo.createWithContract(
      {
        id: dados.id,
        razaoSocial: dados.razaoSocial,
        cnpj: dados.cnpj,
        inscricaoEstadual: dados.inscricaoEstadual || 'ISENTO',
        enderecoCompleto: dados.enderecoCompleto,
        telefone: dados.telefone,
        email: dados.email
      },
      dados.contrato
        ? {
            dataAssinatura: dados.contrato.dataAssinatura ? new Date(dados.contrato.dataAssinatura) : new Date(),
            dataVencimento: new Date(dados.contrato.dataVencimento),
            clausulasJson: JSON.stringify(dados.contrato.clausulas || []),
            valorMensal: dados.contrato.valorMensal,
            renovacaoAutomatica: dados.contrato.renovacaoAutomatica ?? false
          }
        : undefined
    );

    await this.journalRepo.record('CRIAR', 'Organizacao', operador, null, orgCriada);
    return orgCriada;
  }

  public async buscarPorId(id: string) {
    const org = await this.orgRepo.findById(id);
    if (!org) {
      throw new Error(`Organização '${id}' não encontrada.`);
    }
    return org;
  }

  public async listar(somenteAtivas: boolean = true) {
    return this.orgRepo.listAll(somenteAtivas);
  }

  public async renovarContrato(
    organizacaoId: string,
    novoVencimento: Date | string,
    operador: string,
    versaoEsperada?: number
  ) {
    const dataVenc = new Date(novoVencimento);
    if (isNaN(dataVenc.getTime())) {
      throw new Error('Data de vencimento inválida.');
    }

    const contratoAtualizado = await this.orgRepo.renewContract(organizacaoId, dataVenc, versaoEsperada);
    await this.journalRepo.record('RENOVAR_CONTRATO', 'Contrato', operador, null, contratoAtualizado);
    return contratoAtualizado;
  }
}
