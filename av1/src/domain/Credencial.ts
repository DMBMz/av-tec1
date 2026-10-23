import * as crypto from 'crypto';
import { PapelUsuario } from './enums';

export interface Autenticavel {
  autenticar(usuario: string, senha: string): boolean;
  renovarToken(): string;
}

export class Credencial {
  private usuario: string;
  private hashSenha: string;
  private salt: string;
  private ultimoAcesso: Date;
  private papel: PapelUsuario;

  constructor(
    usuario: string,
    hashSenha: string,
    salt: string,
    papel: PapelUsuario,
    ultimoAcesso: Date = new Date()
  ) {
    this.usuario = usuario;
    this.hashSenha = hashSenha;
    this.salt = salt;
    this.papel = papel;
    this.ultimoAcesso = ultimoAcesso instanceof Date ? ultimoAcesso : new Date(ultimoAcesso);
  }

  public static criarComSenhaPlana(usuario: string, senhaPlana: string, papel: PapelUsuario): Credencial {
    const salt = crypto.randomBytes(16).toString('hex');
    const hashSenha = Credencial.gerarHash(senhaPlana, salt);
    return new Credencial(usuario, hashSenha, salt, papel, new Date());
  }

  public static gerarHash(senhaPlana: string, salt: string): string {
    return crypto.createHash('sha256').update(senhaPlana + salt).digest('hex');
  }

  public verificarSenha(senhaPlana: string): boolean {
    const hashCalculado = Credencial.gerarHash(senhaPlana, this.salt);
    return crypto.timingSafeEqual(Buffer.from(hashCalculado), Buffer.from(this.hashSenha));
  }

  public atualizarUltimoAcesso(): void {
    this.ultimoAcesso = new Date();
  }

  public getId(): string {
    return this.usuario;
  }

  public getUsuario(): string {
    return this.usuario;
  }

  public getPapel(): PapelUsuario {
    return this.papel;
  }

  public getUltimoAcesso(): Date {
    return this.ultimoAcesso;
  }

  public getHashSenha(): string {
    return this.hashSenha;
  }

  public getSalt(): string {
    return this.salt;
  }

  public toJSON(): any {
    return {
      id: this.usuario,
      usuario: this.usuario,
      hashSenha: this.hashSenha,
      salt: this.salt,
      ultimoAcesso: this.ultimoAcesso.toISOString(),
      papel: this.papel
    };
  }

  public static fromJSON(dados: any): Credencial {
    return new Credencial(
      dados.usuario,
      dados.hashSenha,
      dados.salt,
      dados.papel,
      new Date(dados.ultimoAcesso)
    );
  }
}

export class Sessao {
  private token: string;
  private usuario: string;
  private papel: PapelUsuario;
  private criacao: Date;
  private expiracao: Date;

  // 30 minutos de inatividade conforme especificação
  public static readonly TEMPO_EXPIRACAO_MINUTOS = 30;

  constructor(token: string, usuario: string, papel: PapelUsuario, criacao: Date = new Date(), expiracao?: Date) {
    this.token = token;
    this.usuario = usuario;
    this.papel = papel;
    this.criacao = criacao instanceof Date ? criacao : new Date(criacao);
    this.expiracao = expiracao
      ? (expiracao instanceof Date ? expiracao : new Date(expiracao))
      : new Date(this.criacao.getTime() + Sessao.TEMPO_EXPIRACAO_MINUTOS * 60 * 1000);
  }

  public static gerarNova(usuario: string, papel: PapelUsuario): Sessao {
    const token = crypto.randomBytes(24).toString('hex');
    return new Sessao(token, usuario, papel);
  }

  public isValida(): boolean {
    return new Date().getTime() <= this.expiracao.getTime();
  }

  public renovar(): void {
    this.expiracao = new Date(Date.now() + Sessao.TEMPO_EXPIRACAO_MINUTOS * 60 * 1000);
  }

  public getToken(): string {
    return this.token;
  }

  public getUsuario(): string {
    return this.usuario;
  }

  public getPapel(): PapelUsuario {
    return this.papel;
  }

  public getExpiracao(): Date {
    return this.expiracao;
  }
}
