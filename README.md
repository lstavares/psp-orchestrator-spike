# psp-orchestrator-spike

POC backend em NestJS para simular uma camada de orquestração de pagamentos com múltiplos PSPs mockados.

## Objetivo

- Receber uma intenção de pagamento
- Escolher um provider por prioridade em memória: `A > B > C`
- Registrar decisões de routing e tentativas de pagamento
- Fazer fallback apenas para erros técnicos
- Encerrar sem fallback quando houver recusa de negócio
- Consultar o status de um pagamento

## Stack

- NestJS com TypeScript
- PostgreSQL
- TypeORM
- Docker Compose
- Jest

## Rodando

```bash
docker compose up --build
```

A API sobe em `http://localhost:3000`.

Para rodar fora do Docker, crie um `.env` a partir do `.env.example`, instale as dependências e execute:

```bash
npm install
npm run build
npm start
```

## Endpoints

### `POST /payments/authorize`

Exemplo de aprovação direta no provider `A`:

```bash
curl -X POST http://localhost:3000/payments/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "currency": "BRL",
    "merchantId": "merchant-001",
    "externalReference": "order-1001",
    "mockOutcomes": {
      "A": { "status": "APPROVED" }
    }
  }'
```

Exemplo de fallback técnico: `A` retorna `TIMEOUT`, `B` aprova e `C` não é tentado.

```bash
curl -X POST http://localhost:3000/payments/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 12500,
    "currency": "BRL",
    "merchantId": "merchant-001",
    "externalReference": "order-1002",
    "mockOutcomes": {
      "A": { "status": "TECHNICAL_ERROR", "errorType": "TIMEOUT" },
      "B": { "status": "APPROVED" }
    }
  }'
```

Exemplo de recusa de negócio: `A` recusa e o pagamento encerra como `DECLINED` sem tentar `B` ou `C`.

```bash
curl -X POST http://localhost:3000/payments/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "currency": "BRL",
    "merchantId": "merchant-001",
    "externalReference": "order-1003",
    "mockOutcomes": {
      "A": { "status": "BUSINESS_DECLINED", "errorType": "INSUFFICIENT_FUNDS" },
      "B": { "status": "APPROVED" }
    }
  }'
```

Exemplo de falha final: todos os providers retornam erros técnicos.

```bash
curl -X POST http://localhost:3000/payments/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 9900,
    "currency": "BRL",
    "merchantId": "merchant-001",
    "externalReference": "order-1004",
    "mockOutcomes": {
      "A": { "status": "TECHNICAL_ERROR", "errorType": "TIMEOUT" },
      "B": { "status": "TECHNICAL_ERROR", "errorType": "NETWORK_ERROR" },
      "C": { "status": "TECHNICAL_ERROR", "errorType": "PROVIDER_UNAVAILABLE" }
    }
  }'
```

### `GET /payments/:id`

```bash
curl http://localhost:3000/payments/<payment-id>
```

A resposta inclui o pagamento, status final, tentativas e decisões de routing.

## Modelo de simulação

`mockOutcomes` é opcional. Quando um provider não tem outcome configurado, o mock retorna `APPROVED`.

Formato:

```json
{
  "A": { "status": "TECHNICAL_ERROR", "errorType": "TIMEOUT" },
  "B": { "status": "APPROVED" },
  "C": { "status": "BUSINESS_DECLINED", "errorType": "INSUFFICIENT_FUNDS" }
}
```

Enums:

- `PaymentStatus`: `AUTHORIZED`, `DECLINED`, `FAILED`
- `AttemptStatus`: `APPROVED`, `BUSINESS_DECLINED`, `TECHNICAL_ERROR`
- `ProviderErrorType`: `TIMEOUT`, `NETWORK_ERROR`, `PROVIDER_UNAVAILABLE`, `INSUFFICIENT_FUNDS`, `INVALID_CARD`, `INVALID_CVV`, `DO_NOT_HONOR`, `FRAUD_SUSPECTED`

Erros técnicos aceitos para fallback:

- `TIMEOUT`
- `NETWORK_ERROR`
- `PROVIDER_UNAVAILABLE`

Erros de negócio encerram o pagamento como `DECLINED`:

- `INSUFFICIENT_FUNDS`
- `INVALID_CARD`
- `INVALID_CVV`
- `DO_NOT_HONOR`
- `FRAUD_SUSPECTED`

## Decisões arquiteturais

