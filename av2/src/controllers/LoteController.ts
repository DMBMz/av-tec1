import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { LoteService } from '../services/LoteService';
import { authenticate, authorize } from '../middlewares/auth';
import { PapelUsuario } from '../types';

export class LoteController {
  private loteService: LoteService;

  constructor() {
    this.loteService = new LoteService();
  }

  public registerRoutes(server: FastifyInstance) {
    server.post(
      '/api/lotes',
      { preHandler: [authenticate, authorize([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO])] },
      this.criar.bind(this)
    );
    server.get(
      '/api/lotes',
      { preHandler: [authenticate] },
      this.listar.bind(this)
    );
    server.get(
      '/api/lotes/:id',
      { preHandler: [authenticate] },
      this.buscarPorId.bind(this)
    );
    server.post(
      '/api/lotes/:id/triagem',
      { preHandler: [authenticate, authorize([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO])] },
      this.concluirTriagem.bind(this)
    );
  }

  public async criar(request: FastifyRequest, reply: FastifyReply) {
    try {
      const lote = await this.loteService.criarLote(
        request.body as any,
        request.user.usuario
      );
      return reply.status(201).send(lote);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message
      });
    }
  }

  public async listar(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const lotes = await this.loteService.listar(query);
    return reply.send(lotes);
  }

  public async buscarPorId(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    try {
      const lote = await this.loteService.buscarPorId(id);
      return reply.send(lote);
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message
      });
    }
  }

  public async concluirTriagem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const { versaoEsperada } = (request.body as any) || {};

    try {
      const lote = await this.loteService.concluirTriagem(
        id,
        request.user.usuario,
        versaoEsperada
      );
      return reply.send({
        message: 'Triagem concluída com sucesso! Equipamentos liberados para desmonte.',
        lote
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message
      });
    }
  }
}
