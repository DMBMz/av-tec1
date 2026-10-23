import { Contrato, Organizacao } from '../domain/Organizacao';
import { ValidadorCNPJ } from '../validators/ValidadorCNPJ';
import { RepositorioArquivo } from '../storage/RepositorioArquivo';

export class ServicoOrganizacao {
  private repositorio: RepositorioArquivo;
  private validadorCNPJ: ValidadorCNPJ;

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
    this.validadorCNPJ = new ValidadorCNPJ();
  }

  public cadastrarOrganizacao(
    dados: {
      id?: string;
      razaoSocial: string;
      cnpj: string;
      inscricaoEstadual: string;
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
    usuarioLogado: string
  ): Organizacao {
    // Validação formal do CNPJ
    if (!this.validadorCNPJ.validar(dados.cnpj)) {
      throw new Error(`CNPJ Inválido: ${this.validadorCNPJ.obterMensagemErro()}`);
    }

    const cnpjLimpo = dados.cnpj.replace(/[^\d]+/g, '');

    // Verificação de unicidade do CNPJ
    const orgsExistentes = this.repositorio.listarEntidades('organizacoes');
    const cnpjDuplicado = orgsExistentes.some((o: any) => o.cnpj.replace(/[^\d]+/g, '') === cnpjLimpo);

    if (cnpjDuplicado) {
      throw new Error(`Conflito: Já existe uma organização cadastrada com o CNPJ ${dados.cnpj}.`);
    }

    const id = dados.id || `ORG-${Date.now()}`;
    let contrato: Contrato | undefined;

    if (dados.contrato) {
      contrato = new Contrato(
        `CTR-${Date.now()}`,
        id,
        dados.contrato.dataAssinatura ? new Date(dados.contrato.dataAssinatura) : new Date(),
        new Date(dados.contrato.dataVencimento),
        dados.contrato.clausulas || ['Cláusula padrão de destinação de resíduos sólidos'],
        dados.contrato.valorMensal,
        dados.contrato.renovacaoAutomatica ?? false
      );
    }

    const novaOrg = new Organizacao(
      id,
      dados.razaoSocial,
      dados.cnpj,
      dados.inscricaoEstadual,
      dados.enderecoCompleto,
      dados.telefone,
      dados.email,
      new Date(),
      true,
      contrato
    );

    this.repositorio.salvarEntidade('organizacoes', novaOrg, usuarioLogado);
    return novaOrg;
  }

  public buscarOrganizacao(id: string): Organizacao {
    const dados = this.repositorio.carregarEntidade('organizacoes', id);
    if (!dados) {
      throw new Error(`Organização com ID '${id}' não encontrada.`);
    }
    return Organizacao.fromJSON(dados);
  }

  public listarOrganizacoesAtivas(): Organizacao[] {
    const lista = this.repositorio.listarEntidades('organizacoes');
    return lista.filter((o: any) => o.ativo).map((o: any) => Organizacao.fromJSON(o));
  }

  public renovarContrato(organizacaoId: string, novoVencimento: Date, usuarioLogado: string): void {
    const org = this.buscarOrganizacao(organizacaoId);
    const contrato = org.getContratoVigente();

    if (!contrato) {
      throw new Error(`A organização '${organizacaoId}' não possui contrato vigente para renovação.`);
    }

    contrato.renovar(novoVencimento);
    this.repositorio.salvarEntidade('organizacoes', org, usuarioLogado);
  }
}
