# Nebuly SDK for Node.js
This is the nebuly SDK for Node JS. Currently, the node JS is a preview features and only supports the integration with langchain-js.

## Installation
```bash
npm install @nebuly/sdk-js
```

## Usage
```typescript
import { NebulyCallbackHandler } from '@nebuly/sdk-js/langchain-handler';

let handler = new NebulyCallbackHandler(endUser='endUser', apiKey='apiKey');
// Here add the handler to the call of your langchain chains or agents
handler.sendData();
```

The handler accepts as input parameters the endUser and nebuly's apiKey. If the apiKey is not given, the handler will use the default apiKey from the environment variable `NEBULY_API_KEY`. The endUser parameter should contain a unique identifier for the end-user. We usually suggest to use the hashed version of the username or email as unique identifier for the user.
