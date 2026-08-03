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























Pensou por 24s

Localizei a reunião “Explicação lib Cross channel”, realizada em 30 de julho de 2026, com cerca de 69 minutos.

O que realmente foi definido

A sua entrega imediata é uma biblioteca isolada, não o fluxo completo do Cross Channel.

Ela deve receber:

Authorization Details
+
lista de campos que devem ser extraídos

E devolver algo próximo de:

[
  {
    "key": "phone",
    "value": "11*****89"
  },
  {
    "key": "appVersion",
    "value": "10.2***"
  }
]

Os valores devem sair mascarados. A finalidade é permitir que o front-end contextualize a autenticação para o cliente, mostrando informações que ele reconheça sem expor dados sensíveis.

A separação correta de responsabilidades

A arquitetura que ficou encaminhada é esta:

Channel Type / Genotype
        ↓
Serviço de templates
        ↓
Lista de campos
        ↓
Lib + Authorization Details
        ↓
Pares chave-valor mascarados
        ↓
Backend Cross Channel
        ↓
Front-end

Portanto, a biblioteca não deveria conhecer PVI, canais ou templates específicos.

Ela deve saber apenas:

1. receber um conteúdo;


2. localizar campos por nome ou caminho;


3. aplicar a regra de máscara;


4. devolver uma estrutura padronizada.



O vínculo:

PVI → telefone, appVersion
Canal X → e-mail, deviceId

deve ficar fora da biblioteca, futuramente administrado pelo serviço de templates.

Essa separação é a decisão arquitetural mais importante da reunião. Colocar channelType e enums de canais dentro da lib resolveria a primeira entrega, mas transformaria qualquer novo campo ou canal em nova versão, deploy e GMUD. Isso seria dívida técnica criada conscientemente.

Entregas previstas

História atual

Construir a biblioteca:

extract(
    AuthorizationDetails authorizationDetails,
    List<FieldDefinition> fields
)

A implementação concreta pode variar, mas conceitualmente ela precisa retornar:

List<ContextualizedField>

História posterior

Integrar a biblioteca ao backend Cross Channel.

Nova história ainda não formalizada

Criar um serviço interno para administrar templates, inicialmente por API:

POST   /templates
GET    /templates/{channelType}
PUT    /templates/{channelType}
DELETE /templates/{channelType}

Não há necessidade imediata de interface gráfica. O próprio time poderia administrá-lo via Insomnia ou ferramenta equivalente.

Sua proposta orientada a eventos

Você sugeriu aproveitar uma gravação no Redis/ElastiCache como gatilho, processar os dados via Lambda e gravar o resultado novamente no cache. A ideia foi compreendida e aceita como possível POC, mas não como solução da primeira entrega.

Minha avaliação direta: para o problema apresentado, essa arquitetura parece prematura.

O requisito é essencialmente:

receber dados → selecionar campos → mascarar → devolver

Inserir evento, trigger, Lambda, estado processado e consistência assíncrona adiciona:

latência;

condição de corrida;

tratamento de retry;

idempotência;

observabilidade distribuída;

possibilidade de o backend consultar antes do processamento terminar;

mais pontos de falha em uma jornada que exige resposta imediata.


O fato de existirem vários pods não justifica sozinho essa solução. Se o Authorization Details já está centralizado no Redis, qualquer pod pode recuperá-lo e executar a biblioteca de maneira síncrona.

A POC pode ser tecnicamente interessante, mas neste momento você corre o risco clássico de resolver um problema que ainda não existe. A equipe deixou claro que quer reduzir complexidade e dependência operacional, especialmente por causa de war rooms e incidentes.

Pontos que continuam perigosamente indefinidos

A reunião esclareceu o objetivo, mas ainda não fechou um contrato técnico suficiente para desenvolver sem suposições.

Formato do Authorization Details

Não ficou claro se será:

Map<String, Object>

um DTO conhecido, JSON bruto, JsonNode, estrutura aninhada ou algum modelo polimórfico.

Essa decisão muda completamente a estratégia de extração.

Identificação de campos aninhados

Ainda falta definir se a lista conterá apenas:

phone
appVersion
userAgent

