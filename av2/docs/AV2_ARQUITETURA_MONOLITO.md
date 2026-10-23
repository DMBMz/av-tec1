# Documento de Arquitetura de Software e Engenharia de Sistemas (AV2)

**Projeto**: GreenCode - Monólito Servidor Web com API RESTful  
**Disciplina**: Atividade de Avaliação Individual 2 (AV2)  
**Professor**: Eng. Dr. Gerson Penha  
**Pilha Tecnológica**: Node.js, TypeScript, Fastify, Prisma ORM, PostgreSQL (via Docker Compose) e SQLite.

---

## 1. Visão Geral da Evolução Arquitetural
Na **Atividade 1 (AV1)**, o GreenCode foi concebido como um núcleo operacional em linha de comando (CLI), dependente de arquivos de texto criptografados simetricamente (AES-256) e journaling append-only em disco. Essa fundação permitiu consolidar com precisão o modelo de domínio da logística reversa e as regras de negócio de triagem, depreciação contábil e auditoria.

Na **Atividade 2 (AV2)**, o sistema evolui para uma **Arquitetura Monolítica Servidora de Alta Performance**, expondo uma API RESTful completa, com autenticação stateless baseada em tokens JWT e persistência em banco de dados relacional gerenciada pelo **Prisma ORM**.

---

## 2. Decisões Arquiteturais e Justificativas Técnicas (Trade-offs)

### 2.1. Adoção da Arquitetura Monolítica
- **Contexto**: Para uma startup em estágio inicial de tração, a sobrecarga operacional de microsserviços (orquestração de containers, service mesh, latência de rede entre serviços e complexidade de transações distribuídas do tipo Saga) impõe custos desproporcionais aos benefícios.
- **Vantagens do Monólito Modular**: Código unificado, facilidade de depuração, integridade referencial nativa via chaves estrangeiras no SGBD, transações atômicas ACID locais e simplicidade de implantação contínua (CI/CD).
- **Evolutividade**: A estrita separação em camadas permite que, no futuro, domínios específicos (ex: motor de cálculo de carbono ou cotações de metais) sejam extraídos para serviços autônomos sem ruptura do núcleo do negócio.

### 2.2. Fastify em Detrimento do Express
- **Desempenho**: O Fastify processa até o dobro de requisições por segundo em comparação ao Express, graças ao seu roteador radix tree altamente otimizado e à serialização rápida de JSON via `fast-json-stringify`.
- **Validação com Schemas**: Suporte nativo a JSON Schema para validação declarativa de payloads de entrada e serialização de respostas.
- **Tratamento Estruturado de Erros**: Ciclo de vida previsível com hooks (`onRequest`, `preHandler`, `onError`) e suporte nativo a `async/await`.
- **Graceful Shutdown**: Implementação nativa de encerramento gracioso (`app.close()` + `prisma.$disconnect()`), garantindo que conexões em andamento sejam finalizadas sem perda de transações ao reiniciar o container.

### 2.3. Prisma ORM vs Consultas SQL Manuais
- **Resolução do Impedance Mismatch**: O Prisma preenche a lacuna entre o modelo relacional (tabelas, chaves e constraints) e o modelo orientado a objetos do TypeScript (tipos estáticos, interfaces e relacionamentos).
- **Segurança de Tipos de Ponta a Ponta**: As consultas geradas pelo Prisma Client possuem tipagem estrita gerada a partir do `schema.prisma`. Erros de sintaxe ou de nomes de colunas são detectados em tempo de compilação, eliminando bugs em produção.
- **Migrações e Versionamento Declarativo**: O Prisma gerencia a evolução do esquema através de migrações declarativas controladas (`prisma migrate`), mantendo o histórico de alterações rastreável no Git.
- **Transações Atômicas Seguras**: Através de `prisma.$transaction`, blocos de leitura e escrita executam atomicamente com isolamento completo.

