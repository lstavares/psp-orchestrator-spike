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

















Reunião técnica — Integração e fluxo de autenticação

Informações gerais

Participantes identificados
  • Leandro Tavares
  • Alexandre Manoel Souza
  • Outros interlocutores não identificados em trechos pontuais

Duração aproximada: 53 minutos

Objetivo da reunião

Alinhar o desenvolvimento de duas histórias relacionadas ao novo microserviço de integração e revisar o fluxo técnico de autenticação, especialmente a obtenção de code e access token, o tratamento de desafios de autenticação e a separação de rotas para melhorar a clareza da implementação e a observabilidade.

Contexto inicial

Foram mencionadas duas histórias que estavam sendo conduzidas anteriormente pelo Gabi e que seriam repassadas para continuidade.

Uma delas foi identificada como:
  • Criação da nova estrutura do microserviço de integração — 0324

A outra história parece estar relacionada à inclusão de um canal e/ou à implementação de logs e métricas, mas o nome completo não ficou claro na gravação.

Foi considerado vantajoso trabalhar nas duas histórias em sequência, pois elas pertencem à mesma linha técnica e envolvem componentes próximos do serviço de polling já desenvolvido.

Pontos discutidos

1. Relação entre as histórias
  • As duas histórias possuem dependências ou contexto técnico semelhante.
  • A intenção é aproveitar o conhecimento já adquirido no desenvolvimento do serviço de polling.
  • O trabalho não necessariamente será realizado em paralelo, mas uma história poderá ser iniciada logo após a conclusão da outra.
  • Os links das histórias foram compartilhados durante a conversa.

2. Fluxo atual de autenticação

O fluxo descrito durante a reunião foi, em linhas gerais:
  1. A aplicação envia a senha ou o fator devidamente criptografado.
  2. A solicitação chega ao MC.
  3. O MC encaminha a requisição para o RBA.
  4. O RBA consulta o componente ou serviço PW2.
  5. A validação retorna ao RBA.
  6. O RBA devolve o resultado ao MC Service.
  7. O MC Service retorna um access token.

3. Dúvida entre retorno de code e access token

A principal questão técnica foi determinar se o fluxo deve:
  • retornar diretamente um access token; ou
  • retornar primeiro um code, exigindo uma chamada adicional para trocar esse código pelo access token.

De acordo com a documentação consultada durante a reunião, há indícios de que o primeiro retorno deveria ser um code, e não o token final. Isso adicionaria uma etapa ao fluxo atual.

Também foi discutida a possibilidade de o cenário seguir um fluxo semelhante ao implícito, no qual o token já seria retornado diretamente. Esse comportamento ainda precisa ser confirmado com base na documentação e no desenho oficial da arquitetura.

4. Impactos na implementação existente

Caso o fluxo realmente exija a obtenção prévia de um code, será necessário:
  • alterar a implementação atualmente aberta em PR;
  • revisar o ponto exato em que o retorno é processado;
  • incluir a etapa de troca do code pelo token;
  • avaliar mudanças nos controllers e nos casos de uso;
  • revisar a nomenclatura das rotas existentes.

5. Controllers e tratamento do desafio

Foi discutida a necessidade de separar as responsabilidades do fluxo em controllers ou rotas diferentes.

Entre os componentes mencionados estão:
  • Token Controller;
  • Authorize Challenge Controller;
  • Submit Challenge Use Case;
  • fluxo ou caso de uso de Initiate.

O entendimento discutido foi:
  • o Initiate seria responsável por criar ou iniciar o fluxo;
  • na primeira etapa, campos como Client ID e Request URI seriam preenchidos;
  • campos relacionados à sessão e ao envio do fator permaneceriam vazios até a etapa seguinte;
  • o envio ou submissão do desafio aconteceria posteriormente;
  • o tratamento do challenge pode exigir um controller específico.

Também foi levantada a hipótese de utilizar a URI retornada dentro do Submit Challenge Use Case, mas esse encaixe ainda precisa ser validado.

6. Separação de rotas

Houve concordância de que separar as rotas é preferível a concentrar diferentes etapas em um único endpoint.

