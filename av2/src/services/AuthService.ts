import * as crypto from 'crypto';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { JournalRepository } from '../repositories/JournalRepository';
import { PapelUsuario } from '../types';

export class AuthService {
  private usuarioRepo: UsuarioRepository;
  private journalRepo: JournalRepository;

  constructor() {
    this.usuarioRepo = new UsuarioRepository();
    this.journalRepo = new JournalRepository();
  }

  public static hashPassword(senhaPlana: string, salt: string): string {
    return crypto.createHash('sha256').update(senhaPlana + salt).digest('hex');
  }

  public async authenticate(usuario: string, senhaPlana: string) {
    const user = await this.usuarioRepo.findByUsername(usuario);
    if (!user || !user.ativo) {
      throw new Error('Credenciais inválidas ou usuário inativo.');
    }

    const hashCalculado = AuthService.hashPassword(senhaPlana, user.salt);
    const hashesIguais = crypto.timingSafeEqual(
      Buffer.from(hashCalculado),
      Buffer.from(user.hashSenha)
    );

    if (!hashesIguais) {
      throw new Error('Credenciais inválidas ou usuário inativo.');
    }

    await this.usuarioRepo.updateLastAccess(user.id);

    return {
      id: user.id,
      usuario: user.usuario,
      papel: user.papel
    };
  }

  public async createUser(dados: {
    usuario: string;
    senhaPlana: string;
    papel: string;
    operadorResponsavel: string;
  }) {
    if (dados.senhaPlana.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    if (!Object.values(PapelUsuario).includes(dados.papel as any)) {
      throw new Error(`Papel inválido. Valores aceitos: ${Object.values(PapelUsuario).join(', ')}`);
    }

    const existente = await this.usuarioRepo.findByUsername(dados.usuario);
    if (existente) {
      throw new Error(`Usuário '${dados.usuario}' já está cadastrado.`);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashSenha = AuthService.hashPassword(dados.senhaPlana, salt);

    const novo = await this.usuarioRepo.create({
      usuario: dados.usuario,
      hashSenha,
      salt,
      papel: dados.papel
    });

    await this.journalRepo.record(
      'CRIAR',
      'Usuario',
      dados.operadorResponsavel,
      null,
      { id: novo.id, usuario: novo.usuario, papel: novo.papel }
    );

    return {
      id: novo.id,
      usuario: novo.usuario,
      papel: novo.papel,
      criadoEm: novo.criadoEm
    };
  }

  public async listUsers() {
    return this.usuarioRepo.listAll();
  }
}