ou caminhos como:

customer.contact.phone
device.metadata.appVersion

Campo inexistente

Não foi decidido se um campo ausente deve:

ser ignorado;

retornar null;

retornar vazio;

gerar erro parcial;

invalidar toda a operação.


Regras de máscara

“Mostrar os dois primeiros caracteres” é um exemplo, não uma especificação.

Telefone, e-mail, documento, IP, device ID e versão de aplicativo não deveriam necessariamente usar a mesma estratégia. A definição do campo provavelmente precisará carregar também a regra:

{
  "path": "customer.phone",
  "label": "Telefone",
  "maskType": "PHONE"
}

Ordem e labels

O front-end provavelmente precisa preservar a ordem do template e receber um texto amigável, não apenas o nome técnico da propriedade.

Dados sensíveis

Não ficou explícito se o valor jamais poderá sair da biblioteca sem máscara, nem como impedir que logs, exceções ou traces exponham o conteúdo original.

O desenho que eu adotaria

public interface AuthorizationDetailsExtractor {

    List<ExtractedField> extract(
        Object authorizationDetails,
        List<FieldTemplate> templates
    );
}

public record FieldTemplate(
    String path,
    String displayName,
    MaskType maskType,
    boolean required
) {}

public record ExtractedField(
    String key,
    String label,
    String maskedValue
) {}

public enum MaskType {
    PHONE,
    EMAIL,
    DOCUMENT,
    KEEP_FIRST_TWO,
    KEEP_LAST_FOUR,
    FULL_MASK
}

A biblioteca deve ser:

stateless;

determinística;

sem dependência de Redis;

sem conhecimento de canais;

sem chamada REST;

sem conhecimento do backend Cross Channel;

sem persistência;

com regras de erro explícitas;

extensível para novas máscaras.


Redis, templates, canal e ciclo de vida pertencem à aplicação consumidora ou ao futuro serviço de templates.

Próximas ações objetivas

1. Obter o repositório da Vicky e identificar o formato real do Authorization Details.


2. Solicitar o diagrama ou os prints prometidos.


3. Confirmar o contrato dos campos: nome simples ou caminho aninhado.


4. Definir formalmente regra para campo inexistente e obrigatório.


5. Separar máscara da lógica de extração.


6. Criar testes com objetos aninhados, campos ausentes, valores nulos, listas e dados sensíveis.


7. Desenvolver a lib isoladamente.


8. Deixar Redis/Lambda apenas como experimento separado, sem contaminar a entrega principal.


9. Depois integrar a lib ao método do backend que devolve a lista ao front-end.


10. Cobrar a criação da história do serviço de templates.



O principal risco agora não é tecnológico. É começar a programar com um contrato nebuloso e depois descobrir que a equipe esperava outro formato de entrada, outra regra de máscara e outro comportamento para campos ausentes. Isso precisa ser fechado antes de você transformar suposições em código.








Certo, preciso então levar isso, de forma estruturada, para tirar dúvida com o tech lead o qual fez esta reunião de passagem da atividade a ser trabalhada.
Atualmente a história envolvida está em refinamento e já tenho uma versão zero criada, cuja criação fiz orientada ao copilot, que o contextualizei com a história e o que tenho já desenvolvido foi baseada no conteúdo da história.
Passando aqui neste chat, foi baseado na reunião que fiz com esse tech lead.
O desafio neste momento é consolidar os 2 caminhos, ou seja, consolidar o que foi desenvolvido via copilot + descrição história VS este chat + reunião Read Ai.






Esse é exatamente o momento em que vale a pena parar de pensar em código e passar a pensar em engenharia de requisitos.

Pelo que você descreveu, hoje você tem quatro fontes de verdade, mas elas não têm o mesmo peso:

1. A história do Jira (fonte oficial do requisito).


2. A reunião com o Tech Lead (esclarece e até altera a direção da história).


3. O que você implementou com auxílio do Copilot (uma interpretação da história).


4. A nossa análise da reunião (uma consolidação técnica do que foi discutido).



O erro mais comum agora seria comparar código com código. Eu faria o contrário: comparar requisitos com requisitos.

