# GreenCode CLI - Núcleo Operacional de Logística Reversa (AV1)

Projeto desenvolvido para a **Atividade de Avaliação Individual 1 (AV1)** pelo Prof. Eng. Dr. Gerson Penha.

## 1. Características Implementadas
- **Criptografia Simétrica AES-256-CBC**: Todos os dados persistidos em disco (`.enc`) são cifrados com chave mestra de 256 bits gerada no provisionamento inicial e IV aleatório por operação.
- **Journaling Transacional com Rotação Automática**: Log imutável de transações com histórico de auditoria retido por no mínimo 180 dias e rotação automática ao atingir 10 MB. Suporte a rollback (`reverterUltimaTransacao`).
- **Escrita Atômica**: Prevenção de corrupção de dados via arquivos temporários `.tmp` e renomeação atômica pelo sistema de arquivos.
- **Controle de Acesso Baseado em Papéis (RBAC)**: Segregação estrita entre `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR`.
- **Segurança de Credenciais**: Senhas com hash SHA-256 e Salt criptográfico de 16 bytes. Comparação de hash com `crypto.timingSafeEqual` para prevenir ataques de temporização. Sessões com expiração por inatividade de 30 minutos.
- **Regras de Negócio Rigorosas**:
  - `ValidadorCNPJ`: Validação do algoritmo de módulo 11 oficial da Receita Federal e garantia de unicidade.
  - `ValidadorDataEntrada`: Bloqueio de lotes com datas futuras ou anteriores a 90 dias.
  - Bloqueio de desmonte antes da conclusão da triagem do lote.
  - Queda de 2 ou mais níveis de estado físico requer justificativa textual técnica obrigatória.
- **CLI Interativa**: Terminal com `readline`, autocompletação por tecla TAB, histórico persistente de comandos e menus adaptativos por perfil.

---

## 2. Como Executar

### Pré-requisitos
- Node.js versão 18+ (testado em v24.21.0)
- NPM versão 9+

### Instalação das Dependências
```bash
cd av1-cli
npm install
```

### Executar a Jornada Completa de Testes Automatizados
O script executa e valida todos os requisitos, regras de negócio e cenários de falha:
```bash
npm run test:journey
```

### Iniciar o Terminal Interativo CLI
```bash
npm start
```

### Credenciais Padrão Criadas no Primeiro Acesso
- **Usuário**: `admin`
- **Senha**: `admin123` (ou definida no prompt interativo)

---

## 3. Documentação Detalhada
Consulte o arquivo [`docs/AV1_ARQUITETURA_SEGURANCA.md`](file:///c:/Users/Davi/Desktop/AV/av1-cli/docs/AV1_ARQUITETURA_SEGURANCA.md) para a justificativa das decisões arquiteturais e de segurança.

---

## 4. 🎁 Easter Egg
- **Mensagem**: `"Oi prof. Gerson :)"`
- **Onde encontrar**:
  - **No banner inicial do CLI**: Exibido no cabeçalho ao rodar `npm start` (método `iniciarLoop` em [`src/cli/CLIInterface.ts`](src/cli/CLIInterface.ts)).
  - **No comando interativo**: Digite o comando secreto `gerson` ou `easteregg` diretamente no terminal interativo para ver a saudação especial.

