import { Provisionamento } from './security/Provisionamento';
import { ServicoAutenticacao } from './services/ServicoAutenticacao';
import { ServicoOrganizacao } from './services/ServicoOrganizacao';
import { ServicoLote } from './services/ServicoLote';
import { ServicoEquipamento } from './services/ServicoEquipamento';
import { ServicoRelatorio } from './services/ServicoRelatorio';
import { CLIInterface } from './cli/CLIInterface';

async function main() {
  const provisionamento = new Provisionamento('./data');
  const { repo } = provisionamento.inicializarOuCarregar();

  const servicoAuth = new ServicoAutenticacao(repo);
  const servicoOrg = new ServicoOrganizacao(repo);
  const servicoLote = new ServicoLote(repo);
  const servicoEquip = new ServicoEquipamento(repo);
  const servicoRelatorio = new ServicoRelatorio(repo);

  const cli = new CLIInterface(
    servicoAuth,
    servicoOrg,
    servicoLote,
    servicoEquip,
    servicoRelatorio,
    repo,
    './data'
  );

  cli.iniciarLoop();
}

main().catch(erro => {
  console.error('[ERRO CRÍTICO] Falha na inicialização do GreenCode CLI:', erro);
  process.exit(1);
});
