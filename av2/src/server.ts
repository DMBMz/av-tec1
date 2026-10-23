import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ENV } from './config/env';
import { prisma } from './config/prisma';
import { AuthController } from './controllers/AuthController';
import { OrganizacaoController } from './controllers/OrganizacaoController';
import { LoteController } from './controllers/LoteController';
import { EquipamentoController } from './controllers/EquipamentoController';
import { RelatorioController } from './controllers/RelatorioController';

export function buildServer() {
  const app = fastify({
    logger: ENV.NODE_ENV === 'test' ? false : { level: 'info' }
  });

  // CORS
  app.register(cors, {
    origin: true
  });

  // JWT
  app.register(jwt, {
    secret: ENV.JWT_SECRET
  });

  // Swagger OpenAPI
  app.register(swagger, {
    openapi: {
      info: {
        title: 'GreenCode - API RESTful Monolítica (AV2)',
        description: 'Documentação OpenAPI da plataforma de logística reversa e economia circular.',
        version: '1.0.0'
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });

  // Rota de Health Check
  app.get('/health', async () => {
    return {
      status: 'UP',
      versao: '1.0.0-monolith',
      banco: 'Conectado (Prisma ORM)',
      timestamp: new Date().toISOString()
    };
  });

  // Registro das Rotas dos Controladores
  const authController = new AuthController();
  const orgController = new OrganizacaoController();
  const loteController = new LoteController();
  const equipController = new EquipamentoController();
  const relatorioController = new RelatorioController();

  authController.registerRoutes(app);
  orgController.registerRoutes(app);
  loteController.registerRoutes(app);
  equipController.registerRoutes(app);
  relatorioController.registerRoutes(app);

  return app;
}

async function start() {
  const app = buildServer();

  // Tratamento de Encerramento Gracioso (Graceful Shutdown)
  const shutdown = async (signal: string) => {
    app.log.info(`Recebido sinal ${signal}. Encerrando servidor graciosamente...`);
    try {
      await app.close();
      await prisma.$disconnect();
      app.log.info('Conexões finalizadas com sucesso. Processo encerrado.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Erro durante encerramento gracioso.');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: ENV.PORT, host: ENV.HOST });
    console.log(`\n======================================================`);
    console.log(`🚀 GreenCode Monólito Servidor HTTP iniciado com sucesso!`);
    console.log(`📡 URL Principal: http://${ENV.HOST}:${ENV.PORT}`);
    console.log(`📑 Swagger UI Interativo: http://${ENV.HOST}:${ENV.PORT}/docs`);
    console.log(`❤️  Health Check: http://${ENV.HOST}:${ENV.PORT}/health`);
    console.log(`======================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