### 2.4. Transição de Sessões em Disco para Autenticação Stateless (JWT)
- **Desafio no CLI**: Sessões baseadas em memória/disco funcionavam bem para um único operador no terminal, mas não escalam horizontalmente em APIs HTTP consumidas por múltiplas estações ou futuras aplicações Single Page (SPA).
- **Solução JWT (`@fastify/jwt`)**: Tokens auto-contidos assinados criptograficamente, contendo o identificador do usuário e seu papel funcional (`PapelUsuario`). 
- **Desacoplamento**: O servidor não precisa consultar o banco de dados para validar a assinatura e o papel do usuário a cada requisição, reduzindo o I/O do banco. O cabeçalho padronizado `Authorization: Bearer <token>` viabiliza o consumo seguro por qualquer cliente HTTP.

---

## 3. Estruturação em Camadas (Controller - Service - Repository)

A aplicação foi estruturada no consagrado padrão corporativo de três camadas:

```
[ Cliente HTTP / SPA / Postman ]
               │
               ▼  (HTTP / JSON + JWT)
┌──────────────────────────────────────────────┐
│  CAMADA DE APRESENTAÇÃO (Controllers Fastify) │
│  - Recebe requisições e valida parâmetros    │
│  - Valida JWT e aplica RBAC                  │
│  - Retorna HTTP status codes semânticos      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  CAMADA DE NEGÓCIO (Services)                │
│  - Validações de CNPJ (módulo 11) e datas    │
│  - Regra de desmonte condicionado à triagem  │
│  - Regra de justificativa de estado físico   │
│  - Cálculos de depreciação e emissão de logs │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  CAMADA DE PERSISTÊNCIA (Repositories)       │
│  - Encapsula o Prisma Client                 │
│  - Executa transações atômicas ($transaction)│
│  - Aplica concorrência otimista (versao)     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  BANCO DE DADOS RELACIONAL (PostgreSQL/SQLite)│
│  - Tabelas normalizadas e índices de unicidade│
└──────────────────────────────────────────────┘
```

---

## 4. Concorrência e Transações Atômicas

### 4.1. Controle de Concorrência Otimista (Optimistic Locking)
Em ambientes corporativos concorrentes, múltiplos operadores podem tentar atualizar o mesmo equipamento ou lote simultaneamente. Para impedir o problema de atualizações perdidas (*lost updates*):
- Cada modelo de negócio (`Organizacao`, `Contrato`, `Lote`, `Equipamento`) possui a coluna `versao Int @default(1)`.
- No momento da atualização, a cláusula WHERE exige que `versao` seja igual à versão esperada lida previamente pelo cliente:
  ```typescript
  const resultado = await tx.equipamento.updateMany({
    where: { id, versao: versaoEsperada },
    data: {
      ...novosDados,
      versao: { increment: 1 }
    }
  });
  if (resultado.count === 0) {
    throw new Error('Conflito de concorrência: o registro foi atualizado por outro processo.');
  }
  ```
- Caso outro operador tenha alterado o registro no milissegundo intermediário, a operação é rejeitada com erro de conflito, orientando o cliente a recarregar os dados.

### 4.2. Transações Atômicas com `$transaction`
Operações compostas de alta criticidade são agrupadas em blocos atômicos onde vigora o princípio "tudo ou nada":
1. **Criação de Lote com Equipamentos**: O lote, todos os equipamentos vinculados e suas primeiras movimentações são inseridos dentro da mesma transação. Se qualquer item falhar (ex: código de barras duplicado), toda a operação sofre rollback.
2. **Conclusão de Triagem**: A alteração do status do lote para `TRIAGEM_CONCLUIDA`, a atualização em massa dos equipamentos para `AGUARDANDO_DESMONTE` e a criação dos registros de movimentação para cada item são executadas em bloco.
3. **Atualização de Status e Movimentação**: A mudança do status operacional do equipamento e a gravação da entrada correspondente na tabela `movimentacoes` ocorrem estritamente na mesma transação.

---

## 5. Estratégia de Migração e Script de Seed de Dados

