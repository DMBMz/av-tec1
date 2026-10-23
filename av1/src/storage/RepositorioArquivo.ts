import * as fs from 'fs';
import * as path from 'path';
import { CriptografiaArquivo } from '../security/CriptografiaArquivo';
import { JournalTransacao } from '../domain/JournalTransacao';

export class RepositorioArquivo {
  private diretorioBase: string;
  private criptografia: CriptografiaArquivo;
  private chaveMestra: string;

  // Limite de 10 MB para rotação de journal conforme especificação
  public static readonly TAMANHO_MAX_JOURNAL_BYTES = 10 * 1024 * 1024;
  // Retenção mínima de 180 dias
  public static readonly RETENCAO_DIAS = 180;

  constructor(diretorioBase: string, chaveMestra: string) {
    this.diretorioBase = path.resolve(diretorioBase);
    this.chaveMestra = chaveMestra;
    this.criptografia = new CriptografiaArquivo();

    if (!fs.existsSync(this.diretorioBase)) {
      fs.mkdirSync(this.diretorioBase, { recursive: true });
    }
  }

  private obterCaminhoCompleto(nomeArquivo: string): string {
    const nomeComExtensao = nomeArquivo.endsWith('.enc') ? nomeArquivo : `${nomeArquivo}.enc`;
    return path.join(this.diretorioBase, nomeComExtensao);
  }

  private lerArquivoCifrado(nomeArquivo: string): any[] {
    const caminho = this.obterCaminhoCompleto(nomeArquivo);
    if (!fs.existsSync(caminho)) {
      return [];
    }

    try {
      const conteudoCifrado = fs.readFileSync(caminho, 'utf-8').trim();
      if (!conteudoCifrado) {
        return [];
      }
      const conteudoPlano = this.criptografia.decifrar(conteudoCifrado, this.chaveMestra);
      return JSON.parse(conteudoPlano);
    } catch (erro) {
      console.error(`[RepositorioArquivo] Erro ao ler/decifrar arquivo ${nomeArquivo}:`, erro);
      throw new Error(`Falha na integridade ou decifragem do arquivo ${nomeArquivo}.`);
    }
  }

  private gravarArquivoCifradoAtomico(nomeArquivo: string, dados: any[]): void {
    const caminhoFinal = this.obterCaminhoCompleto(nomeArquivo);
    const caminhoTmp = `${caminhoFinal}.tmp.${Date.now()}`;

    const jsonPlano = JSON.stringify(dados, null, 2);
    const textoCifrado = this.criptografia.cifrar(jsonPlano, this.chaveMestra);

    // Escrita atômica: grava no arquivo temporário, realiza flush e renomeia
    fs.writeFileSync(caminhoTmp, textoCifrado, 'utf-8');
    fs.renameSync(caminhoTmp, caminhoFinal);
  }

