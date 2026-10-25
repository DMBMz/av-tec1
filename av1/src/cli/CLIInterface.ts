import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { ServicoAutenticacao } from '../services/ServicoAutenticacao';
import { ServicoOrganizacao } from '../services/ServicoOrganizacao';
import { ServicoLote } from '../services/ServicoLote';
import { ServicoEquipamento } from '../services/ServicoEquipamento';
import { ServicoRelatorio } from '../services/ServicoRelatorio';
import { Sessao } from '../domain/Credencial';
import { EstadoFisico, PapelUsuario, StatusRastreamento, TipoEquipamento } from '../domain/enums';
import { RepositorioArquivo } from '../storage/RepositorioArquivo';

export class CLIInterface {
  private autenticacao: ServicoAutenticacao;
  private organizacao: ServicoOrganizacao;
  private lote: ServicoLote;
  private equipamento: ServicoEquipamento;
  private relatorio: ServicoRelatorio;
  private repositorio: RepositorioArquivo;
  private sessaoAtual: Sessao | null = null;
  private arquivoHistorico: string;
  private rl!: readline.Interface;

  // Lista de comandos conhecidos para autocompletação
  private readonly COMANDOS_BASE = [
    'ajuda', 'login', 'logout', 'meu-perfil', 'sair',
    // Administrador
    'usuario criar', 'usuario listar', 'usuario alterar-senha', 'reverter-transacao',
    // Operador de Cadastro
    'org cadastrar', 'org listar', 'org buscar', 'contrato renovar',
    // Gestor de Almoxarifado
    'lote criar', 'lote listar', 'lote triagem', 'lote buscar',
    'equipamento cadastrar', 'equipamento status', 'equipamento estado', 'equipamento mover',
    // Auditor / Consultas
    'rastrear', 'relatorio org', 'relatorio status', 'relatorio financeiro', 'relatorio auditoria'
  ];

  constructor(
    autenticacao: ServicoAutenticacao,
    organizacao: ServicoOrganizacao,
    lote: ServicoLote,
    equipamento: ServicoEquipamento,
    relatorio: ServicoRelatorio,
    repositorio: RepositorioArquivo,
    diretorioDados: string = './data'
  ) {
    this.autenticacao = autenticacao;
    this.organizacao = organizacao;
    this.lote = lote;
    this.equipamento = equipamento;
    this.relatorio = relatorio;
    this.repositorio = repositorio;
    this.arquivoHistorico = path.join(path.resolve(diretorioDados), '.greencode_history');
  }

  private carregarHistorico(): string[] {
    if (fs.existsSync(this.arquivoHistorico)) {
      try {
        const conteudo = fs.readFileSync(this.arquivoHistorico, 'utf-8');
        return conteudo.split('\n').filter(l => l.trim().length > 0);
      } catch {
        return [];
      }
    }
    return [];
  }

  private salvarComandoNoHistorico(comando: string): void {
    if (!comando || !comando.trim()) return;
    try {
      fs.appendFileSync(this.arquivoHistorico, `${comando.trim()}\n`, 'utf-8');
    } catch {
      // Ignora falhas menores de escrita em histórico
    }
  }

  private completador(line: string): [string[], string] {
    const hits = this.COMANDOS_BASE.filter(c => c.startsWith(line.trim()));
    return [hits.length ? hits : this.COMANDOS_BASE, line];
  }

  public iniciarLoop(): void {
    console.clear();
    console.log('================================================================');
    console.log('      GREENCODE CLI - SISTEMA DE LOGÍSTICA REVERSA v1.0.0      ');
    console.log('   Tecnologia: Node.js + TypeScript | Persistência Criptografada');
    console.log('   Oi prof. Gerson :)                                           ');
    console.log('================================================================');
    console.log('[DICA] Pressione TAB para autocompletar comandos ou digite "ajuda".');
    console.log('Para iniciar, faça login com: login <usuario> <senha>\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.completador.bind(this)
    });

