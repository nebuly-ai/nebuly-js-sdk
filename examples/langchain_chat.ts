import { ChatOpenAI } from "@langchain/openai";
import { NebulyCallbackHandler} from "@nebuly-ai/nebuly-js-sdk";

const nebulyCallbackHandler = new NebulyCallbackHandler('<YOUR_USER_ID>', '<NEBULY_API_KEY>')
const chatModel = new ChatOpenAI({
    openAIApiKey: "<YOUR_OPENAI_API_KEY>"
});
const response = await chatModel.invoke(
    "what is LangSmith?",
    {
        callbacks: [nebulyCallbackHandler]
    }
);
console.log(response)
await nebulyCallbackHandler.sendData()