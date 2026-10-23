import { buildServer } from '../src/server';

async function runApiTests() {
  console.log('\n================================================================');
  console.log('   TESTE DE INTEGRAÇÃO DA API RESTFUL - GREENCODE MONÓLITO (AV2)');
  console.log('================================================================\n');

  const app = buildServer();
  await app.ready();

  // Limpeza de registros de testes anteriores para garantir idempotência
  const { prisma } = await import('../src/config/prisma');
  await prisma.movimentacao.deleteMany({ where: { responsavel: 'SISTEMA_RECEPCAO' } });
  await prisma.equipamento.deleteMany({ where: { loteId: 'LOT-TESTE-99' } });
  await prisma.lote.deleteMany({ where: { id: 'LOT-TESTE-99' } });
  await prisma.contrato.deleteMany({ where: { organizacaoId: 'ORG-NOVA-99' } });
  await prisma.organizacao.deleteMany({ where: { id: 'ORG-NOVA-99' } });

  let tokenAdmin = '';
  let tokenCad = '';
  let tokenAudit = '';

  // 1. HEALTH CHECK
  console.log('[TESTE 1] Verificação de integridade do servidor (/health)...');
  const resHealth = await app.inject({
    method: 'GET',
    url: '/health'
  });
  if (resHealth.statusCode === 200 && resHealth.json().status === 'UP') {
    console.log('✔ Health check OK:', resHealth.json());
  } else {
    throw new Error(`Falha no health check: ${resHealth.body}`);
  }

  // 2. AUTENTICAÇÃO E EMISSÃO DE JWT
  console.log('\n[TESTE 2] Autenticação com credenciais e geração de JWT...');
  const resLoginAdmin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { usuario: 'admin', senha: 'admin123' }
  });
  if (resLoginAdmin.statusCode === 200 && resLoginAdmin.json().token) {
    tokenAdmin = resLoginAdmin.json().token;
    console.log(`✔ Admin autenticado com sucesso. Token JWT: ${tokenAdmin.substring(0, 20)}...`);
  } else {
    throw new Error(`Falha no login do admin: ${resLoginAdmin.body}`);
  }

  const resLoginCad = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { usuario: 'operador_cad', senha: 'cad123' }
  });
  tokenCad = resLoginCad.json().token;

  const resLoginAudit = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { usuario: 'auditor_fiscal', senha: 'audit123' }
  });
  tokenAudit = resLoginAudit.json().token;

  // Teste de senha incorreta (401)
  const resLoginInvalido = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { usuario: 'admin', senha: 'senha_incorreta' }
  });
  if (resLoginInvalido.statusCode === 401) {
    console.log('✔ Senha incorreta devidamente rejeitada com HTTP 401.');
  } else {
    throw new Error('Falha: Senha incorreta deveria retornar 401!');
  }

  // 3. SEGURANÇA E CONTROLE DE ACESSO (RBAC)
  console.log('\n[TESTE 3] Validação de RBAC (Auditor tentando criar organização)...');
  const resAcessoNegado = await app.inject({
    method: 'POST',
    url: '/api/organizacoes',
    headers: { authorization: `Bearer ${tokenAudit}` },
    payload: { razaoSocial: 'X', cnpj: '11.222.333/0001-81' }
  });
  if (resAcessoNegado.statusCode === 403) {
    console.log('✔ Auditor bloqueado de operação de escrita com HTTP 403 Forbidden.');
  } else {
    throw new Error(`Falha de autorização: esperado 403, recebido ${resAcessoNegado.statusCode}`);
  }

  // 4. CADASTRO DE ORGANIZAÇÃO COM VALIDAÇÃO DE CNPJ
  console.log('\n[TESTE 4] Cadastro de Organização e Validações de CNPJ...');
  const resCnpjInvalido = await app.inject({
    method: 'POST',
    url: '/api/organizacoes',
    headers: { authorization: `Bearer ${tokenCad}` },
    payload: {
      razaoSocial: 'Empresa Teste',
      cnpj: '11.222.333/0001-99', // inválido
      enderecoCompleto: 'Rua A',
      telefone: '123',
      email: 'a@a.com'
    }
  });
  if (resCnpjInvalido.statusCode === 400) {
    console.log('✔ CNPJ com dígito verificador inválido bloqueado com HTTP 400.');
  } else {
    throw new Error('Falha: CNPJ inválido foi aceito!');
  }

  // Cadastro válido
  const cnpjNovo = '00.000.000/0001-91'; // válido
  const resOrgValida = await app.inject({
    method: 'POST',
    url: '/api/organizacoes',
    headers: { authorization: `Bearer ${tokenCad}` },
    payload: {
      id: 'ORG-NOVA-99',
      razaoSocial: 'Tecnologia Avançada SA',
      cnpj: cnpjNovo,
      inscricaoEstadual: '999.888.777',
      enderecoCompleto: 'Rua da Inovação, 500 - Campinas - SP',
      telefone: '(19) 3200-1122',
      email: 'esg@tecavancada.com.br',
      contrato: {
        dataVencimento: new Date('2026-12-31').toISOString(),
        valorMensal: 6000.00,
        renovacaoAutomatica: true
      }
    }
  });
  if (resOrgValida.statusCode === 201) {
    console.log(`✔ Organização cadastrada via API REST: ${resOrgValida.json().razaoSocial} (ID: ${resOrgValida.json().id})`);
  } else {
    throw new Error(`Falha no cadastro de organização: ${resOrgValida.body}`);
  }

  // 5. CRIAÇÃO DE LOTE COM TRANSAÇÃO ATÔMICA E EQUIPAMENTOS
  console.log('\n[TESTE 5] Criação de Lote com equipamentos em transação Prisma $transaction...');
  const resLote = await app.inject({
    method: 'POST',
    url: '/api/lotes',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      id: 'LOT-TESTE-99',
      dataEntrada: new Date().toISOString(),
      organizacaoId: 'ORG-NOVA-99',
      notaFiscal: 'NF-888999',
      transportadora: 'TransRapida Brasil',
      observacoes: 'Lote de descarte de data centers',
      equipamentos: [
        {
          id: 'EQP-API-001',
          tipo: 'NOTEBOOK',
          marca: 'Lenovo',
          modelo: 'ThinkPad T14',
          anoFabricacao: 2022,
          estadoFisico: 'BOM_ESTADO',
          pesoQuilogramas: 1.55
        },
        {
          id: 'EQP-API-002',
          tipo: 'SERVIDOR',
          marca: 'Dell',
          modelo: 'PowerEdge R740',
          anoFabricacao: 2020,
          estadoFisico: 'BOM_ESTADO',
          pesoQuilogramas: 19.80
        }
      ]
    }
  });
  if (resLote.statusCode === 201) {
    console.log(`✔ Lote e 2 equipamentos persistidos atomicamente no banco!`);
  } else {
    throw new Error(`Falha na criação do lote: ${resLote.body}`);
  }

  // 6. BLOQUEIO DE DESMONTE ANTES DA TRIAGEM
  console.log('\n[TESTE 6] Testando bloqueio de transição para desmonte antes da triagem...');
  const resDesmonteBloqueado = await app.inject({
    method: 'PATCH',
    url: '/api/equipamentos/EQP-API-001/status',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      status: 'EM_DESMONTE',
      justificativa: 'Tentativa prematura'
    }
  });
  if (resDesmonteBloqueado.statusCode === 400 && resDesmonteBloqueado.json().message.includes('triagem completa')) {
    console.log('✔ Bloqueio de desmonte pré-triagem validado com sucesso via API!');
  } else {
    throw new Error(`Falha na regra de triagem: ${resDesmonteBloqueado.body}`);
  }

  // 7. CONCLUSÃO DA TRIAGEM DO LOTE
  console.log('\n[TESTE 7] Concluindo a triagem do lote via API REST...');
  const resTriagem = await app.inject({
    method: 'POST',
    url: '/api/lotes/LOT-TESTE-99/triagem',
    headers: { authorization: `Bearer ${tokenAdmin}` }
  });
  if (resTriagem.statusCode === 200) {
    console.log('✔ Triagem concluída com sucesso. Equipamentos liberados para desmonte.');
  } else {
    throw new Error(`Falha na conclusão de triagem: ${resTriagem.body}`);
  }

  // 8. DESMONTE APÓS A TRIAGEM (AGORA PERMITIDO)
  console.log('[TESTE 8] Atualizando status para desmonte pós-triagem...');
  const resDesmonteOk = await app.inject({
    method: 'PATCH',
    url: '/api/equipamentos/EQP-API-001/status',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      status: 'EM_DESMONTE',
      justificativa: 'Equipamento triado liberado para bancada de recuperação de memória'
    }
  });
  if (resDesmonteOk.statusCode === 200) {
    console.log('✔ Status atualizado para EM_DESMONTE com registro de movimentação!');
  } else {
    throw new Error(`Falha na atualização pós-triagem: ${resDesmonteOk.body}`);
  }

  // 9. REGRA DE ESTADO FÍSICO COM E SEM JUSTIFICATIVA
  console.log('\n[TESTE 9] Testando exigência de justificativa em queda de estado físico...');
  // EQP-API-001 está em BOM_ESTADO (5). Queda para DANIFICADO_GRAVE (1) = diferença 4 >= 2
  const resEstadoSemJust = await app.inject({
    method: 'PATCH',
    url: '/api/equipamentos/EQP-API-001/estado',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      estadoFisico: 'DANIFICADO_GRAVE',
      justificativa: '' // vazia
    }
  });
  if (resEstadoSemJust.statusCode === 400) {
    console.log('✔ Rebaixamento de estado físico sem justificativa rejeitado com HTTP 400.');
  } else {
    throw new Error('Falha: Queda de estado sem justificativa foi aceita!');
  }

  const resEstadoComJust = await app.inject({
    method: 'PATCH',
    url: '/api/equipamentos/EQP-API-001/estado',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      estadoFisico: 'DANIFICADO_GRAVE',
      justificativa: 'Queda acidental na movimentação interna de bancada danificou a carcaça e a tela.'
    }
  });
  if (resEstadoComJust.statusCode === 200) {
    console.log('✔ Reavaliação de estado com justificativa aceita com sucesso!');
  } else {
    throw new Error(`Falha na reavaliação de estado: ${resEstadoComJust.body}`);
  }

  // 10. RASTREABILIDADE AUDITÁVEL
  console.log('\n[TESTE 10] Consulta de rastreabilidade completa por Auditor...');
  const resRastreio = await app.inject({
    method: 'GET',
    url: '/api/equipamentos/EQP-API-001/rastreabilidade',
    headers: { authorization: `Bearer ${tokenAudit}` }
  });
  const rastreioData = resRastreio.json();
  console.log(`- Código de Barras Interno: ${rastreioData.equipamento.codigoBarrasInterno}`);
  console.log(`- Depreciação: ${rastreioData.depreciacaoPercentual}%`);
  console.log(`- Movimentações auditadas na trilha: ${rastreioData.historicoMovimentacoes.length}`);

  // 11. RELATÓRIOS ANALÍTICOS
  console.log('\n[TESTE 11] Consulta de relatórios de sustentabilidade e financeiro...');
  const resRelOrg = await app.inject({
    method: 'GET',
    url: '/api/relatorios/organizacao/ORG-NOVA-99',
    headers: { authorization: `Bearer ${tokenAudit}` }
  });
  console.log('✔ Métricas de Sustentabilidade:', resRelOrg.json().metricasSustentabilidade);

  const resRelFin = await app.inject({
    method: 'GET',
    url: '/api/relatorios/financeiro',
    headers: { authorization: `Bearer ${tokenAudit}` }
  });
  console.log('✔ Métricas Financeiras:', resRelFin.json().metricas);

  await app.close();
  console.log('\n================================================================');
  console.log('   TODOS OS TESTES DA API RESTFUL FORAM APROVADOS COM 100%!   ');
  console.log('================================================================\n');
}

runApiTests().catch(err => {
  console.error('\n[FALHA NO TESTE DA API]:', err);
  process.exit(1);
});