    this.perguntarProximoComando();
  }

  private perguntarProximoComando(): void {
    const promptUsuario = this.sessaoAtual
      ? `[${this.sessaoAtual.getPapel()}:${this.sessaoAtual.getUsuario()}] greencode> `
      : `[DESCONECTADO] greencode> `;

    this.rl.question(promptUsuario, async (entrada: string) => {
      const comando = entrada.trim();
      if (comando) {
        this.salvarComandoNoHistorico(comando);
        try {
          await this.processarComando(comando);
        } catch (erro: any) {
          this.logErro(erro.message || erro);
        }
      }
      this.perguntarProximoComando();
    });
  }

  public async processarComando(entrada: string): Promise<void> {
    const args = this.fatiarArgumentos(entrada);
    if (args.length === 0) return;

    const comandoPrincipal = args[0].toLowerCase();
    const subComando = args.length > 1 ? args[1].toLowerCase() : '';

    // Validação de expiração de sessão
    if (this.sessaoAtual && !this.autenticacao.validarToken(this.sessaoAtual.getToken())) {
      this.logAviso('Sua sessão expirou por inatividade (limite de 30 minutos). Efetue login novamente.');
      this.sessaoAtual = null;
    }

    // Comandos públicos (sem autenticação)
    if (comandoPrincipal === 'sair') {
      console.log('\n[INFO] Finalizando GreenCode CLI. Até breve!');
      process.exit(0);
    }

    if (comandoPrincipal === 'gerson' || comandoPrincipal === 'easteregg') {
      console.log('\n🌟 Oi prof. Gerson :) 🌟\n');
      return;
    }

    if (comandoPrincipal === 'ajuda') {
      this.exibirMenuPorPapel(this.sessaoAtual ? this.sessaoAtual.getPapel() : null);
      return;
    }

    if (comandoPrincipal === 'login') {
      if (args.length < 3) {
        this.logErro('Uso correto: login <usuario> <senha>');
        return;
      }
      const usuario = args[1];
      const senha = args[2];
      try {
        this.sessaoAtual = this.autenticacao.login(usuario, senha);
        this.logSucesso(`Autenticado com sucesso como '${this.sessaoAtual.getUsuario()}' [Papel: ${this.sessaoAtual.getPapel()}]`);
        this.exibirMenuPorPapel(this.sessaoAtual.getPapel());
      } catch (e: any) {
        this.logErro(`Falha de autenticação: ${e.message}`);
      }
      return;
    }

    // Todos os comandos a seguir exigem autenticação
    if (!this.sessaoAtual) {
      this.logAviso('Operação não permitida. Você precisa estar autenticado. Digite: login <usuario> <senha>');
      return;
    }

    const papel = this.sessaoAtual.getPapel();
    const operador = this.sessaoAtual.getUsuario();
    const flags = this.extrairFlags(args);

    if (comandoPrincipal === 'logout') {
      this.autenticacao.logout(this.sessaoAtual.getToken());
      this.sessaoAtual = null;
      this.logSucesso('Desconectado com sucesso.');
      return;
    }

    if (comandoPrincipal === 'meu-perfil') {
      console.log(`\n[PERFIL] Usuário: ${this.sessaoAtual.getUsuario()}`);
      console.log(`[PERFIL] Papel: ${this.sessaoAtual.getPapel()}`);
      console.log(`[PERFIL] Sessão Expira em: ${this.sessaoAtual.getExpiracao().toLocaleTimeString()}\n`);
      return;
    }

    // --- COMANDOS DE ADMINISTRADOR ---
    if (comandoPrincipal === 'usuario') {
      this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR]);

      if (subComando === 'criar') {
        const novoUser = flags.user || args[2];
        const novaSenha = flags.pass || args[3];
        const papelStr = (flags.papel || args[4] || 'AUDITOR').toUpperCase();

        if (!novoUser || !novaSenha || !PapelUsuario[papelStr as keyof typeof PapelUsuario]) {
          this.logErro('Uso: usuario criar <user> <senha> <ADMINISTRADOR|OPERADOR_CADASTRO|GESTOR_ALMOXARIFADO|AUDITOR>');
          return;
        }

        const cred = this.autenticacao.cadastrarUsuario(novoUser, novaSenha, papelStr as PapelUsuario, operador);
        this.logSucesso(`Novo usuário '${cred.getUsuario()}' criado com sucesso com papel [${cred.getPapel()}].`);
        return;
      }

      if (subComando === 'listar') {
        const lista = this.autenticacao.listarUsuarios();
        console.log('\n--- USUÁRIOS REGISTRADOS NO SISTEMA ---');
        console.table(lista);
        return;
      }
    }

    if (comandoPrincipal === 'reverter-transacao') {
      this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR]);
      const sucesso = this.repositorio.reverterUltimaTransacao();
      if (sucesso) {
        this.logSucesso('Última transação do journal revertida com sucesso (Rollback executado).');
      } else {
        this.logAviso('Não foi possível reverter a transação (journal vazio ou operação irreversível).');
      }
      return;
    }

    // --- COMANDOS DE CADASTRO / ORGANIZAÇÃO ---
    if (comandoPrincipal === 'org') {
      if (subComando === 'cadastrar') {
        this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]);
        const razao = flags.razao;
        const cnpj = flags.cnpj;
        const ie = flags.ie || 'ISENTO';
        const endereco = flags.endereco || 'Endereço Comercial Padrão';
        const telefone = flags.tel || '(11) 99999-0000';
        const email = flags.email || 'contato@empresa.com.br';
        const valorContrato = flags.valor ? parseFloat(flags.valor) : 1500.00;

        if (!razao || !cnpj) {
          this.logErro('Uso: org cadastrar --razao "Empresa SA" --cnpj 12.345.678/0001-90 [--ie 123] [--endereco "..."] [--valor 2000]');
          return;
        }

        const orgCriada = this.organizacao.cadastrarOrganizacao({
          razaoSocial: razao,
          cnpj: cnpj,
          inscricaoEstadual: ie,
          enderecoCompleto: endereco,
          telefone: telefone,
          email: email,
          contrato: {
            dataVencimento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            valorMensal: valorContrato,
            renovacaoAutomatica: true
          }
        }, operador);

        this.logSucesso(`Organização '${orgCriada.getRazaoSocial()}' cadastrada com sucesso! [ID: ${orgCriada.getId()}]`);
        return;
      }

      if (subComando === 'listar') {
        const orgs = this.organizacao.listarOrganizacoesAtivas();
        console.log('\n--- ORGANIZAÇÕES CLIENTES ATIVAS ---');
        console.table(orgs.map(o => ({
          id: o.getId(),
          razaoSocial: o.getRazaoSocial(),
          cnpj: o.getCnpj(),
          telefone: o.getTelefone(),
          contratoVigente: o.getContratoVigente()?.estaVigente() ? 'SIM' : 'NÃO/EXPIRADO'
        })));
        return;
      }
    }

    if (comandoPrincipal === 'contrato' && subComando === 'renovar') {
      this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.OPERADOR_CADASTRO]);
      const orgId = flags.org || args[2];
      const dias = flags.dias ? parseInt(flags.dias, 10) : 365;

      if (!orgId) {
        this.logErro('Uso: contrato renovar --org <ID_OU_NOME> [--dias 365]');
        return;
      }

      const novoVencimento = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
      this.organizacao.renovarContrato(orgId, novoVencimento, operador);
      this.logSucesso(`Contrato da organização '${orgId}' renovado até ${novoVencimento.toISOString().split('T')[0]}.`);
      return;
    }

    // --- COMANDOS DE LOTES E ALMOXARIFADO ---
    if (comandoPrincipal === 'lote') {
      if (subComando === 'criar') {
        this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
        const orgId = flags.org;
        const nf = flags.nf || `NF-${Math.floor(Math.random() * 100000)}`;
        const transp = flags.transp || 'Transportadora Padrão';
        const dataEntradaStr = flags.data || new Date().toISOString().split('T')[0];

        if (!orgId) {
          this.logErro('Uso: lote criar --org <ORG_ID> --nf <NUMERO_NF> --transp <TRANSPORTADORA> [--data YYYY-MM-DD]');
          return;
        }

        const loteCriado = this.lote.criarLote({
          dataEntrada: dataEntradaStr,
          organizacaoId: orgId,
          notaFiscal: nf,
          transportadora: transp,
          observacoes: flags.obs || 'Recebimento de lote para logística reversa'
        }, operador);

        this.logSucesso(`Lote '${loteCriado.getId()}' criado com sucesso para Organização '${orgId}'.`);
        return;
      }

      if (subComando === 'listar') {
        const lotes = this.lote.listarTodosLotes();
        console.log('\n--- LOTES REGISTRADOS NO SISTEMA ---');
        console.table(lotes.map(l => ({
          id: l.getId(),
          org: l.getOrganizacaoId(),
          data: l.getDataEntrada().toISOString().split('T')[0],
          nf: l.getNotaFiscal(),
          status: l.getStatusProcessamento(),
          equipamentos: l.getEquipamentos().length,
          pesoTotalKg: l.calcularPesoTotal()
        })));
        return;
      }

      if (subComando === 'triagem') {
        this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
        const loteId = flags.id || args[2];
        if (!loteId) {
          this.logErro('Uso: lote triagem --id <LOTE_ID>');
          return;
        }

        const relatorio = this.lote.processarTriagem(loteId, operador);
        this.logSucesso(`Triagem do lote '${loteId}' concluída com sucesso!`);
        console.log(relatorio);
        return;
      }
    }

    // --- COMANDOS DE EQUIPAMENTO ---
    if (comandoPrincipal === 'equipamento') {
      if (subComando === 'cadastrar') {
        this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
        const loteId = flags.lote;
        const tipoStr = (flags.tipo || 'NOTEBOOK').toUpperCase();
        const marca = flags.marca || 'Genérica';
        const modelo = flags.modelo || 'Padrão';
        const ano = flags.ano ? parseInt(flags.ano, 10) : 2021;
        const estadoStr = (flags.estado || 'BOM_ESTADO').toUpperCase();
        const peso = flags.peso ? parseFloat(flags.peso) : 2.5;

        if (!loteId || !TipoEquipamento[tipoStr as keyof typeof TipoEquipamento]) {
          this.logErro('Uso: equipamento cadastrar --lote <LOTE_ID> --tipo <NOTEBOOK|MONITOR|COMPUTADOR_MESA|SERVIDOR|...> [--marca X] [--modelo Y] [--ano 2021] [--peso 2.5]');
          return;
        }

        const eq = this.equipamento.cadastrarEquipamento({
          loteId: loteId,
          tipo: tipoStr as TipoEquipamento,
          marca: marca,
          modelo: modelo,
          anoFabricacao: ano,
          estadoFisico: (EstadoFisico[estadoStr as keyof typeof EstadoFisico] || EstadoFisico.BOM_ESTADO),
          pesoQuilogramas: peso,
          posicaoNoLote: 1
        }, operador);

        this.logSucesso(`Equipamento '${eq.getId()}' cadastrado com Código de Barras: [${eq.getCodigoBarrasInterno()}]`);
        return;
      }

      if (subComando === 'status') {
        this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
        const id = flags.id || args[2];
        const novoStatusStr = (flags.status || args[3] || '').toUpperCase();
        const justificativa = flags.motivo || flags.justificativa || '';

        if (!id || !StatusRastreamento[novoStatusStr as keyof typeof StatusRastreamento]) {
          this.logErro('Uso: equipamento status --id <ID_OU_CODIGO> --status <EM_DESMONTE|AGUARDANDO_DESMONTE|PECAS_REAPROVEITADAS|...> [--motivo "..."]');
          return;
        }

        this.equipamento.atualizarStatus(id, novoStatusStr as StatusRastreamento, justificativa, operador);
        this.logSucesso(`Status do equipamento '${id}' atualizado para [${novoStatusStr}].`);
        return;
      }

      if (subComando === 'estado') {
        this.verificarPermissao(papel, [PapelUsuario.ADMINISTRADOR, PapelUsuario.GESTOR_ALMOXARIFADO]);
        const id = flags.id || args[2];
        const novoEstadoStr = (flags.estado || args[3] || '').toUpperCase();
        const justificativa = flags.motivo || flags.justificativa || '';

        if (!id || !EstadoFisico[novoEstadoStr as keyof typeof EstadoFisico]) {
          this.logErro('Uso: equipamento estado --id <ID> --estado <NOVO|BOM_ESTADO|DANIFICADO_LEVE|DANIFICADO_GRAVE|INSERVIVEL> [--motivo "..."]');
          return;
        }

        this.equipamento.atualizarEstadoFisico(id, novoEstadoStr as EstadoFisico, justificativa, operador);
        this.logSucesso(`Estado físico do equipamento '${id}' reavaliado para [${novoEstadoStr}].`);
        return;
      }
    }

    // --- COMANDO DE RASTREABILIDADE ---
    if (comandoPrincipal === 'rastrear') {
      const idOuCodigo = flags.id || args[1];
      if (!idOuCodigo) {
        this.logErro('Uso: rastrear <ID_OU_CODIGO_BARRAS>');
        return;
      }

      const res = this.equipamento.rastrearEquipamento(idOuCodigo);
      const eq = res.equipamento;
      console.log('\n======================================================');
      console.log(`RASTREABILIDADE COMPLETA: ${eq.getCodigoBarrasInterno()} (ID: ${eq.getId()})`);
      console.log(`Tipo: ${eq.getTipo()} | Marca: ${eq.getMarca()} | Modelo: ${eq.getModelo()} (${eq.getAnoFabricacao()})`);
      console.log(`Lote Origem: ${eq.getLoteId()} | Estado Físico: ${eq.getEstadoFisico()} | Peso: ${eq.getPesoQuilogramas()} kg`);
      console.log(`Status Atual: ${eq.getStatusRastreamento()} | Depreciação: ${(res.depreciacao * 100).toFixed(1)}%`);
      if (eq.getJustificativaUltimaAlteracao()) {
        console.log(`Última Justificativa Registrada: "${eq.getJustificativaUltimaAlteracao()}"`);
      }
      console.log('--- HISTÓRICO DE MOVIMENTAÇÕES AUDITADO ---');
      console.table(res.historico);
      console.log('======================================================\n');
      return;
    }

    // --- COMANDOS DE RELATÓRIO ---
    if (comandoPrincipal === 'relatorio') {
      if (subComando === 'org') {
        const orgId = flags.org || args[2];
        if (!orgId) {
          this.logErro('Uso: relatorio org --org <ID_ORGANIZACAO>');
          return;
        }
        console.log(this.relatorio.gerarRelatorioPorOrganizacao(orgId));
        return;
      }

      if (subComando === 'status') {
        const stStr = (flags.status || args[2] || 'EM_DESMONTE').toUpperCase();
        console.log(this.relatorio.gerarRelatorioPorStatus(stStr as StatusRastreamento));
        return;
      }

      if (subComando === 'financeiro') {
        console.log(this.relatorio.gerarRelatorioFinanceiro());
        return;
      }

      if (subComando === 'auditoria') {
        console.log(this.relatorio.gerarRelatorioAuditoria());
        return;
      }
    }

    this.logAviso(`Comando não reconhecido: '${entrada}'. Digite 'ajuda' para verificar os comandos disponíveis.`);
  }

  public exibirMenuPorPapel(papel: PapelUsuario | null): void {
    console.log('\n=================== MENU DE COMANDOS ===================');
    console.log('Comandos Gerais:');
    console.log('  login <usuario> <senha>         - Conecta no sistema');
    console.log('  logout                          - Encerra a sessão');
    console.log('  meu-perfil                      - Exibe status e validade do token');
    console.log('  rastrear <ID_OU_CODIGO>         - Consulta histórico e ciclo do equipamento');
    console.log('  sair                            - Encerra o terminal CLI');

    if (!papel) {
      console.log('\nEfetue login para visualizar os comandos operacionais específicos.');
      console.log('========================================================\n');
      return;
    }

    if (papel === PapelUsuario.ADMINISTRADOR) {
      console.log('\nOpções de Administrador:');
      console.log('  usuario criar <user> <pass> <papel>  - Cadastra novo operador');
      console.log('  usuario listar                       - Lista todos os usuários');
      console.log('  reverter-transacao                   - Executa rollback no Journal');
    }

    if (papel === PapelUsuario.ADMINISTRADOR || papel === PapelUsuario.OPERADOR_CADASTRO) {
      console.log('\nOpções de Cadastro:');
      console.log('  org cadastrar --razao "X" --cnpj 00.000.000/0001-00  - Registra organização cliente');
      console.log('  org listar                                           - Lista organizações ativas');
      console.log('  contrato renovar --org <ID> [--dias 365]             - Renova vigência contratual');
    }

    if (papel === PapelUsuario.ADMINISTRADOR || papel === PapelUsuario.GESTOR_ALMOXARIFADO) {
      console.log('\nOpções de Almoxarifado e Triagem:');
      console.log('  lote criar --org <ID> --nf <NF> --transp <NOME>      - Registra entrada de lote');
      console.log('  lote listar                                          - Lista lotes recebidos');
      console.log('  equipamento cadastrar --lote <ID> --tipo <TIPO>      - Registra equipamento no lote');
      console.log('  lote triagem --id <LOTE_ID>                          - Conclui a triagem técnica');
      console.log('  equipamento status --id <ID> --status <STATUS>       - Atualiza status (ex: EM_DESMONTE)');
      console.log('  equipamento estado --id <ID> --estado <ESTADO>       - Reavalia integridade física');
    }

    console.log('\nOpções de Relatórios & Auditoria:');
    console.log('  relatorio org --org <ID>                             - Métricas e carbono por organização');
    console.log('  relatorio status --status <STATUS>                   - Equipamentos em determinada etapa');
    console.log('  relatorio financeiro                                 - MRR e valor de reciclagem');
    console.log('  relatorio auditoria                                  - Trilha imutável do Journal');
    console.log('========================================================\n');
  }

  private verificarPermissao(papelAtual: PapelUsuario, papeisPermitidos: PapelUsuario[]): void {
    if (!papeisPermitidos.includes(papelAtual)) {
      throw new Error(`Acesso Negado: Seu perfil '${papelAtual}' não tem permissão para esta operação.`);
    }
  }

  private fatiarArgumentos(linha: string): string[] {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/gi;
    const tokens: string[] = [];
    let match;
    do {
      match = regex.exec(linha);
      if (match != null) {
        tokens.push(match[1] ? match[1] : match[2] ? match[2] : match[0]);
      }
    } while (match != null);
    return tokens;
  }

  private extrairFlags(args: string[]): Record<string, string> {
    const flags: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const chave = args[i].substring(2).toLowerCase();
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          flags[chave] = args[i + 1];
          i++;
        } else {
          flags[chave] = 'true';
        }
      }
    }
    return flags;
  }

  private logSucesso(msg: string): void {
    console.log(`\x1b[32m[SUCESSO]\x1b[0m ${msg}`);
  }

  private logAviso(msg: string): void {
    console.log(`\x1b[33m[AVISO]\x1b[0m ${msg}`);
  }

  private logErro(msg: string): void {
    console.log(`\x1b[31m[ERRO]\x1b[0m ${msg}`);
  }
}
