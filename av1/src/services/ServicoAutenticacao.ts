import { Credencial, Sessao } from '../domain/Credencial';
import { PapelUsuario } from '../domain/enums';
import { RepositorioArquivo } from '../storage/RepositorioArquivo';

export class ServicoAutenticacao {
  private repositorio: RepositorioArquivo;
  private sessoesAtivas: Map<string, Sessao> = new Map();

  constructor(repositorio: RepositorioArquivo) {
    this.repositorio = repositorio;
  }

  public login(usuario: string, senhaPlana: string): Sessao {
    const credenciaisJSON = this.repositorio.listarEntidades('credenciais');
    const credencialData = credenciaisJSON.find(c => c.usuario.toLowerCase() === usuario.toLowerCase());

    if (!credencialData) {
      throw new Error(`Credenciais inválidas para o usuário '${usuario}'.`);
    }

    const credencial = Credencial.fromJSON(credencialData);
    if (!credencial.verificarSenha(senhaPlana)) {
      throw new Error('Senha incorreta.');
    }

    credencial.atualizarUltimoAcesso();
    this.repositorio.salvarEntidade('credenciais', { id: credencial.getUsuario(), ...credencial.toJSON() }, usuario);

    const sessao = Sessao.gerarNova(credencial.getUsuario(), credencial.getPapel());
    this.sessoesAtivas.set(sessao.getToken(), sessao);
    return sessao;
  }

  public logout(token: string): void {
    this.sessoesAtivas.delete(token);
  }

  public validarToken(token: string): boolean {
    const sessao = this.sessoesAtivas.get(token);
    if (!sessao) return false;

    if (!sessao.isValida()) {
      this.sessoesAtivas.delete(token);
      return false;
    }

    // Renova a sessão a cada uso (sliding expiration)
    sessao.renovar();
    return true;
  }

  public obterSessao(token: string): Sessao | null {
    if (this.validarToken(token)) {
      return this.sessoesAtivas.get(token) || null;
    }
    return null;
  }

  public cadastrarUsuario(
    usuario: string,
    senhaPlana: string,
    papel: PapelUsuario,
    usuarioLogado: string
  ): Credencial {
    const credenciais = this.repositorio.listarEntidades('credenciais');
    if (credenciais.some(c => c.usuario.toLowerCase() === usuario.toLowerCase())) {
      throw new Error(`Usuário '${usuario}' já cadastrado.`);
    }

    if (senhaPlana.length < 6) {
      throw new Error('A senha deve possuir no mínimo 6 caracteres.');
    }

    const novaCredencial = Credencial.criarComSenhaPlana(usuario, senhaPlana, papel);
    this.repositorio.salvarEntidade(
      'credenciais',
      { id: novaCredencial.getUsuario(), ...novaCredencial.toJSON() },
      usuarioLogado
    );
    return novaCredencial;
  }

  public alterarSenha(usuario: string, senhaAntiga: string, senhaNova: string): boolean {
    const credenciaisJSON = this.repositorio.listarEntidades('credenciais');
    const credencialData = credenciaisJSON.find(c => c.usuario.toLowerCase() === usuario.toLowerCase());

    if (!credencialData) return false;

    const credencial = Credencial.fromJSON(credencialData);
    if (!credencial.verificarSenha(senhaAntiga)) {
      throw new Error('Senha antiga incorreta.');
    }

    const novaCredencial = Credencial.criarComSenhaPlana(usuario, senhaNova, credencial.getPapel());
    this.repositorio.salvarEntidade(
      'credenciais',
      { id: usuario, ...novaCredencial.toJSON() },
      usuario
    );
    return true;
  }

  public listarUsuarios(): any[] {
    return this.repositorio.listarEntidades('credenciais').map(c => ({
      usuario: c.usuario,
      papel: c.papel,
      ultimoAcesso: c.ultimoAcesso
    }));
  }
}