  public salvarEntidade(nomeArquivo: string, entidade: any, usuarioResponsavel: string = 'SISTEMA'): void {
    const entidades = this.lerArquivoCifrado(nomeArquivo);
    const id = entidade.id || (typeof entidade.getId === 'function' ? entidade.getId() : undefined);

    if (!id) {
      throw new Error('Entidade precisa conter a propriedade ou método id/getId.');
    }

    const payload = typeof entidade.toJSON === 'function' ? entidade.toJSON() : entidade;
    const indexExistente = entidades.findIndex(item => item.id === id);

    let dadosAntes = null;
    let operacao = 'CRIAR';

    if (indexExistente >= 0) {
      operacao = 'ATUALIZAR';
      dadosAntes = JSON.parse(JSON.stringify(entidades[indexExistente]));
      entidades[indexExistente] = payload;
    } else {
      entidades.push(payload);
    }

    // Registra a transação no journal antes de persistir a alteração final
    const journal = new JournalTransacao(
      `JRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      operacao,
      nomeArquivo,
      dadosAntes,
      payload,
      usuarioResponsavel
    );
    this.registrarJournal(journal);

    // Persistência atômica da base de dados
    this.gravarArquivoCifradoAtomico(nomeArquivo, entidades);
  }

  public carregarEntidade(nomeArquivo: string, id: string): any {
    const entidades = this.lerArquivoCifrado(nomeArquivo);
    return entidades.find(item => item.id === id) || null;
  }

  public listarEntidades(nomeArquivo: string): any[] {
    return this.lerArquivoCifrado(nomeArquivo);
  }

  public excluirEntidade(nomeArquivo: string, id: string, usuarioResponsavel: string = 'SISTEMA'): void {
    const entidades = this.lerArquivoCifrado(nomeArquivo);
    const indexExistente = entidades.findIndex(item => item.id === id);

    if (indexExistente >= 0) {
      const dadosAntes = entidades[indexExistente];
      entidades.splice(indexExistente, 1);

      const journal = new JournalTransacao(
        `JRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        'EXCLUIR',
        nomeArquivo,
        dadosAntes,
        null,
        usuarioResponsavel
      );
      this.registrarJournal(journal);

      this.gravarArquivoCifradoAtomico(nomeArquivo, entidades);
    }
  }

  public registrarJournal(journal: JournalTransacao): void {
    const nomeJournal = 'journal_transacoes.enc';
    const caminhoJournal = this.obterCaminhoCompleto(nomeJournal);

    // Rotação de Journal quando ultrapassar 10 MB
    if (fs.existsSync(caminhoJournal)) {
      const stats = fs.statSync(caminhoJournal);
      if (stats.size >= RepositorioArquivo.TAMANHO_MAX_JOURNAL_BYTES) {
        this.rotacionarJournal(caminhoJournal);
      }
    }

    const registros = this.lerArquivoCifrado(nomeJournal);
    registros.push(journal.toJSON());
    this.gravarArquivoCifradoAtomico(nomeJournal, registros);
  }

  private rotacionarJournal(caminhoJournalAtual: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const caminhoRotacionado = path.join(this.diretorioBase, `journal_transacoes_${timestamp}.log.enc`);
    try {
      fs.renameSync(caminhoJournalAtual, caminhoRotacionado);
      console.log(`[RepositorioArquivo] Journal rotacionado com sucesso: ${path.basename(caminhoRotacionado)}`);
    } catch (e) {
      console.error('[RepositorioArquivo] Falha ao rotacionar journal:', e);
    }
  }

  public listarJournals(diasHistorico: number = RepositorioArquivo.RETENCAO_DIAS): JournalTransacao[] {
    const nomeJournal = 'journal_transacoes.enc';
    const registros = this.lerArquivoCifrado(nomeJournal);
    const dataLimite = new Date(Date.now() - diasHistorico * 24 * 60 * 60 * 1000);

    return registros
      .filter((r: any) => new Date(r.timestamp).getTime() >= dataLimite.getTime())
      .map((r: any) => JournalTransacao.fromJSON(r));
  }

  public reverterUltimaTransacao(): boolean {
    const nomeJournal = 'journal_transacoes.enc';
    const registros = this.lerArquivoCifrado(nomeJournal);
    if (registros.length === 0) return false;

    const ultimaTransacaoJSON = registros[registros.length - 1];
    const ultimaTransacao = JournalTransacao.fromJSON(ultimaTransacaoJSON);

    if (!ultimaTransacao.reverter()) {
      return false; // Sem dados anteriores para reverter
    }

    const entidades = this.lerArquivoCifrado(ultimaTransacao.getEntidade());
    const id = ultimaTransacao.getDadosAntes().id;
    const idx = entidades.findIndex(e => e.id === id);

    if (idx >= 0) {
      entidades[idx] = ultimaTransacao.getDadosAntes();
    } else {
      entidades.push(ultimaTransacao.getDadosAntes());
    }

    this.gravarArquivoCifradoAtomico(ultimaTransacao.getEntidade(), entidades);

    // Registra no journal o rollback
    const journalRollback = new JournalTransacao(
      `JRN-REVERT-${Date.now()}`,
      'ROLLBACK',
      ultimaTransacao.getEntidade(),
      ultimaTransacao.getDadosDepois(),
      ultimaTransacao.getDadosAntes(),
      'SISTEMA_REVERSAO'
    );
    this.registrarJournal(journalRollback);
    return true;
  }
}
