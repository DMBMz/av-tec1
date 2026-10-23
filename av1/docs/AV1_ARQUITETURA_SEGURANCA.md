# Documento de Arquitetura de Segurança e Engenharia de Software (AV1)

**Projeto**: GreenCode CLI - Núcleo Operacional de Logística Reversa de Eletroeletrônicos  
**Disciplina**: Atividade de Avaliação Individual 1 (AV1)  
**Professor**: Eng. Dr. Gerson Penha  
**Pilha Tecnológica**: Node.js, TypeScript, Criptografia Nativa (`node:crypto`), Persistência em Arquivos Criptografados.

---

## 1. Introdução e Contexto do Empreendimento
O **GreenCode CLI** constitui o alicerce operacional de uma startup intermediadora entre grandes geradores de resíduos eletroeletrônicos (empresas de telecomunicações, bancos, varejistas) e redes especializadas de reciclagem e desmonte. 

O sistema opera estritamente sem banco de dados externo nesta fase, utilizando arquivos de texto estruturados em conjunto com um mecanismo de **Journaling Transacional Imutável** e **Criptografia Simétrica de Alto Padrão (AES-256)**, garantindo conformidade com a Política Nacional de Resíduos Sólidos (PNRS) e com as normas de proteção e auditoria de dados.

---

## 2. Arquitetura de Segurança Adotada

### 2.1. Criptografia Simétrica em Repouso (AES-256-CBC)
- **Algoritmo Selecionado**: Advanced Encryption Standard com chave de 256 bits em modo Cipher Block Chaining (AES-256-CBC).
- **Vetor de Inicialização (IV)**: A cada operação de escrita, um IV aleatório de 16 bytes é gerado por meio de `crypto.randomBytes(16)`. O IV é armazenado concatenado ao texto cifrado no formato `iv:ciphertext`. Isso impede ataques de criptoanálise por análise de frequência e garante que dois registros com dados idênticos produzam saídas cifradas distintas.
- **Justificativa**: O AES-256 é o padrão militar e governamental mais rigoroso do mercado para segurança em repouso. Toda a base de dados (`credenciais.enc`, `organizacoes.enc`, `lotes.enc`, `equipamentos.enc` e `journal_transacoes.enc`) é ilegível caso haja acesso não autorizado ao sistema de arquivos do servidor ou estação de trabalho.

### 2.2. Esquema de Hashing de Senhas e Mitigação de Ataques
- **Algoritmo**: SHA-256 combinado a **Salt Criptográfico Individual de 16 bytes** (`crypto.randomBytes(16)`).
- **Resistência a Rainbow Tables**: O uso de salt único para cada conta de operador impede o uso de tabelas pré-computadas (rainbow tables).
- **Mitigação de Timing Attacks**: A validação da senha utiliza `crypto.timingSafeEqual()`, que efetua comparação em tempo constante, inviabilizando ataques de temporização baseados na latência de resposta do processador.

### 2.3. Gestão e Política de Expiração de Sessão
- **Tempo Limite de Inatividade**: 30 minutos contínuos conforme especificação da atividade.
- **Sliding Expiration**: A cada comando válido emitido pelo operador, o timestamp de expiração é renovado dinamicamente para `agora + 30 minutos`.
- **Invalidação Proativa**: Sessões que excedem o tempo limite são automaticamente revogadas, exigindo nova autenticação (`login <usuario> <senha>`) para a continuidade dos trabalhos.

---

## 3. Integridade e Persistência Atômica

### 3.1. Atomicidade de Escrita (Mecanismo `.tmp` + Renomeação Atômica)
Operações diretas de sobrescrita de arquivos podem resultar em corrupção de dados caso o sistema seja interrompido (queda de energia, finalização brusca de processo). Para anular esse risco, o `RepositorioArquivo` implementa:
1. Geração de arquivo temporário isolado: `caminhoFinal + ".tmp." + timestamp`.
2. Escrita síncrona com flush dos buffers do sistema operacional (`fs.writeFileSync`).
3. Renomeação atômica (`fs.renameSync`), que no nível do sistema de arquivos POSIX e Windows NTFS é uma operação indivisível (swap de ponteiros no descritor do inode/MFT).

### 3.2. Mecanismo de Journaling Transacional Imutável
- **Estrutura**: O arquivo `journal_transacoes.enc` registra cada mutação de estado antes da aplicação definitiva.
- **Campos Auditados**:
  - `id`: Identificador sequencial com timestamp.
  - `timestamp`: Momento exato da transação em UTC (ISO 8601).
  - `operacao`: Tipo da mutação (`CRIAR`, `ATUALIZAR`, `EXCLUIR`, `TRIAGEM`, `ROLLBACK`).
  - `entidade`: Tabela/Arquivo afetado.
  - `dadosAntes`: Fotografia do estado prévio (payload completo).
  - `dadosDepois`: Fotografia do novo estado.
  - `usuarioResponsavel`: Identificador do operador que executou a ação.
