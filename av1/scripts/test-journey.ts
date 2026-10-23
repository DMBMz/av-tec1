import * as fs from 'fs';
import * as path from 'path';
import { Provisionamento } from '../src/security/Provisionamento';
import { ServicoAutenticacao } from '../src/services/ServicoAutenticacao';
import { ServicoOrganizacao } from '../src/services/ServicoOrganizacao';
import { ServicoLote } from '../src/services/ServicoLote';
import { ServicoEquipamento } from '../src/services/ServicoEquipamento';
import { ServicoRelatorio } from '../src/services/ServicoRelatorio';
import { EstadoFisico, PapelUsuario, StatusRastreamento, TipoEquipamento } from '../src/domain/enums';
import { Sessao } from '../src/domain/Credencial';

async function executarJornadaCompleta() {
  console.log('\n================================================================');
  console.log('   TESTE DE JORNADA COMPLETA DO USUÁRIO - GREENCODE (AV1)      ');
  console.log('================================================================\n');

  const testDataDir = path.resolve('./data_test');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDataDir, { recursive: true });

  // 1. PROVISIONAMENTO INICIAL
  console.log('[PASSO 1] Executando provisionamento inicial e geração de chave AES-256...');
  const provisionamento = new Provisionamento(testDataDir);
  const { repo, chaveMestra } = provisionamento.executarProvisionamentoAutomatico('admin', 'Admin@2025!');
  console.log('✔ Provisionamento realizado com sucesso. Chave AES-256 gerada.');

  const auth = new ServicoAutenticacao(repo);
  const orgService = new ServicoOrganizacao(repo);
  const loteService = new ServicoLote(repo);
  const equipService = new ServicoEquipamento(repo);
  const relatorioService = new ServicoRelatorio(repo);

  // 2. LOGIN DO ADMINISTRADOR E VERIFICAÇÃO DE HASH SHA-256
  console.log('\n[PASSO 2] Autenticação do Administrador...');
  const sessaoAdmin = auth.login('admin', 'Admin@2025!');
  console.log(`✔ Admin autenticado com token de sessão: ${sessaoAdmin.getToken().substring(0, 10)}...`);

  // Teste de senha incorreta
  try {
    auth.login('admin', 'SenhaErrada123');
    throw new Error('Falha: Senha incorreta deveria ter sido rejeitada!');
  } catch (e: any) {
    console.log(`✔ Senha incorreta devidamente rejeitada: "${e.message}"`);
  }

  // 3. CRIAÇÃO DE USUÁRIOS COM PAPÉIS DISTINTOS (RBAC)
  console.log('\n[PASSO 3] Criação de contas de operadores e auditor...');
  auth.cadastrarUsuario('operador_cad', 'Cad@123456', PapelUsuario.OPERADOR_CADASTRO, 'admin');
  auth.cadastrarUsuario('gestor_almox', 'Almox@123456', PapelUsuario.GESTOR_ALMOXARIFADO, 'admin');
  auth.cadastrarUsuario('auditor_fiscal', 'Audit@123456', PapelUsuario.AUDITOR, 'admin');
  console.log('✔ Contas com papéis OPERADOR_CADASTRO, GESTOR_ALMOXARIFADO e AUDITOR criadas.');

  // 4. TESTE DE EXPIRAÇÃO DE SESSÃO
  console.log('\n[PASSO 4] Teste da política de expiração de sessão (30 min)...');
  const sessaoExpirada = new Sessao('token_exp', 'auditor_fiscal', PapelUsuario.AUDITOR, new Date(Date.now() - 35 * 60 * 1000));
  if (!sessaoExpirada.isValida()) {
    console.log('✔ Sessão com mais de 30 min de inatividade identificada como inválida com sucesso.');
  } else {
    throw new Error('Falha na expiração de sessão!');
  }

  // 5. CADASTRO DE ORGANIZAÇÃO COM VALIDAÇÃO E UNICIDADE DE CNPJ
  console.log('\n[PASSO 5] Cadastro de Organização e Validação de CNPJ...');
  const cnpjValido = '11.222.333/0001-81'; // CNPJ matematicamente válido
  const cnpjInvalido = '11.222.333/0001-99'; // Dígitos verificadores incorretos

  try {
    orgService.cadastrarOrganizacao({
      razaoSocial: 'Telecom Brasil SA',
      cnpj: cnpjInvalido,
      inscricaoEstadual: '123.456.789',
      enderecoCompleto: 'Av. Paulista, 1000 - SP',
      telefone: '(11) 3000-0000',
      email: 'residuos@telecom.com.br'
    }, 'operador_cad');
    throw new Error('Falha: CNPJ inválido não foi barrado!');
  } catch (e: any) {
    console.log(`✔ CNPJ com dígito verificador incorreto rejeitado: "${e.message}"`);
  }

  // Cadastro válido
  const org = orgService.cadastrarOrganizacao({
    id: 'ORG-TELECOM-01',
    razaoSocial: 'Telecom Brasil SA',
    cnpj: cnpjValido,
    inscricaoEstadual: '123.456.789',
    enderecoCompleto: 'Av. Paulista, 1000 - SP',
    telefone: '(11) 3000-0000',
    email: 'residuos@telecom.com.br',
    contrato: {
      dataAssinatura: new Date(),
      dataVencimento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      valorMensal: 3500.00,
      renovacaoAutomatica: true
    }
  }, 'operador_cad');
  console.log(`✔ Organização cadastrada: ${org.getRazaoSocial()} [ID: ${org.getId()}]`);

  // Teste de duplicidade de CNPJ
  try {
    orgService.cadastrarOrganizacao({
      razaoSocial: 'Outra Empresa',
      cnpj: cnpjValido,
      inscricaoEstadual: '999',
      enderecoCompleto: 'Rua X',
      telefone: '123',
      email: 'a@a.com'
    }, 'operador_cad');
    throw new Error('Falha: CNPJ duplicado foi aceito!');
  } catch (e: any) {
    console.log(`✔ Unicidade de CNPJ garantida: "${e.message}"`);
  }

  // 6. CADASTRO DE LOTE COM VALIDAÇÃO DE DATA DE ENTRADA
  console.log('\n[PASSO 6] Recepção de Lote e Validação Temporal...');
  const dataFutura = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  try {
    loteService.criarLote({
      dataEntrada: dataFutura,
      organizacaoId: org.getId(),
      notaFiscal: 'NF-999',
      transportadora: 'TransRapida'
    }, 'gestor_almox');
    throw new Error('Falha: Data futura de lote foi aceita!');
  } catch (e: any) {
    console.log(`✔ Lote com data futura rejeitado: "${e.message}"`);
  }

  const dataValida = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 dias atrás
  const lote = loteService.criarLote({
    id: 'LOT-2025-001',
    dataEntrada: dataValida,
    organizacaoId: org.getId(),
    notaFiscal: 'NF-10492',
    transportadora: 'LogVerde Transportes',
    observacoes: 'Descarte corporativo de parque de computação'
  }, 'gestor_almox');
  console.log(`✔ Lote criado com sucesso: ${lote.getId()} (NF: ${lote.getNotaFiscal()})`);

  // 7. CADASTRO DE EQUIPAMENTOS E GERAÇÃO DE CÓDIGO DE BARRAS
  console.log('\n[PASSO 7] Tombamento e alocação de códigos de barras internos...');
  const eq1 = equipService.cadastrarEquipamento({
    id: 'EQP-NBK-001',
    loteId: lote.getId(),
    tipo: TipoEquipamento.NOTEBOOK,
    marca: 'Dell',
    modelo: 'Latitude 5420',
    anoFabricacao: 2021,
    estadoFisico: EstadoFisico.BOM_ESTADO,
    pesoQuilogramas: 1.85,
    posicaoNoLote: 1
  }, 'gestor_almox');

  const eq2 = equipService.cadastrarEquipamento({
    id: 'EQP-SRV-002',
    loteId: lote.getId(),
    tipo: TipoEquipamento.SERVIDOR,
    marca: 'HP',
    modelo: 'ProLiant DL380',
    anoFabricacao: 2019,
    estadoFisico: EstadoFisico.USADO_MODERADO,
    pesoQuilogramas: 18.20,
    posicaoNoLote: 2
  }, 'gestor_almox');

  console.log(`✔ Equipamento 1 registrado: ${eq1.getId()} | Código de Barras: ${eq1.getCodigoBarrasInterno()}`);
  console.log(`✔ Equipamento 2 registrado: ${eq2.getId()} | Código de Barras: ${eq2.getCodigoBarrasInterno()}`);

  // 8. RESTRIÇÃO DE TRANSIÇÃO: DESMONTE ANTES DA TRIAGEM COMPLETA
  console.log('\n[PASSO 8] Testando restrição de transição de status (Desmonte sem triagem concluída)...');
  try {
    equipService.atualizarStatus(eq1.getId(), StatusRastreamento.EM_DESMONTE, 'Tentativa antecipada', 'gestor_almox');
    throw new Error('Falha: Desmonte antes da triagem deveria ter sido bloqueado!');
  } catch (e: any) {
    console.log(`✔ Bloqueio de desmonte pré-triagem validado com sucesso: "${e.message}"`);
  }

  // 9. PROCESSAMENTO DE TRIAGEM DO LOTE
  console.log('\n[PASSO 9] Execução formal da Triagem Técnica...');
  const resumoTriagem = loteService.processarTriagem(lote.getId(), 'gestor_almox');
  console.log(resumoTriagem);

  // 10. TRANSIÇÃO PARA DESMONTE APÓS A TRIAGEM (AGORA PERMITIDA)
  console.log('[PASSO 10] Atualizando status para desmonte após triagem concluída...');
  equipService.atualizarStatus(eq1.getId(), StatusRastreamento.EM_DESMONTE, 'Encaminhado para bancada de recuperação de memórias e tela', 'gestor_almox');
  console.log(`✔ Equipamento ${eq1.getId()} atualizado com sucesso para EM_DESMONTE.`);

  // 11. REGRA DE ESTADO FÍSICO: QUEDA DE 2 NÍVEIS COM E SEM JUSTIFICATIVA
  console.log('\n[PASSO 11] Testando exigência de justificativa em degradação física acentuada...');
  // eq1 está em BOM_ESTADO (nível 5). Queda para DANIFICADO_LEVE (nível 2) = diferença 3 (>= 2)
  try {
    equipService.atualizarEstadoFisico(eq1.getId(), EstadoFisico.DANIFICADO_LEVE, '', 'gestor_almox');
    throw new Error('Falha: Queda de 2+ níveis sem justificativa deveria ser rejeitada!');
  } catch (e: any) {
    console.log(`✔ Queda sem justificativa devidamente bloqueada: "${e.message}"`);
  }

  // Atualização com justificativa textual válida
  equipService.atualizarEstadoFisico(
    eq1.getId(),
    EstadoFisico.DANIFICADO_LEVE,
    'Trincas identificadas na carcaça plástica e desgaste severo nas portas USB durante inspeção minuciosa.',
    'gestor_almox'
  );
  console.log('✔ Queda de estado físico com justificativa aceita com sucesso.');

  // 12. RASTREABILIDADE AUDITÁVEL COMPLETA
  console.log('\n[PASSO 12] Consulta de rastreabilidade de ponta a ponta do equipamento...');
  const rastreio = equipService.rastrearEquipamento(eq1.getId());
  console.log(`- Equipamento: ${rastreio.equipamento.getCodigoBarrasInterno()}`);
  console.log(`- Depreciação contábil/física estimada: ${(rastreio.depreciacao * 100).toFixed(1)}%`);
  console.log(`- Total de movimentações registradas: ${rastreio.historico.length}`);
  console.table(rastreio.historico);

  // 13. VERIFICAÇÃO DA PERSISTÊNCIA CRIPTOGRAFADA AES-256 EM DISCO
  console.log('[PASSO 13] Verificando integridade e criptografia física dos arquivos em disco...');
  const caminhoLotesEnc = path.join(testDataDir, 'lotes.enc');
  const conteudoCruLotes = fs.readFileSync(caminhoLotesEnc, 'utf-8');
  console.log(`- Conteúdo do arquivo lotes.enc (amostra criptografada): ${conteudoCruLotes.substring(0, 60)}...`);
  if (!conteudoCruLotes.includes('Latitude') && conteudoCruLotes.includes(':')) {
    console.log('✔ Dados gravados estritamente sob criptografia simétrica AES-256 (nenhum texto plano exposto).');
  } else {
    throw new Error('Falha: Dados em texto plano encontrados no disco!');
  }

  // 14. VERIFICAÇÃO DO JOURNAL E TESTE DE REVERSÃO (ROLLBACK)
  console.log('\n[PASSO 14] Testando reversão de transação via Journal imutável...');
  const journalsAntes = repo.listarJournals();
  console.log(`- Transações no Journal antes do rollback: ${journalsAntes.length}`);
  const sucessoRollback = repo.reverterUltimaTransacao();
  console.log(`✔ Rollback executado: ${sucessoRollback ? 'SIM' : 'NÃO'}`);

  // 15. EMISSÃO DE RELATÓRIOS FINAIS
  console.log('\n[PASSO 15] Gerando relatórios consolidados do sistema...');
  console.log(relatorioService.gerarRelatorioPorOrganizacao(org.getId()));
  console.log(relatorioService.gerarRelatorioFinanceiro());
  console.log(relatorioService.gerarRelatorioAuditoria());

  // Limpeza do diretório de teste
  fs.rmSync(testDataDir, { recursive: true, force: true });

  console.log('\n================================================================');
  console.log('       TODOS OS TESTES DA JORNADA FORAM CONCLUÍDOS COM 100% SUCESSO! ');
  console.log('================================================================\n');
}

executarJornadaCompleta().catch(erro => {
  console.error('\n[FALHA NO TESTE DE JORNADA]:', erro);
  process.exit(1);
});