A separação ajudaria a:
  • eliminar ambiguidades entre início do fluxo e submissão do desafio;
  • identificar com mais clareza a responsabilidade de cada etapa;
  • facilitar manutenção e diagnóstico;
  • permitir métricas específicas;
  • melhorar a observabilidade do processo;
  • identificar rapidamente se uma falha ocorreu no challenge, no submit ou em outra etapa.

A orientação discutida foi seguir a linha de criar uma subdivisão ou rota específica, em linha com um comentário anterior feito pelo Cristian.

Observabilidade

A observabilidade foi apontada como um argumento importante para separar os endpoints.

Se todas as etapas utilizarem a mesma rota, as métricas não deixarão claro em qual ponto do processo ocorreu uma falha. Com rotas distintas, será possível identificar, por exemplo:
  • falha na criação ou início do fluxo;
  • falha no challenge;
  • falha no envio do fator;
  • falha na submissão;
  • falha na obtenção ou troca do token.

Essa separação deverá facilitar tanto o monitoramento quanto a investigação de incidentes.

Acesso à documentação e aos diagramas

Leandro informou que não conseguiu acessar o link dos diagramas compartilhado anteriormente.

Foram testados os ambientes de produção e sandbox, sem sucesso. O endereço citado durante a conversa parece estar relacionado a um domínio interno, mas sua grafia não ficou totalmente clara na gravação.

Será necessário:
  • confirmar o endereço correto;
  • verificar se o acesso exige uma permissão adicional;
  • solicitar a liberação, caso necessário;
  • consultar os diagramas antes de fechar a implementação.

Direcionamentos da reunião
  • Trabalhar as duas histórias de forma sequencial, aproveitando o contexto técnico comum.
  • Validar na documentação se o fluxo retorna diretamente um access token ou se retorna primeiro um code.
  • Caso exista a etapa intermediária do code, ajustar a implementação e o PR atual.
  • Separar as etapas do fluxo em rotas ou responsabilidades distintas.
  • Evitar ambiguidade entre Initiate, Challenge e Submit.
  • Estruturar os endpoints pensando também em logs, métricas e observabilidade.
  • Seguir a proposta de criação de uma subdivisão específica, conforme orientação anteriormente mencionada pelo Cristian.
  • Regularizar o acesso aos diagramas e à documentação da arquitetura.

Pendências e pontos em aberto
  1. Confirmar o nome e o escopo completo da segunda história.
  2. Validar se o retorno inicial do fluxo é um code ou um access token.
  3. Confirmar qual fluxo de autenticação está definido oficialmente na arquitetura.
  4. Definir se será criado um novo controller para o challenge.
  5. Definir como Initiate, Submit Challenge e obtenção do token serão distribuídos entre controllers e casos de uso.
  6. Revisar a nomenclatura da rota do Token Controller.
  7. Identificar as alterações necessárias no PR existente.
  8. Confirmar o endereço correto da documentação e dos diagramas.
  9. Solicitar acesso aos ambientes de produção e/ou sandbox, se necessário.
  10. Definir as métricas e logs específicos para cada etapa do fluxo.

Próximas ações

Leandro
  • Pesquisar o endereço correto da documentação e dos diagramas.
  • Verificar a necessidade de solicitar acesso.
  • Confirmar, por meio da documentação, o comportamento esperado para code e access token.
  • Revisar os impactos da decisão no PR e no serviço já desenvolvido.

Time técnico
  • Confirmar a divisão das responsabilidades entre os controllers.
  • Definir a separação das rotas.
  • Validar o desenho final do fluxo de autenticação.
  • Incluir critérios de logs, métricas e observabilidade na implementação.
  • Confirmar os detalhes das duas histórias e a ordem de execução.

Resumo executivo

A reunião concentrou-se na continuidade de duas histórias ligadas ao novo microserviço de integração e na revisão do fluxo de autenticação. A principal dúvida é se a aplicação deve receber diretamente um access token ou primeiro um code, que posteriormente seria trocado pelo token.

A documentação parece indicar a necessidade dessa etapa intermediária, o que pode exigir mudanças no PR e na estrutura atual. O direcionamento técnico mais forte foi separar as etapas de início, challenge e submissão em rotas ou componentes distintos. Além de reduzir ambiguidades, essa separação permitirá métricas mais precisas e facilitará a identificação do ponto exato de eventuais falhas.

A definição final depende da validação dos diagramas e da documentação, aos quais Leandro ainda precisa obter acesso.
