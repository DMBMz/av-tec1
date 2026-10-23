import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EquipamentoService } from '../services/EquipamentoService';
import { authenticate, authorize } from '../middlewares/auth';
import { PapelUsuario } from '../types';

export class EquipamentoController {
  private equipService: EquipamentoService;

  constructor() {
    this.equipService = new EquipamentoService();
  }

  public registerRoutes(server: FastifyInstance) {
    server.get(
      '/api/equipamentos',
      { preHandler: [authenticate] },
      this.listar.bind(this)
    );
    server.get(
      '/api/equipamentos/:id',
      { preHandler: [authenticate] },
      this.buscarPorIdOuCodigo.bind(this)
    );
    server.get(
      '/api/equipamentos/:id/rastreabilidade',
      { preHandler: [authenticate] },
      this.rastrear.bind(this)
    );
    server.patch(
      '/api/equipamentos/:id/status',
      { preHandler: [authenticate, authorize([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO])] },
      this.atualizarStatus.bind(this)
    );
    server.patch(
      '/api/equipamentos/:id/estado',
      { preHandler: [authenticate, authorize([PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO])] },
      this.atualizarEstadoFisico.bind(this)
    );
  }

  public async listar(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const equipamentos = await this.equipService.listar(query);
    return reply.send(equipamentos);
  }

  public async buscarPorIdOuCodigo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    try {
      const eq = await this.equipService.buscarPorIdOuCodigo(id);
      return reply.send(eq);
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message
      });
    }
  }

  public async rastrear(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    try {
      const rastreio = await this.equipService.rastrear(id);
      return reply.send(rastreio);
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message
      });
    }
  }

  public async atualizarStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const { status, justificativa, versaoEsperada } = request.body as any;

    if (!status) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Campo status é obrigatório.'
      });
    }

    try {
      const resultado = await this.equipService.atualizarStatus(
        id,
        status,
        justificativa,
        request.user.usuario,
        versaoEsperada
      );
      return reply.send({
        message: 'Status atualizado com sucesso!',
        ...resultado
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message
      });
    }
  }

  public async atualizarEstadoFisico(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const { estadoFisico, justificativa, versaoEsperada } = request.body as any;

    if (!estadoFisico) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Campo estadoFisico é obrigatório.'
      });
    }

    try {
      const eqAtualizado = await this.equipService.atualizarEstadoFisico(
        id,
        estadoFisico,
        justificativa,
        request.user.usuario,
        versaoEsperada
      );
      return reply.send({
        message: 'Estado físico reavaliado com sucesso!',
        equipamento: eqAtualizado
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
