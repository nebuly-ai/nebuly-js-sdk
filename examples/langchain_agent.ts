import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { pull } from "langchain/hub";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { createRetrieverTool } from "langchain/tools/retriever";


import { NebulyCallbackHandler } from 'nebuly-js-sdk/langchain-handler';


let myCallbackHandler = new NebulyCallbackHandler('<YOUR_USER_ID>', '<NEBULY_API_KEY>')

const loader = new CheerioWebBaseLoader(
  "https://docs.smith.langchain.com/overview"
);
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter();
const splitDocs = await splitter.splitDocuments(docs);
const embeddings = new OpenAIEmbeddings();

const vectorstore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);

const prompt =
  ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

<context>
{context}
</context>

Question: {input}`);

const chatModel = new ChatOpenAI();
const documentChain = await createStuffDocumentsChain({
  llm: chatModel,
  prompt,
});

const retriever = vectorstore.asRetriever();


// Create agent
const retrieverTool = await createRetrieverTool(retriever, {
  name: "langsmith_search",
  description:
    "Search for information about LangSmith. For any questions about LangSmith, you must use this tool!",
});
const tools = [retrieverTool];

const agentPrompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agentModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
});

const agent = await createOpenAIFunctionsAgent({
  llm: agentModel,
  tools,
  prompt: agentPrompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: false,
});

const agentResult = await agentExecutor.invoke(
  {
    chat_history: [
      new HumanMessage("Can LangSmith help test my LLM applications?"),
      new AIMessage("Yes!"),
    ],
    input: "Tell me how",
  },
  {
    callbacks: [myCallbackHandler],
  }

);
await myCallbackHandler.sendData();