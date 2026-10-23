import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../services/AuthService';
import { authenticate, authorize } from '../middlewares/auth';
import { PapelUsuario } from '../types';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public registerRoutes(server: FastifyInstance) {
    server.post('/api/auth/login', this.login.bind(this));
    server.get('/api/auth/me', { preHandler: [authenticate] }, this.me.bind(this));
    server.post(
      '/api/usuarios',
      { preHandler: [authenticate, authorize([PapelUsuario.ADMINISTRADOR])] },
      this.criarUsuario.bind(this)
    );
    server.get(
      '/api/usuarios',
      { preHandler: [authenticate, authorize([PapelUsuario.ADMINISTRADOR])] },
      this.listarUsuarios.bind(this)
    );
  }

  public async login(request: FastifyRequest, reply: FastifyReply) {
    const { usuario, senha } = request.body as any;
    if (!usuario || !senha) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Campos usuario e senha são obrigatórios.'
      });
    }

    try {
      const userPayload = await this.authService.authenticate(usuario, senha);
      const token = (request.server as any).jwt.sign(userPayload, { expiresIn: '8h' });

      return reply.send({
        message: 'Autenticado com sucesso!',
        token,
        usuario: userPayload
      });
    } catch (err: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message
      });
    }
  }

  public async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      usuarioLogado: request.user
    });
  }

  public async criarUsuario(request: FastifyRequest, reply: FastifyReply) {
    const { usuario, senha, papel } = request.body as any;
    if (!usuario || !senha || !papel) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Campos usuario, senha e papel são obrigatórios.'
      });
    }

    try {
      const novo = await this.authService.createUser({
        usuario,
        senhaPlana: senha,
        papel,
        operadorResponsavel: request.user.usuario
      });
      return reply.status(201).send(novo);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message
      });
    }
  }

  public async listarUsuarios(request: FastifyRequest, reply: FastifyReply) {
    const usuarios = await this.authService.listUsers();
    return reply.send(usuarios);
  }
}
