import { ChatOpenAI } from "@langchain/openai";
// import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { v4 as uuidv4 } from 'uuid';
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChainStep, ChainStepName } from "./base.js";
import { prepareDataForEndpoint, sendDataToEndpoint } from "./endpoint_connection.js";
const TOOL_ID = "tool";
const ENDPOINT_URL = "https://dev.backend.nebuly.com/event-ingestion/api/v1/events/trace_interaction";
export class NebulyCallbackHandler extends BaseCallbackHandler {
    constructor(endUser, apiKey) {
        super();
        this.endUser = endUser;
        this.apiKey = apiKey;
        this.name = "NebulyCallbackHandler";
        this.chain_steps = [];
        this.stack = {};
        this.input = "";
        this.answer = "";
        this.freeze = false;
        if (apiKey) {
            console.log("API key provided.");
        }
        else {
            console.log("No API key provided.");
        }
    }
    setInputAnswer(input, answer) {
        if (this.freeze) {
            return;
        }
        this.input = input || this.input;
        this.answer = answer || this.answer;
    }
    addChainStepToStack(step, runId, parentRunId) {
        if (this.freeze) {
            return;
        }
        const key = parentRunId ? (runId + parentRunId) : runId;
        if (key in this.stack) {
            this.stack[key].push(step);
        }
        else {
            this.stack[key] = [step];
        }
    }
    moveFromStackToChainSteps(stepOutputs, runId, parentRunId, extraMetadata) {
        if (this.freeze) {
            return;
        }
        const key = parentRunId ? (runId + parentRunId) : runId;
        let pendingStep = this.stack[key].pop();
        if (pendingStep) {
            if (extraMetadata) {
                pendingStep.metadata = Object.assign(Object.assign({}, pendingStep.metadata), extraMetadata);
            }
            pendingStep.response = stepOutputs;
            this.chain_steps.push(pendingStep);
        }
    }
    async handleChainStart(chain) {
        console.log(`Entering new ${chain.id} chain...`);
        if (!this.start) {
            this.start = new Date();
        }
    }
    async handleChainEnd(_output) {
        console.log("Finished chain.");
        this.end = new Date();
        if ("input" in _output && ("answer" in _output || "output" in _output)) {
            console.log("Setting input and answer...");
            this.setInputAnswer(_output.input, _output.answer || _output.output);
        }
        if ("chat_history" in _output) {
            console.log("Handling chat history...");
            let chatHistory = _output.chat_history;
            let userHistory = chatHistory.filter(h => h instanceof HumanMessage).map(h => h.content);
            let assistantHistory = chatHistory.filter(h => h instanceof AIMessage).map(h => h.content);
            this.userHistory = userHistory;
            this.assistantHistory = assistantHistory;
        }
    }
    async handleAgentAction(action) {
        console.log("Agent action...");
        const runId = uuidv4();
        let newStep = new ChainStep(runId, ChainStepName.Tool);
        newStep.query = JSON.stringify(action.toolInput);
        newStep.metadata = {
            toolName: action.tool,
        };
        this.addChainStepToStack(newStep, TOOL_ID);
        this.freeze = true;
    }
    async handleToolEnd(output) {
        console.log("Tool finished.");
        this.freeze = false;
        this.moveFromStackToChainSteps([output], TOOL_ID);
        //console.log(output);
    }
    async handleText(text) {
        console.log("Handling text...");
        console.log(text);
    }
    async handleAgentEnd(action) {
        console.log("Agent finished.");
        //console.log(action.log);
    }
    async handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name) {
        console.log("Starting LLM...");
        //console.log(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
        // let newStep = new ChainStep(runId, "LLM");
    }
    async handleLLMEnd(output, runId, parentRunId, tags) {
        console.log("Finished LLM...");
        const generation = output.generations[0][output.generations[0].length - 1];
        let outputText = generation.text;
        let extraMetadata = {};
        if (output.llmOutput) {
            let tokenUsage = output.llmOutput.tokenUsage;
            extraMetadata = {
                inputTokens: tokenUsage.promptTokens,
                outputTokens: tokenUsage.completionTokens,
            };
        }
        if (outputText.length == 0) {
            // we are in the function calling regime.
            let message = generation.message;
            let function_call = message.additional_kwargs.function_call;
            if (function_call) {
                outputText = JSON.stringify(function_call);
            }
        }
        this.moveFromStackToChainSteps([outputText], runId, parentRunId, extraMetadata);
    }
    async handleRetrieverStart(retriever, query, runId, parentRunId, tags, metadata, name) {
        console.log("Starting Retriever...");
        //console.log(retriever, query, runId, parentRunId, tags, metadata, name);
        let newStep = new ChainStep(runId, ChainStepName.Retriever);
        newStep.query = query;
        newStep.metadata = {
            sourceClass: retriever.id[retriever.id.length - 1],
            sourceName: name,
            sourceTags: tags,
        };
        this.addChainStepToStack(newStep, runId, parentRunId);
    }
    async handleRetrieverEnd(documents, runId, parentRunId, tags) {
        console.log("Finished Retriever...");
        const text = documents.map((doc) => doc.pageContent);
        this.moveFromStackToChainSteps(text, runId, parentRunId);
    }
    async handleChatModelStart(llm, messages, runId, parentRunId, extraParams, tags, metadata, name) {
        console.log("Starting Chat Model...");
        let modelName = "unknown";
        if (extraParams && extraParams.invocation_params) {
            const modelRecord = extraParams.invocation_params;
            if ("model" in modelRecord) {
                modelName = modelRecord["model"];
            }
        }
        let userHistory = messages[0].filter(m => m instanceof HumanMessage).map(m => m.content.toString());
        let assistantHistory = messages[0].filter(m => m instanceof AIMessage).map(m => m.content.toString());
        let newStep = new ChainStep(runId, ChainStepName.LLM);
        newStep.query = messages[0][messages[0].length - 1].content.toString();
        newStep.metadata = { model: modelName, userHistory: userHistory, assistantHistory: assistantHistory };
        this.addChainStepToStack(newStep, runId, parentRunId);
    }
    sendData() {
        const data = prepareDataForEndpoint(this.input, this.answer, this.chain_steps, this.start || new Date(), // add start time
        this.end || new Date(), // add end time
        this.userHistory || [], this.assistantHistory || [], this.endUser, this.tags);
        console.log(data);
        const apiKey = this.apiKey || process.env.NEBULY_API_KEY;
        if (!apiKey) {
            console.error("No API key provided.");
            return;
        }
        console.log(data);
        sendDataToEndpoint(ENDPOINT_URL, data, apiKey);
    }
}
// ################################## Example Retrieval Chain ##################################
let myCallbackHandler = new NebulyCallbackHandler("Diego");
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
const loader = new CheerioWebBaseLoader("https://docs.smith.langchain.com/overview");
const docs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter();
const splitDocs = await splitter.splitDocuments(docs);
const embeddings = new OpenAIEmbeddings();
const vectorstore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
const prompt = ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

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
/*
const retrievalChain = await createRetrievalChain({
  combineDocsChain: documentChain,
  retriever,
});

const result = await retrievalChain.invoke({
  input: "what is LangSmith?",
},
{
  callbacks: [myCallbackHandler],
}
);

*/
// Create agent
import { createRetrieverTool } from "langchain/tools/retriever";
const retrieverTool = await createRetrieverTool(retriever, {
    name: "langsmith_search",
    description: "Search for information about LangSmith. For any questions about LangSmith, you must use this tool!",
});
const tools = [retrieverTool];
import { pull } from "langchain/hub";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const agentPrompt = await pull("hwchase17/openai-functions-agent");
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
// const agentResult = await agentExecutor.invoke(
//   {
//     input: "how can LangSmith help with testing?",
//   },
//   {
//     callbacks: [myCallbackHandler],
//   }
// );
const agentResult3 = await agentExecutor.invoke({
    chat_history: [
        new HumanMessage("Can LangSmith help test my LLM applications?"),
        new AIMessage("Yes!"),
    ],
    input: "Tell me how",
}, {
    callbacks: [myCallbackHandler],
});
console.log(myCallbackHandler.chain_steps.length);
myCallbackHandler.sendData();
