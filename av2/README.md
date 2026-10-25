# GreenCode Monólito Servidor Web com Prisma ORM (AV2)

Projeto desenvolvido para a **Atividade de Avaliação Individual 2 (AV2)** pelo Prof. Eng. Dr. Gerson Penha.

## 1. Características Implementadas
- **Arquitetura em Camadas (Controller - Service - Repository)**: Separação rigorosa de responsabilidades garantindo manutenibilidade e isolamento das regras de negócio.
- **Fastify HTTP Server**: Servidor de alta performance com CORS, suporte nativo a schemas, documentação OpenAPI automática via Swagger e encerramento gracioso (*Graceful Shutdown*).
- **Prisma ORM**: Modelagem de dados normalizada, mapeamento objeto-relacional com tipagem estrita de ponta a ponta e transações atômicas com `prisma.$transaction`.
- **Controle de Concorrência Otimista (Optimistic Locking)**: Coluna `versao` em todos os modelos de negócio para mitigar o problema de atualizações concorrentes (*lost updates*).
- **Autenticação Stateless com JWT (`@fastify/jwt`)**: Emissão e verificação de tokens Bearer com controle de acesso baseado em papéis (RBAC): `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR`.
- **Suporte Duplo de Banco de Dados**:
  - **SQLite**: Pré-configurado para execução instantânea sem necessidade de containers.
  - **PostgreSQL**: Configurado via `docker-compose.yml` e `prisma/schema.postgresql.prisma`.
- **Script de Carga de Dados (Seed)**: Popula a base com organizações, contratos, lotes em diferentes estágios, equipamentos catalogados e histórico de movimentações.
- **Suite de Testes de Integração Automatizada**: Valida todos os endpoints, códigos de status HTTP e cenários de erro/bloqueio de negócio.

---

## 2. Como Executar

### Pré-requisitos
- Node.js versão 18+ (testado em v24.21.0)
- NPM versão 9+

### Instalação
```bash
cd av2-monolith
npm install
```

### Inicialização do Banco de Dados e Carga de Seed
```bash
npm run prisma:push
npm run prisma:seed
```

### Execução dos Testes Automatizados da API REST
```bash
npm run test:api
```

### Iniciar o Servidor em Modo Desenvolvimento
```bash
npm run dev
```
O servidor estará disponível em:
- **API Base**: `http://localhost:3000`
- **Swagger UI Interativo**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`

### Credenciais Pré-configuradas no Seed:
| Usuário | Senha | Papel |
|---|---|---|
| `admin` | `admin123` | `ADMINISTRADOR` |
| `operador_cad` | `cad123` | `OPERADOR_CADASTRO` |
| `gestor_almox` | `almox123` | `GESTOR_ALMOXARIFADO` |
| `auditor_fiscal` | `audit123` | `AUDITOR` |

---

## 3. Utilizando com PostgreSQL e Docker Compose (Opcional)
Caso deseje utilizar o PostgreSQL como banco de dados:
```bash
# 1. Inicie o container PostgreSQL
docker compose up -d

# 2. Ajuste o schema e o .env:
# Copie o schema PostgreSQL:
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# No arquivo .env, descomente a linha do DATABASE_URL do PostgreSQL:
# DATABASE_URL="postgresql://greencode:greencode_secret@localhost:5432/greencode_db?schema=public"

# 3. Sincronize e popule:
npm run prisma:push
npm run prisma:seed
```

---

## 4. Documentação Técnica Completa
Consulte o arquivo [`docs/AV2_ARQUITETURA_MONOLITO.md`](file:///c:/Users/Davi/Desktop/AV/av2-monolith/docs/AV2_ARQUITETURA_MONOLITO.md) para análise técnica dos trade-offs arquiteturais.

---

## 5. 🎁 Easter Egg
- **Mensagem**: `"Oi prof. Gerson :)"`
- **Onde encontrar**:
  - **No endpoint de integridade**: `GET http://localhost:3000/health` (campo `easterEgg` no JSON de resposta).
  - **Na rota dedicada**: `GET http://localhost:3000/easteregg` (retorna `{ "mensagem": "Oi prof. Gerson :)" }`).
  - **No console ao inicializar o servidor**: Exibido no banner de inicialização do Fastify ao rodar `npm run dev` (arquivo [`src/server.ts`](src/server.ts)).