- **Política de Retenção de 180 Dias**: Consultas e relatórios mantêm o histórico obrigatório de no mínimo 180 dias.
- **Rotação Automática (> 10 MB)**: Caso o arquivo de journal atinja ou ultrapasse 10 megabytes (10.485.760 bytes), o sistema efetua rotação automática para `journal_transacoes_YYYY-MM-DDTHH-mm-ss.log.enc` e reinicializa um arquivo limpo, assegurando performance constante de I/O.
- **Capacidade de Rollback**: O método `reverterUltimaTransacao()` permite restaurar o estado imediatamente anterior através do `dadosAntes`, registrando a reversão no próprio journal.

---

## 4. Segregação de Responsabilidades (RBAC) e Menus Dinâmicos

O sistema implementa 4 papéis funcionais rigorosamente segregados:

| Papel | Permissões Operacionais |
|---|---|
| **ADMINISTRADOR** | Gestão de contas de operadores, parâmetros globais do sistema, auditoria geral e rollback de transações. |
| **OPERADOR_CADASTRO** | Cadastro de organizações clientes, validação de documentação (CNPJ) e renovação de contratos vigentes. |
| **GESTOR_ALMOXARIFADO** | Recepção de lotes, tombamento de equipamentos, impressão de códigos de barras internos, execução de triagem e movimentação de setores. |
| **AUDITOR** | Consulta irrestrita de rastreabilidade, emissão de relatórios de conformidade e auditoria de logs (acesso estritamente somente-leitura). |

O menu da CLI oculta dinamicamente quaisquer funcionalidades que estejam fora da alçada do usuário atualmente autenticado.

---

## 5. Regras de Negócio e Validações Rígidas

1. **Validação e Unicidade de CNPJ (`ValidadorCNPJ`)**:
   - Algoritmo oficial de módulo 11 conforme legislação da Receita Federal do Brasil.
   - Rejeição de dígitos repetidos e formatações inválidas.
   - Bloqueio imediato de organizações com CNPJ já cadastrado no sistema.
2. **Validação Temporal de Lotes (`ValidadorDataEntrada`)**:
   - Bloqueio de datas futuras.
   - Bloqueio de datas anteriores a mais de 90 dias a contar do dia corrente.
3. **Pré-requisito Obrigatório para Desmonte**:
   - Equipamentos só podem receber status como `AGUARDANDO_DESMONTE`, `EM_DESMONTE` ou `PECAS_REAPROVEITADAS` se o respectivo Lote tiver sua triagem formalmente concluída (`TRIAGEM_CONCLUIDA`).
4. **Degradação de Estado Físico com Justificativa Obrigatória**:
   - O estado físico possui 7 níveis ordenados (`NOVO`, `BOM_ESTADO`, `USADO_LEVE`, `USADO_MODERADO`, `DANIFICADO_LEVE`, `DANIFICADO_GRAVE`, `INSERVIVEL`).
   - Se um equipamento sofrer queda de 2 ou mais níveis em relação ao estado anterior, o sistema rejeita a operação a menos que seja fornecida uma justificativa textual técnica de no mínimo 5 caracteres.

---

## 6. Cenários de Falha Testados e Respostas do Sistema

O script automatizado [`test-journey.ts`](file:///c:/Users/Davi/Desktop/AV/av1-cli/scripts/test-journey.ts) simula a jornada integral e valida as seguintes falhas:

| Cenário de Teste / Falha | Resposta Esperada do Sistema | Resultado Obtido |
|---|---|---|
| Inexistência do arquivo mestre na inicialização | Ativa modo de provisionamento, solicita senha do admin e gera chave AES-256. | Aprovado |
| Autenticação com senha incorreta | Emissão de erro de credenciais inválidas com aborto de sessão. | Aprovado |
| Tentativa de acesso sem autenticação | Mensagem de aviso bloqueando comando e instruindo uso do `login`. | Aprovado |
| Inatividade superior a 30 minutos | Invalidação do token e bloqueio de novos comandos. | Aprovado |
| Cadastro de CNPJ com dígito verificador inválido | Bloqueio pelo `ValidadorCNPJ` antes de gerar transação. | Aprovado |
| Tentativa de cadastrar CNPJ duplicado | Bloqueio por conflito de unicidade de chave de negócio. | Aprovado |
| Cadastro de lote com data futura | Bloqueio pelo `ValidadorDataEntrada` com mensagem informativa. | Aprovado |
| Desvio de equipamento para desmonte sem triagem do lote | Bloqueio com erro de violação de fluxo de logística reversa. | Aprovado |
| Rebaixamento físico em 3 níveis sem justificativa | Exceção de negócio exigindo justificativa técnica. | Aprovado |
| Inspeção dos arquivos em disco | Arquivos legíveis apenas como dados hexadecimais cifrados AES-256. | Aprovado |
| Execução de Rollback transacional | Restauração fiel do estado anterior registrado no journal. | Aprovado |

---

## 7. Compatibilidade Multiplataforma

O sistema foi concebido sem dependências de binários nativos que exijam compilação C/C++, utilizando exclusivamente as APIs padrão do Node.js:
- **Windows 10 ou superior**: Caminhos normalizados via `path.resolve` e `path.join`.
- **Linux Ubuntu 24.04.03 LTS e derivados**: Totalmente compatível com permissões POSIX e execução nativa em Node.js.
