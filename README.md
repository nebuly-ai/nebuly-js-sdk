# Nebuly SDK for Node.js
This is the nebuly SDK for Node JS. Currently, the node JS is a preview features and only supports the integration with langchain-js and openai-node.

## Installation
```bash
npm install @nebuly-ai/nebuly-js-sdk
```

## Usage
### Langchain-js
```typescript
import { NebulyCallbackHandler } from '@nebuly-ai/nebuly-js-sdk';

let handler = new NebulyCallbackHandler('endUser', 'apiKey');
// Here add the handler to the call of your langchain chains or agents
handler.sendData();
```

The handler accepts as input parameters the endUser and nebuly's apiKey. If the apiKey is not given, the handler will use the default apiKey from the environment variable `NEBULY_API_KEY`. The endUser parameter should contain a unique identifier for the end-user. We usually suggest to use the hashed version of the username or email as unique identifier for the user.
### OpenAI
```typescript
import { NebulySdk } from "@nebuly-ai/nebuly-js-sdk"
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function main() {
    const nebulySdk = new NebulySdk('NEBULY_API_KEY');
    const modelInputs: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [{ role: 'user', content: 'Say this is a test' }],
        model: 'gpt-3.5-turbo',
    }
    const startTime = new Date();
    const chatCompletion = await openai.chat.completions.create(modelInputs);
    const endTime = new Date();
    
    nebulySdk.sendOpenAIInteraction(
        modelInputs['messages'],
        chatCompletion.choices[0].message.content as string,
        modelInputs['model'] as string,
        startTime,
        endTime,
        'testUser'
    );
}

main();
```
The parameters needed for the `sendOpenAIInteraction` are the following:
- `messages`: The inputs that were given to the model
- `modelOutput`: The output of the model
- `model`: The model that was used
- `startTime`: The start time of the call to the model
- `endTime`: The end time of the call to the model
- `endUser`: The unique identifier of the end user

### Feedback actions
You can send to the nebuly platform feedbacks actions like: `thumbs_up`, `thumbs_down`, `copy_input` and `copy_output`. The feedback actions are sent to the nebuly platform using the `sendFeedbackAction` method. 
```typescript
nebulySdk.sendFeedbackAction(
    {
        slug: "thumbs_up",
        text: "Comment for a thumbs up"
    },
    {
        input: 'The input of the LLM system',
        output: 'The output of the LLM system',
        end_user: 'testUser'
    },
);
```


## Development
To initialize the development environment you can use the following command:
```bash
tsc --init
```
To continuously compile the typescript code:
```bash
tsc -w
```

### Generate Types and Endpoints
We currently use openapi-fetch and openapi-typescript to generate the types and endpoints. To generate the types and endpoints you can use the following command:
```bash
npx openapi-typescript https://backend.nebuly.com/api/external/openapi.json -o ./src/generated/schemas.d.ts
```
Then you can modify directly the endpoint and types in the src/endpoint_types.ts file.