- `PaymentAttempt` guarda `requestPayload` e `responsePayload` como `jsonb`; não há tabela separada para `ProviderResponse` nesta primeira versão
- O routing fica em memória para manter a POC simples e explícita
- O fluxo é síncrono: a API chama os mocks e persiste o resultado final na mesma requisição
- `TYPEORM_SYNCHRONIZE=true` é usado para facilitar o spike; em produção, isso deveria virar migrations
- Fora do escopo inicial: integração real com PSP, autenticação, fila assíncrona e idempotência forte

## Testes

```bash
npm test
```

Os testes unitários cobrem o `RoutingEngine`: prioridade, fallback técnico, recusa sem fallback, esgotamento de providers e providers ativos configurados em memória.


































---
## Pergunta
Tenho alguns repositórios github docs, cujas informações são a respeito de documentações expostas via github pages.

Existe algum meio, cuja atualização do documento, na prática ocorrendo em evento de merge para branch usado no github pages, que tenha uma trigger, de repente via github actions. Que consiga pegar todo o conteúdo/versão, processar via aws lambda function e guardar em um bucket S3?
A finalidade é ter um meio automático de atualizar um KB utilizado em um agente que estou desenvolvendo.
Esse agente está em lambda utilizando GOlang. 

---
##Resposta
Pensou por 28s

Sim. E para o seu caso eu faria o GitHub Actions como produtor da versão e a Lambda como processadora/orquestradora, em vez de colocar a Lambda para sair buscando o conteúdo do GitHub Pages.

A arquitetura que considero mais robusta seria:

Merge / push na branch de documentação
             │
             ▼
      GitHub Actions
             │
             │ checkout do commit exato
             │ build/processamento inicial
             │ gera snapshot/version
             ▼
       S3 /incoming
             │
             │ ObjectCreated
             ▼
      Lambda Processor
          (Go)
             │
             ├── normaliza documentos
             ├── extrai metadata
             ├── remove arquivos antigos
             └── grava versão atual
                    │
                    ▼
              S3 /knowledge-base
                    │
                    ▼
          Bedrock Knowledge Base
             StartIngestionJob
                    │
                    ▼
              Vector Store
                    │
                    ▼
               Seu Agent
              Lambda / Go

Isso casa muito bem com o que você está desenvolvendo.

1. Trigger no merge

Na verdade, eu nem dispararia explicitamente no evento de merge. Se a documentação publicada é determinada por uma branch, use simplesmente:

on:
  push:
    branches:
      - main

ou:

on:
  push:
    branches:
      - gh-pages

Um merge nessa branch gera um push, então você pega o estado efetivamente consolidado da documentação. Além disso, cobre hotfixes ou commits diretos eventualmente feitos nessa branch. O GitHub suporta filtros de branch diretamente no evento push. 

Se você usar:

pull_request:
  types: [closed]

terá que testar:

if: github.event.pull_request.merged == true

Funciona, mas eu considero pior para esse caso porque você está acoplando o processo de sincronização ao mecanismo de PR. Seu evento de negócio real é:

> "Existe uma nova versão oficial da documentação na branch X."



Portanto, push é mais correto.


---

2. O GitHub Actions captura exatamente aquela versão

Aqui está um ponto arquitetural importante.

Eu não faria a Lambda clonar o GitHub.

Isso cria desnecessariamente:

autenticação GitHub dentro da AWS;

tokens/PAT;

download na Lambda;

dependência de rede;

clone potencialmente pesado;

necessidade de descobrir qual commit processar;

mais pontos de falha.


O GitHub Actions já está dentro do repositório e sabe exatamente qual commit causou o evento.

Então:

- uses: actions/checkout@v4

e:

GITHUB_SHA = commit que representa aquela versão

Você ganha rastreabilidade quase de graça.


---

3. Eu armazenaria um snapshot versionado no S3

Por exemplo:

s3://company-agent-kb-source/
|
├── incoming/
│   └── github/
│       └── architecture-docs/
│           └── 76a81d32e4.../
│               ├── docs.tar.gz
│               └── READY.json
│
├── versions/
│   └── architecture-docs/
│       └── 76a81d32e4.../
│
└── current/
    └── architecture-docs/
        ├── authentication.md
        ├── architecture.md
        ├── pix/
        │   ├── dict.md
        │   └── payments.md
        └── metadata.json

O READY.json seria enviado por último.

Exemplo:

