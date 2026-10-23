import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { CriptografiaArquivo } from './CriptografiaArquivo';
import { RepositorioArquivo } from '../storage/RepositorioArquivo';
import { Credencial } from '../domain/Credencial';
import { PapelUsuario } from '../domain/enums';

export interface ConfiguracaoMestre {
  versaoSistema: string;
  dataCriacao: string;
  chaveCriptografiaMestra: string;
  parametrosGlobais: {
    aliquotaImpostoPadrao: number;
    coeficienteDepreciacaoAnual: number;
  };
}

export class Provisionamento {
  private diretorioDados: string;
  private caminhoConfigMestre: string;

  constructor(diretorioDados: string = './data') {
    this.diretorioDados = path.resolve(diretorioDados);
    this.caminhoConfigMestre = path.join(this.diretorioDados, 'master.config.json');
  }

  public existeProvisionamento(): boolean {
    return fs.existsSync(this.caminhoConfigMestre);
  }

  public carregarConfiguracao(): ConfiguracaoMestre {
    if (!this.existeProvisionamento()) {
      throw new Error('Sistema não provisionado. Execute o provisionamento inicial.');
    }
    const conteudo = fs.readFileSync(this.caminhoConfigMestre, 'utf-8');
    return JSON.parse(conteudo);
  }

  public async executarProvisionamentoInterativo(): Promise<{ repo: RepositorioArquivo; chaveMestra: string }> {
    console.log('\n======================================================');
    console.log('       GREENCODE - MODO DE PROVISIONAMENTO INICIAL     ');
    console.log('======================================================');
    console.log('Nenhum arquivo mestre de configuração foi detectado.');
    console.log('Iniciando o provisionamento do administrador do sistema...');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const pergunta = (query: string): Promise<string> =>
      new Promise(resolve => rl.question(query, resolve));

    let senhaAdmin = '';
    while (!senhaAdmin || senhaAdmin.length < 6) {
      senhaAdmin = await pergunta('\nDefina uma senha para o usuário administrador (mínimo 6 caracteres): ');
      if (senhaAdmin.length < 6) {
        console.log('[ERRO] A senha deve conter pelo menos 6 caracteres.');
      }
    }
    rl.close();

    return this.executarProvisionamentoAutomatico('admin', senhaAdmin);
  }

  public executarProvisionamentoAutomatico(
    usuarioAdmin: string = 'admin',
    senhaAdmin: string = 'admin123'
  ): { repo: RepositorioArquivo; chaveMestra: string } {
    if (!fs.existsSync(this.diretorioDados)) {
      fs.mkdirSync(this.diretorioDados, { recursive: true });
    }

    const cripto = new CriptografiaArquivo();
    const chaveMestra = cripto.gerarChave();

    const config: ConfiguracaoMestre = {
      versaoSistema: '1.0.0-cli',
      dataCriacao: new Date().toISOString(),
      chaveCriptografiaMestra: chaveMestra,
      parametrosGlobais: {
        aliquotaImpostoPadrao: 0.12,
        coeficienteDepreciacaoAnual: 0.20
      }
    };

    // Grava o arquivo de configuração mestre
    fs.writeFileSync(this.caminhoConfigMestre, JSON.stringify(config, null, 2), 'utf-8');

    // Inicializa o repositório criptografado
    const repo = new RepositorioArquivo(this.diretorioDados, chaveMestra);

    // Cria o primeiro administrador
    const credencialAdmin = Credencial.criarComSenhaPlana(
      usuarioAdmin,
      senhaAdmin,
      PapelUsuario.ADMINISTRADOR
    );
    repo.salvarEntidade('credenciais', credencialAdmin, 'PROVISIONAMENTO_INICIAL');

    // Salva os parâmetros globais
    repo.salvarEntidade('parametros', { id: 'CONFIG_GLOBAL', ...config.parametrosGlobais }, 'PROVISIONAMENTO_INICIAL');

    console.log('\n[SUCESSO] Provisionamento concluído com êxito!');
    console.log(`[INFO] Chave de criptografia AES-256 gerada.`);
    console.log(`[INFO] Administrador '${usuarioAdmin}' cadastrado com sucesso.\n`);

    return { repo, chaveMestra };
  }

  public inicializarOuCarregar(): { repo: RepositorioArquivo; chaveMestra: string; novoProvisionamento: boolean } {
    if (!this.existeProvisionamento()) {
      const { repo, chaveMestra } = this.executarProvisionamentoAutomatico('admin', 'admin123');
      return { repo, chaveMestra, novoProvisionamento: true };
    }

    const config = this.carregarConfiguracao();
    const repo = new RepositorioArquivo(this.diretorioDados, config.chaveCriptografiaMestra);
    return { repo, chaveMestra: config.chaveCriptografiaMestra, novoProvisionamento: false };
  }
}
