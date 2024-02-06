import { ChatOpenAI } from "@langchain/openai";
import { NebulyCallbackHandler } from 'nebuly-js-sdk/langchain-handler';

let nebulyCallbackHandler = new NebulyCallbackHandler('<YOUR_USER_ID>', '<NEBULY_API_KEY>')
const chatModel = new ChatOpenAI({
    openAIApiKey: "<YOUR_OPENAI_API_KEY>"
});
const response = await chatModel.invoke(
    "what is LangSmith?",
    {
        callbacks: [nebulyCallbackHandler]
    }
);
await nebulyCallbackHandler.sendData()