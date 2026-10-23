import { prisma } from '../config/prisma';

export class UsuarioRepository {
  public async findByUsername(usuario: string) {
    return prisma.usuario.findUnique({
      where: { usuario }
    });
  }

  public async findById(id: string) {
    return prisma.usuario.findUnique({
      where: { id }
    });
  }

  public async create(data: {
    usuario: string;
    hashSenha: string;
    salt: string;
    papel: string;
    ativo?: boolean;
  }) {
    return prisma.usuario.create({
      data: {
        usuario: data.usuario,
        hashSenha: data.hashSenha,
        salt: data.salt,
        papel: data.papel,
        ativo: data.ativo ?? true
      }
    });
  }

  public async updateLastAccess(id: string) {
    return prisma.usuario.update({
      where: { id },
      data: { ultimoAcesso: new Date() }
    });
  }

  public async listAll() {
    return prisma.usuario.findMany({
      select: {
        id: true,
        usuario: true,
        papel: true,
        ativo: true,
        ultimoAcesso: true,
        criadoEm: true
      }
    });
  }
}
