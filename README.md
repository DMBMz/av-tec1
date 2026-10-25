# GreenCode - Plataforma de Logística Reversa e Economia Circular

Repositório contendo a entrega completa das atividades avaliativas **AV1** e **AV2** da disciplina ministrada pelo **Prof. Gerson Penha**.

---

## 🌿 Estrutura das Branches do Repositório

Este repositório foi organizado em **branches dedicadas** para cada uma das avaliações:

| Branch | Conteúdo | Descrição |
|---|---|---|
| [`main`](https://github.com/DMBMz/av-tec1/tree/main) | `README.md` e `.gitignore` | Visão geral, documentação central e guia de navegação entre branches |
| [`av1`](https://github.com/DMBMz/av-tec1/tree/av1) | Pasta `av1/` | **Atividade 1 (AV1)**: Sistema de linha de comando (CLI) seguro com persistência em arquivos criptografados (AES-256), journaling transacional e RBAC |
| [`av2`](https://github.com/DMBMz/av-tec1/tree/av2) | Pasta `av2/` | **Atividade 2 (AV2)**: Monólito servidor web com API RESTful em Fastify, TypeScript, Prisma ORM, controle de concorrência otimista (`versao`) e autenticação JWT |

---

## 🔄 Como Navegar Entre as Branches

Para clonar o repositório e alternar entre as atividades:

```bash
# Clonar o repositório
git clone https://github.com/DMBMz/av-tec1.git
cd av-tec1

# Acessar os arquivos e código da AV1:
git checkout av1

# Acessar os arquivos e código da AV2:
git checkout av2
```

---

## 🚀 Como Executar Cada Atividade

### 1. Executando a AV1 (Branch `av1`)

Após alternar para a branch `av1` (`git checkout av1`):

```bash
cd av1
npm install

# Executar a jornada completa de testes automatizados (100% dos requisitos do PDF):
npm run test:journey

# Iniciar o terminal interativo CLI:
npm start
```

* **Credenciais padrão do primeiro acesso:** Usuário `admin` | Senha `admin123`.
* **Easter Egg:** Localizado no banner inicial da CLI (`iniciarLoop`) e via comando secreto `gerson` em [`av1/src/cli/CLIInterface.ts`](https://github.com/DMBMz/av-tec1/blob/av1/av1/src/cli/CLIInterface.ts). Mensagem: `"Oi prof. Gerson :)"`.
* **Diagrama de Classes:** Disponível em [`av1/diagrama/`](https://github.com/DMBMz/av-tec1/tree/av1/av1/diagrama).
* **Documentação de Segurança:** [`av1/docs/AV1_ARQUITETURA_SEGURANCA.md`](https://github.com/DMBMz/av-tec1/blob/av1/av1/docs/AV1_ARQUITETURA_SEGURANCA.md).

---

### 2. Executando a AV2 (Branch `av2`)

Após alternar para a branch `av2` (`git checkout av2`):

```bash
cd av2
npm install

# Inicializar o banco de dados e aplicar a carga inicial (seed):
npm run prisma:push
npm run prisma:seed

# Executar a suíte de testes automatizados da API REST (100% dos requisitos do PDF):
npm run test:api

# Iniciar o servidor HTTP Fastify em modo desenvolvimento:
npm run dev
```

* **API Base:** [http://localhost:3000](http://localhost:3000)
* **Swagger UI Interativo:** [http://localhost:3000/docs](http://localhost:3000/docs)
* **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)
* **Easter Egg:** Localizado no endpoint `GET /health` (campo `easterEgg`), na rota `GET /easteregg` e no banner do servidor em [`av2/src/server.ts`](https://github.com/DMBMz/av-tec1/blob/av2/av2/src/server.ts). Mensagem: `"Oi prof. Gerson :)"`.
* **Diagramas Monólito e ER:** Disponíveis em [`av2/diagramas/`](https://github.com/DMBMz/av-tec1/tree/av2/av2/diagramas).
* **Documentação Técnica:** [`av2/docs/AV2_ARQUITETURA_MONOLITO.md`](https://github.com/DMBMz/av-tec1/blob/av2/av2/docs/AV2_ARQUITETURA_MONOLITO.md).

---

## 🎁 Easter Eggs do Projeto

Nas duas branches das avaliações foi inserido o easter egg `"Oi prof. Gerson :) "` conforme solicitado:

* **Na AV1 (Branch `av1`)**:
  - **Arquivo:** [`av1/src/cli/CLIInterface.ts`](https://github.com/DMBMz/av-tec1/blob/av1/av1/src/cli/CLIInterface.ts)
  - **Onde encontrar:** Exibido no cabeçalho/banner inicial ao executar o CLI (`npm start` no método `iniciarLoop`) e também ao digitar o comando secreto `gerson` (ou `easteregg`) no prompt interativo.
* **Na AV2 (Branch `av2`)**:
  - **Arquivo:** [`av2/src/server.ts`](https://github.com/DMBMz/av-tec1/blob/av2/av2/src/server.ts)
  - **Onde encontrar:** Retornado na resposta JSON do endpoint de integridade `GET /health` (campo `easterEgg`), na rota dedicada `GET /easteregg` e no banner do console ao iniciar o servidor HTTP (`npm run dev` no método `start`).

---

## 📊 Matriz Comparativa de Requisitos

| Requisito Avaliado | Atendimento na AV1 (Branch `av1`) | Atendimento na AV2 (Branch `av2`) |
|---|---|---|
| **Linguagem & Runtime** | Node.js + TypeScript | Node.js + TypeScript |
| **Persistência de Dados** | Arquivos de texto criptografados (AES-256) | Prisma ORM (PostgreSQL / SQLite) |
| **Mecanismo de Journaling** | Log imutável com retenção de 180 dias e rotação (>10MB) | Tabela `journal_transacoes` no banco |
| **Controle Transacional** | Escrita atômica em disco (`.tmp` + rename) e Rollback | `prisma.$transaction` e Concorrência Otimista (`versao`) |
| **Autenticação & Sessão** | SHA-256 + Salt individual e expiração em 30 min | JWT stateless (`@fastify/jwt`) e senhas com Salt |
| **RBAC (Papéis)** | Administrador, Op. Cadastro, Gestor Almoxarifado, Auditor | Middleware `authenticate` e hook `authorize` |
| **Validação de CNPJ** | Algoritmo oficial de módulo 11 e unicidade estrita | Validador de módulo 11 e restrição de unicidade no banco |
| **Regras de Negócio** | Data limite (90 dias), desmonte pós-triagem, justificativa em queda física | Mesmas regras transportadas para a camada de Services |
| **Interface do Usuário** | Terminal Readline com TAB completion e histórico persistente | API RESTful padronizada com Swagger/OpenAPI |
| **Testes Automatizados** | Script de jornada completa com cenários de falha | Suíte de testes de integração com `app.inject` |
| **Documentação Técnica** | Relatório de Arquitetura de Segurança | Relatório de Arquitetura Monolítica e Trade-offs |