Para viabilizar a transição do sistema de arquivos para o banco relacional e permitir testes imediatos de validação de negócio:
- O script [`prisma/seed.ts`](file:///c:/Users/Davi/Desktop/AV/av2-monolith/prisma/seed.ts) popula a base com um conjunto representativo de entidades:
  - 4 contas de acesso contemplando os 4 papéis (`ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO`, `AUDITOR`).
  - Organizações com CNPJs reais validados e contratos com cláusulas jurídicas e valores mensais.
  - Lotes em diferentes status operacionais (`RECEBIDO`, `TRIAGEM_CONCLUIDA`).
  - Equipamentos de diversas categorias com códigos de barras rastreáveis e histórico cronológico de movimentações.
  - Journal inicial auditando a carga do banco de dados.

---

## 6. Documentação da API RESTful (Endpoints)

| Método | Endpoint | Papéis Permitidos | Descrição |
|---|---|---|---|
| `POST` | `/api/auth/login` | Público | Autentica usuário e retorna JWT de 8h |
| `GET` | `/api/auth/me` | Todos autenticados | Retorna dados do token atual |
| `POST` | `/api/usuarios` | `ADMINISTRADOR` | Cria novo operador do sistema |
| `GET` | `/api/usuarios` | `ADMINISTRADOR` | Lista todos os usuários cadastrados |
| `POST` | `/api/organizacoes` | `ADMINISTRADOR`, `OPERADOR_CADASTRO` | Cadastra organização cliente |
| `GET` | `/api/organizacoes` | Todos autenticados | Lista organizações ativas |
| `GET` | `/api/organizacoes/:id` | Todos autenticados | Consulta detalhes da organização |
| `PUT` | `/api/organizacoes/:id/contrato` | `ADMINISTRADOR`, `OPERADOR_CADASTRO` | Renova vigência do contrato |
| `POST` | `/api/lotes` | `ADMINISTRADOR`, `GESTOR_ALMOXARIFADO` | Cria lote com equipamentos (atômico) |
| `GET` | `/api/lotes` | Todos autenticados | Lista lotes e status de processamento |
| `GET` | `/api/lotes/:id` | Todos autenticados | Consulta lote e equipamentos associados |
| `POST` | `/api/lotes/:id/triagem` | `ADMINISTRADOR`, `GESTOR_ALMOXARIFADO` | Conclui triagem e libera desmonte |
| `GET` | `/api/equipamentos` | Todos autenticados | Lista equipamentos filtrados |
| `GET` | `/api/equipamentos/:id/rastreabilidade` | Todos autenticados | Consulta ciclo e trilha de auditoria |
| `PATCH` | `/api/equipamentos/:id/status` | `ADMINISTRADOR`, `GESTOR_ALMOXARIFADO` | Transição de status (ex: EM_DESMONTE) |
| `PATCH` | `/api/equipamentos/:id/estado` | `ADMINISTRADOR`, `GESTOR_ALMOXARIFADO` | Reavalia estado físico (justificativa) |
| `GET` | `/api/relatorios/organizacao/:id` | Todos autenticados | Métricas de sustentabilidade e carbono |
| `GET` | `/api/relatorios/financeiro` | Todos autenticados | MRR de contratos e valor de reciclagem |
| `GET` | `/api/relatorios/auditoria` | Todos autenticados | Consulta histórico de journal transacional |
| `GET` | `/health` | Público | Verificação de integridade e status do banco |
| `GET` | `/docs` | Público | Interface interativa Swagger / OpenAPI |

---

## 7. Compatibilidade Multiplataforma e Execução

O sistema suporta oficialmente **Windows 10 ou superior**, **Linux Ubuntu 24.04.03 LTS** e distribuições derivadas:
- **Banco PostgreSQL**: Executável em 1 comando com `docker compose up -d`.
- **Banco SQLite**: Disponível nativamente no arquivo `.env` para execução sem necessidade de Docker, garantindo portabilidade absoluta em qualquer ambiente acadêmico ou corporativo.
