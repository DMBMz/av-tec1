import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(senhaPlana: string, salt: string): string {
  return crypto.createHash('sha256').update(senhaPlana + salt).digest('hex');
}

async function main() {
  console.log('\n======================================================');
  console.log('      SEEDING DO BANCO DE DADOS - GREENCODE (AV2)     ');
  console.log('======================================================');

  // Limpeza prévia para garantir idempotência do seed
  await prisma.movimentacao.deleteMany();
  await prisma.equipamento.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.organizacao.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.journalTransacao.deleteMany();
  await prisma.parametroGlobal.deleteMany();

  // 1. Parâmetros Globais
  await prisma.parametroGlobal.create({
    data: {
      id: 'CONFIG_GLOBAL',
      aliquotaImpostoPadrao: 0.12,
      coeficienteDepreciacaoAnual: 0.20
    }
  });
  console.log('✔ Parâmetros globais inicializados.');

  // 2. Usuários do Sistema (4 Papéis)
  const saltAdmin = crypto.randomBytes(16).toString('hex');
  const saltCad = crypto.randomBytes(16).toString('hex');
  const saltAlmox = crypto.randomBytes(16).toString('hex');
  const saltAudit = crypto.randomBytes(16).toString('hex');

  await prisma.usuario.createMany({
    data: [
      {
        usuario: 'admin',
        hashSenha: hashPassword('admin123', saltAdmin),
        salt: saltAdmin,
        papel: 'ADMINISTRADOR',
        ativo: true
      },
      {
        usuario: 'operador_cad',
        hashSenha: hashPassword('cad123', saltCad),
        salt: saltCad,
        papel: 'OPERADOR_CADASTRO',
        ativo: true
      },
      {
        usuario: 'gestor_almox',
        hashSenha: hashPassword('almox123', saltAlmox),
        salt: saltAlmox,
        papel: 'GESTOR_ALMOXARIFADO',
        ativo: true
      },
      {
        usuario: 'auditor_fiscal',
        hashSenha: hashPassword('audit123', saltAudit),
        salt: saltAudit,
        papel: 'AUDITOR',
        ativo: true
      }
    ]
  });
  console.log('✔ 4 Usuários de teste criados (admin, operador_cad, gestor_almox, auditor_fiscal).');

  // 3. Organizações e Contratos
  const org1 = await prisma.organizacao.create({
    data: {
      id: 'ORG-TELECOM-01',
      razaoSocial: 'Telecom Brasil SA',
      cnpj: '11.222.333/0001-81',
      inscricaoEstadual: '102.304.506-SP',
      enderecoCompleto: 'Av. das Nações Unidas, 12901 - Brooklin Novo, São Paulo - SP',
      telefone: '(11) 3847-9000',
      email: 'sustentabilidade@telecombrasil.com.br',
      contrato: {
        create: {
          dataAssinatura: new Date('2024-01-15'),
          dataVencimento: new Date('2026-01-15'),
          clausulasJson: JSON.stringify([
            'Logística reversa conforme Lei Federal 12.305/2010 (PNRS)',
            'Certificação de descaracterização com número de série',
            'Emissão bimestral de certificado de compensação de carbono'
          ]),
          valorMensal: 4500.00,
          renovacaoAutomatica: true
        }
      }
    }
  });

  const org2 = await prisma.organizacao.create({
    data: {
      id: 'ORG-BANCO-02',
      razaoSocial: 'Banco Digital Futuro SA',
      cnpj: '22.333.444/0001-70',
      inscricaoEstadual: '304.506.708-RJ',
      enderecoCompleto: 'Av. Rio Branco, 156 - Centro, Rio de Janeiro - RJ',
      telefone: '(21) 2500-1000',
      email: 'patrimonio@bancofuturo.com.br',
      contrato: {
        create: {
          dataAssinatura: new Date('2024-06-01'),
          dataVencimento: new Date('2025-12-31'),
          clausulasJson: JSON.stringify([
            'Desmagnetização segura de discos rígidos e mídias de armazenamento',
            'Relatório de auditoria para fins de compliance bancário Bacen'
          ]),
          valorMensal: 8200.00,
          renovacaoAutomatica: true
        }
      }
    }
  });
  console.log('✔ Organizações clientes e contratos vigentes populados.');

  // 4. Lotes de Equipamentos
  const lote1 = await prisma.lote.create({
    data: {
      id: 'LOT-2025-001',
      dataEntrada: new Date('2025-02-10'),
      organizacaoId: org1.id,
      notaFiscal: 'NF-004812',
      transportadora: 'Expresso Verde Logística Ltda',
      statusProcessamento: 'TRIAGEM_CONCLUIDA',
      observacoes: 'Lote de desativação de call center - notebooks e monitores corporativos'
    }
  });

  const lote2 = await prisma.lote.create({
    data: {
      id: 'LOT-2025-002',
      dataEntrada: new Date('2025-02-18'),
      organizacaoId: org2.id,
      notaFiscal: 'NF-099411',
      transportadora: 'TransRapida Cargas',
      statusProcessamento: 'RECEBIDO',
      observacoes: 'Substituição bienal de servidores blade do datacenter'
    }
  });
  console.log('✔ Lotes em múltiplos estágios operacionais criados.');

  // 5. Equipamentos e Histórico de Movimentações
  const eq1 = await prisma.equipamento.create({
    data: {
      id: 'EQP-NBK-001',
      codigoBarrasInterno: 'GC-NOTEBOOK-2025-00001',
      tipo: 'NOTEBOOK',
      marca: 'Dell',
      modelo: 'Latitude 5420 Core i5',
      anoFabricacao: 2021,
      estadoFisico: 'BOM_ESTADO',
      pesoQuilogramas: 1.75,
      loteId: lote1.id,
      posicaoNoLote: 1,
      statusRastreamento: 'AGUARDANDO_DESMONTE',
      movimentacoes: {
        createMany: {
          data: [
            {
              dataHora: new Date('2025-02-10T09:30:00Z'),
              origem: 'RECEBIMENTO_LOTE',
              destino: 'ALMOXARIFADO_ENTRADA',
              responsavel: 'gestor_almox',
              observacao: 'Recepção e triagem visual inicial'
            },
            {
              dataHora: new Date('2025-02-11T14:00:00Z'),
              origem: 'ALMOXARIFADO_ENTRADA',
              destino: 'BANCADA_TRIAGEM_ELETRICA',
              responsavel: 'gestor_almox',
              observacao: 'Triagem técnica de placa-mãe e bateria concluída'
            }
          ]
        }
      }
    }
  });

  const eq2 = await prisma.equipamento.create({
    data: {
      id: 'EQP-MON-002',
      codigoBarrasInterno: 'GC-MONITOR-2025-00002',
      tipo: 'MONITOR',
      marca: 'Samsung',
      modelo: 'SyncMaster 24 Pol',
      anoFabricacao: 2020,
      estadoFisico: 'DANIFICADO_LEVE',
      justificativaEstado: 'Display com riscos superficiais sem prejuízo das placas internas de alimentação',
      pesoQuilogramas: 3.40,
      loteId: lote1.id,
      posicaoNoLote: 2,
      statusRastreamento: 'EM_DESMONTE',
      movimentacoes: {
        createMany: {
          data: [
            {
              dataHora: new Date('2025-02-10T09:35:00Z'),
              origem: 'RECEBIMENTO_LOTE',
              destino: 'ALMOXARIFADO_ENTRADA',
              responsavel: 'gestor_almox',
              observacao: 'Recepção'
            },
            {
              dataHora: new Date('2025-02-12T11:20:00Z'),
              origem: 'ALMOXARIFADO_ENTRADA',
              destino: 'SETOR_EM_DESMONTE',
              responsavel: 'gestor_almox',
              observacao: 'Encaminhado para desmonte e separação de placas e policarbonato'
            }
          ]
        }
      }
    }
  });

  const eq3 = await prisma.equipamento.create({
    data: {
      id: 'EQP-SRV-003',
      codigoBarrasInterno: 'GC-SERVIDOR-2025-00003',
      tipo: 'SERVIDOR',
      marca: 'HP',
      modelo: 'ProLiant DL380 Gen10',
      anoFabricacao: 2019,
      estadoFisico: 'USADO_MODERADO',
      pesoQuilogramas: 16.50,
      loteId: lote2.id,
      posicaoNoLote: 1,
      statusRastreamento: 'AGUARDANDO_TRIAGEM',
      movimentacoes: {
        create: {
          dataHora: new Date('2025-02-18T10:15:00Z'),
          origem: 'RECEBIMENTO_LOTE',
          destino: 'ALMOXARIFADO_ENTRADA',
          responsavel: 'gestor_almox',
          observacao: 'Aguardando agendamento de auditoria e triagem de segurança'
        }
      }
    }
  });
  console.log('✔ Equipamentos com códigos de barras e trilhas de movimentação inseridos.');

  // 6. Registro no Journal
  await prisma.journalTransacao.create({
    data: {
      operacao: 'SEED_INICIAL',
      entidade: 'BANCO_DADOS',
      usuarioResponsavel: 'SISTEMA_SEED',
      dadosDepois: JSON.stringify({
        organizacoes: [org1.id, org2.id],
        lotes: [lote1.id, lote2.id],
        equipamentos: [eq1.id, eq2.id, eq3.id]
      })
    }
  });
  console.log('✔ Journal de auditoria inicial registrado.');

  console.log('\n[SUCESSO] Base de dados populada com dados representativos completos!\n');
}

main()
  .catch((e) => {
    console.error('[ERRO NO SEED]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