{
  "repository": "company/architecture-docs",
  "branch": "main",
  "commit": "76a81d32e49b21...",
  "timestamp": "2026-09-02T23:00:00Z",
  "artifact": "docs.tar.gz"
}

E só este objeto dispararia a Lambda:

ObjectCreated:
prefix: incoming/
suffix: READY.json

Isso é melhor do que fazer:

git action
   ↓
upload arquivo1.md
   ↓ Lambda
upload arquivo2.md
   ↓ Lambda
upload arquivo3.md
   ↓ Lambda
...

porque um repositório com 300 arquivos poderia provocar centenas de invocações concorrentes.

O S3 consegue disparar Lambda em criação/deleção de objetos. A própria AWS alerta para tomar cuidado quando a função escreve no mesmo bucket que a dispara, para não criar loops; prefixes separados resolvem isso. 


---

4. GitHub → AWS sem Access Key

Aqui eu recomendo fortemente OIDC.

Nada de:

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

guardados em Secrets do GitHub.

O GitHub Actions pode obter credenciais temporárias da AWS via OIDC e assumir uma IAM Role. Esse é justamente o fluxo recomendado pelo GitHub/AWS. 

Workflow simplificado:

name: Sync Documentation KB

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: us-east-1
  BUCKET: company-agent-kb-source

jobs:

  publish-kb:

    runs-on: ubuntu-latest

    steps:

      - name: Checkout
        uses: actions/checkout@v4

      - name: Package documentation
        run: |
          tar -czf docs.tar.gz docs/

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-kb-publisher
          aws-region: ${{ env.AWS_REGION }}

      - name: Upload snapshot
        run: |
          aws s3 cp docs.tar.gz \
            s3://${BUCKET}/incoming/${{ github.repository }}/${{ github.sha }}/docs.tar.gz

      - name: Create manifest
        run: |
          cat <<EOF > READY.json
          {
            "repository": "${{ github.repository }}",
            "branch": "${{ github.ref_name }}",
            "commit": "${{ github.sha }}",
            "runId": "${{ github.run_id }}"
          }
          EOF

      - name: Publish manifest
        run: |
          aws s3 cp READY.json \
            s3://${BUCKET}/incoming/${{ github.repository }}/${{ github.sha }}/READY.json

O filtro:

paths:
  - 'docs/**'

também evita reprocessar o KB quando alguém altera, por exemplo:

src/
pom.xml
Dockerfile
README do projeto

sem mudar a documentação relevante.


---

5. A Lambda Go faria o trabalho de verdade

Sua Lambda receberia algo semelhante a:

S3 Event
     ↓
READY.json
     ↓
repo + SHA
     ↓
docs.tar.gz

E então:

func handler(ctx context.Context, event events.S3Event) error {

    // 1. pegar bucket/key do READY.json

    // 2. ler manifest
    //
    // repository
    // sha
    // artifact

    // 3. baixar docs.tar.gz

    // 4. descompactar

    // 5. filtrar formatos suportados
    //
    // .md
    // .txt
    // .html
    // .pdf
    // etc

    // 6. eventualmente normalizar conteúdo

    // 7. gravar:
    //
    // versions/<repo>/<sha>/
    //
    // e
    //
    // current/<repo>/

    // 8. iniciar reindexação do Knowledge Base

    return nil
}

Mas existe uma decisão importante aqui.

Não colocaria versões antigas dentro do prefixo usado pelo KB

Imagine:

kb/
  v1/authentication.md
  v2/authentication.md
  v3/authentication.md

Se o Bedrock indexar isso tudo, seu agente pode receber como contexto três versões contraditórias da documentação.

Isso é péssimo para RAG.

Eu separaria:

versions/

para auditoria/histórico,

e:

current/

como fonte do Knowledge Base.

Por exemplo:

S3

versions/
   repo-a/
      sha-001/
      sha-002/
      sha-003/

kb/
   repo-a/
      authentication.md
      architecture.md
      payments.md

E o Data Source do Bedrock apontaria exclusivamente para:

s3://bucket/kb/

A AWS permite definir um inclusion prefix no S3 Data Source do Knowledge Base. 


---

6. Se o KB for Amazon Bedrock Knowledge Base

Aqui fica ainda melhor.

Depois que sua Lambda termina:

S3 atualizado

ela pode executar:

StartIngestionJob

no Knowledge Base.

O Bedrock então detecta:

arquivos novos;

arquivos modificados;