Eu sugiro montar um documento de validação com esta estrutura.


---

1. Objetivo da lib

Uma frase apenas.

> "A biblioteca deve receber Authorization Details juntamente com uma lista de campos (template) e retornar pares chave-valor mascarados que serão utilizados pelo Cross Channel para contextualização da autenticação."



Se o Tech Lead discordar dessa frase, você já descobriu que existe um desalinhamento enorme.


---

2. Entradas

Levantar exatamente o que a lib recebe.

Por exemplo:

Authorization Details

Channel Type?

Lista de campos?

Template?

Algum contexto adicional?


Aqui já aparecerá uma dúvida importante.

Na reunião, ficou claro que a tendência é a lib não depender do Channel Type, mas apenas da lista de campos.

Vale confirmar.


---

3. Saída

Definir claramente.

Exemplo:

[
   key
   label
   maskedValue
]

Ou qualquer outro formato esperado.


---

4. Responsabilidade da biblioteca

O que ela faz.

Exemplo

abrir Authorization Details

localizar campos

mascarar

devolver resultado



---

5. O que NÃO é responsabilidade dela

Isso é tão importante quanto.

Exemplo

descobrir o template

conhecer canais

acessar banco

persistir dados

decidir regras de negócio



---

6. Questões em aberto

Aqui você coloca tudo que ainda não está decidido.

Por exemplo

Authorization Details chega como JSON?

DTO?

Map?

Como identificar campos aninhados?

O que acontece quando um campo não existe?

Como funciona a máscara?

Existe campo obrigatório?



---

7. Comparação entre história e implementação

Essa é a parte mais valiosa.

Uma tabela.

Requisito	História	Implementação	Reunião	Situação

Receber Authorization Details	✔	✔	✔	OK
Receber lista de campos	✔	✔	✔	OK
Conhecer Channel Type	História sugere	Implementado?	Reunião sugere remover	Dúvida
Máscara	Parcial	Parcial	Confirmado	Revisar
Template Service	Não existe	Não existe	Planejado	Futuro


Essa tabela praticamente conduz a conversa.


---

8. Perguntas para o Tech Lead

Em vez de perguntas abertas, leve perguntas objetivas.

Exemplo:

1. A entrada definitiva da lib será AuthorizationDetails + List<Field>?


2. O ChannelType continuará sendo responsabilidade da lib ou será resolvido pelo serviço de templates?


3. A biblioteca pode conhecer regras de canal ou deve permanecer totalmente agnóstica?


4. Qual será o contrato de retorno esperado?


5. Como devemos tratar campos inexistentes?


6. Existe padrão oficial para mascaramento?


7. A versão atual da história já contempla o serviço de templates ou isso será uma segunda história?


8. Existe algum contrato OpenAPI ou DTO que represente o Authorization Details?




---

O que eu faria antes dessa conversa

Eu não abriria mais o IDE.

Eu abriria três telas:

História do Jira.

Código da V0.

Notas da reunião.


E faria uma matriz de rastreabilidade:

Requisito
      ↓
Discussão da reunião
      ↓
Classe implementada
      ↓
Está aderente?

Quando terminar essa matriz, você praticamente terá feito uma revisão de arquitetura.

A vantagem é que, durante a conversa com o Tech Lead, você não ficará perguntando "como devo fazer?". Em vez disso, você conseguirá dizer:

> "Eu interpretei dessa forma, implementei assim, mas a reunião me deixou estas quatro dúvidas. Gostaria de validar se essa interpretação continua correta antes de evoluir a implementação."



Esse tipo de conversa costuma ser muito mais produtivo, porque demonstra que você já fez o trabalho de análise e está buscando validar decisões arquiteturais, não apenas obter instruções.

Eu inclusive transformaria tudo isso em um documento de revisão técnica (quase uma mini-RFC) que servirá tanto para a reunião quanto para revisar a V0 implementada.











Depois de ler as imagens, eu diria que elas explicam por que surgiu o desalinhamento entre a história e a reunião.

Na prática, a história está descrevendo uma solução, enquanto a reunião já estava evoluindo a arquitetura dessa solução.

