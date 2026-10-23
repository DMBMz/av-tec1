import { FastifyReply, FastifyRequest } from 'fastify';
import { UsuarioTokenPayload } from '../types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UsuarioTokenPayload;
    user: UsuarioTokenPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Token de autenticação ausente, expirado ou inválido.'
    });
  }
}

export function authorize(papeisPermitidos: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const usuarioLogado = request.user as UsuarioTokenPayload;
    if (!usuarioLogado) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Usuário não autenticado.'
      });
    }

    if (!papeisPermitidos.includes(usuarioLogado.papel)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `Acesso negado: Perfil '${usuarioLogado.papel}' não possui permissão para este recurso.`
      });
    }
  };
}