arquivos removidos;


e sincroniza essas mudanças com o vector store. O conector S3 suporta justamente sincronização incremental. 

Conceitualmente:

client := bedrockagent.NewFromConfig(cfg)

_, err := client.StartIngestionJob(
    ctx,
    &bedrockagent.StartIngestionJobInput{
        KnowledgeBaseId: aws.String(knowledgeBaseID),
        DataSourceId:    aws.String(dataSourceID),
    },
)

A API oficial é exatamente:

StartIngestionJob(
    knowledgeBaseId,
    dataSourceId
)




---

Há ainda uma segunda opção interessante

Hoje o Bedrock também oferece:

IngestKnowledgeBaseDocuments

Ou seja, você pode ingerir documentos diretamente sem fazer um StartIngestionJob completo. 

Então temos duas estratégias:

Estratégia	Melhor quando

StartIngestionJob	quer que o S3 seja a source of truth
IngestKnowledgeBaseDocuments	quer controlar exatamente quais documentos foram alterados


Para documentação GitHub eu começaria com:

S3
+
StartIngestionJob

É menos código e menor complexidade operacional.

Só migraria para ingestão direta se o volume de documentos ou frequência de deploy começar a justificar.


---

E tem uma melhoria que eu faria desde o começo

Em vez de apenas:

document.md

eu adicionaria metadados.

Por exemplo:

{
    "repository": "payments-architecture",
    "commit": "8523a93",
    "branch": "main",
    "path": "docs/pix/dict.md",
    "system": "pix",
    "domain": "payments",
    "version": "2026-09-02"
}

Isso depois abre um mundo de possibilidades no seu agente:

"Pesquise somente documentação do sistema PIX"

ou:

"recupere documentação do repo acquiring"

ou filtros de retrieval por domínio/repositório.


---

E para vários repositórios?

A mesma arquitetura escala sem problema:

GitHub Repo A ─┐
GitHub Repo B ─┤
GitHub Repo C ─┤
GitHub Repo D ─┤
               │
               ▼
           GitHub OIDC
               │
               ▼
          S3 /incoming
               │
               ▼
       Documentation Lambda
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
  /versions            /kb
                        │
                        ▼
                 Bedrock KB
                        │
                        ▼
                    Agent

Cada repositório só precisa carregar praticamente o mesmo reusable workflow.

Você pode inclusive criar em um repositório central:

company/github-actions

um:

.github/workflows/publish-kb.yml

e os outros repos simplesmente chamarem:

jobs:

  kb:
    uses: company/github-actions/.github/workflows/publish-kb.yml@main

    with:
      documentation-path: docs
      knowledge-base: engineering

Isso é muito melhor do que copiar 30 linhas de Actions para cada repo.


---

Uma mudança que eu faria na sua ideia original

Sua ideia está correta no conceito:

> merge → trigger → Lambda → S3 → KB



Mas eu mudaria ligeiramente a responsabilidade:
```
❌

Merge
 ↓
Lambda
 ↓
Lambda baixa GitHub inteiro
 ↓
processa
 ↓
S3
```
para:

```
✅

Merge/push
 ↓
GitHub Action
 ↓
checkout exatamente do SHA
 ↓
snapshot → S3 incoming
 ↓
Lambda
 ↓
normalização/versionamento
 ↓
S3 KB
 ↓
Bedrock ingestion
```
O segundo desenho cria uma fronteira muito melhor entre GitHub e AWS, elimina token GitHub dentro da Lambda e te dá idempotência e rastreabilidade por commit SHA.

E eu colocaria o SHA do Git em praticamente tudo:
```
GitHub SHA
     │
     ├── S3 path
     ├── manifest
     ├── CloudWatch logs
     ├── metadata do documento
     └── ingestion audit
```
Aí, quando o agente responder algo errado, você consegue chegar até:
```
Resposta do Agent
      ↓
chunk recuperado
      ↓
arquivo
      ↓
repo
      ↓
commit SHA
      ↓
PR que introduziu aquela informação

Isso transforma seu KB de uma simples coleção de arquivos em uma pipeline documental auditável.
```
Se esse seu “KB” for especificamente um Amazon Bedrock Knowledge Base, essa arquitetura encaixa quase perfeitamente. Se for um KB/vector store próprio, como OpenSearch, pgvector ou outro, eu mudaria apenas a última parte; GitHub → S3 → Lambda continuaria praticamente igual.