Vou explicar.

O que a história diz

Ela afirma que a biblioteca deve:

ler authorization_details como JSON;

identificar o canal chamador;

selecionar campos via ENUM;

registrar logs estruturados;

tratar erros;

possuir testes unitários.


Inclusive, os critérios de aceite e os cenários Gherkin reforçam isso:

identificar corretamente o canal;

selecionar campos conforme ENUM;

registrar gaps em log;

não impactar o fluxo de autenticação.


Ou seja, a história parte do pressuposto de que a biblioteca conhece os canais e possui um mapeamento interno por ENUM.


---

O que a reunião acrescentou

Na reunião, o Tech Lead praticamente disse:

> "Isso funciona para a primeira entrega, mas vai escalar mal."



Então surgiu a ideia de desacoplar.

Em vez de:

Lib
 ├── enum PVI
 ├── enum PF
 ├── enum PJ
 └── enum ...

a ideia passou a ser:

Template Service
        ↓
Lista de campos
        ↓
Lib

Assim, a biblioteca deixa de conhecer os canais e passa a conhecer apenas "quais campos extrair".

Perceba que isso não invalida a história. É uma evolução da arquitetura para evitar que a lib precise ser alterada a cada novo canal.


---

O que eu faria agora

Eu não trataria a história como "errada" nem a reunião como "certa". Eu trataria assim:

Fonte	O que representa

História	requisito funcional
Reunião	refinamento arquitetural


Essa distinção muda completamente a conversa com o Tech Lead.


---

O que eu validaria com ele

Eu levaria algo assim.

Minha interpretação atual

A história descreve:

leitura do Authorization Details;

identificação do canal;

seleção de campos via ENUM.


Entretanto, durante o refinamento da reunião, entendi que a direção arquitetural passou a ser outra.

Ao invés da biblioteca conhecer o canal, ela receberia uma lista de campos proveniente de um serviço de templates.

Minha dúvida é:

Qual deve ser considerada a direção definitiva para esta implementação?


---

Depois faria perguntas objetivas.

Pergunta 1

A V0 deve seguir literalmente a história?

ou

Já devo implementar considerando a arquitetura discutida na reunião?


---

Pergunta 2

A biblioteca deve conhecer o ChannelType?

ou

Ela deve apenas receber

AuthorizationDetails
+
Lista de Campos


---

Pergunta 3

O ENUM continua existindo?

Ou ele passa a existir apenas no futuro serviço de templates?


---

Pergunta 4

O objetivo da V0 é

entregar funcionalidade


ou

já nascer preparada para o serviço de templates?


---

Sobre o texto da história

Há outro detalhe interessante.

O texto foi claramente produzido por IA ou seguindo um template bastante genérico.

Alguns indícios:

Persona

Valor ao Cliente

SMART

Narrativa

Gherkin

Riscos


Tudo isso é útil para contextualização, mas não define o contrato técnico da biblioteca.

Por exemplo, ele diz:

> "ler authorization_details como JSON"



Mas não responde:

JSON String?

JsonNode?

Map?

DTO?

byte[]?


Também diz:

> "selecionar campos via ENUM"



Mas não responde:

Quem fornece o ENUM?

Como ele é versionado?

Como adicionar um novo canal?

Como lidar com canais novos?


Essas respostas apareceram justamente na reunião.


---

Minha sugestão

Eu acho que estamos no momento ideal para produzir um documento chamado algo como:

> "Análise de Convergência da História x Refinamento Técnico"



Esse documento teria quatro colunas:

Item	História	Reunião	Implementação V0

Objetivo			
Entrada			
Saída			
ENUM			
ChannelType			
Template			
Máscara			
Logs			
Tratamento de erro			
Testes			


No final, sobrariam apenas as divergências que precisam da validação do Tech Lead.

Na minha opinião, essa abordagem tem uma vantagem enorme: em vez de chegar na reunião perguntando "como eu faço?", você chega mostrando exatamente onde a história, a implementação inicial e o refinamento arquitetural convergem e onde divergem. Isso muda o nível da conversa de execução para análise de arquitetura e tende a tornar a validação muito mais objetiva.
