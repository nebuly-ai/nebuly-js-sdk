import { v4 as uuidv4 } from 'uuid';

import { Serialized } from "@langchain/core/load/serializable";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentAction, AgentFinish } from "@langchain/core/agents";
import { ChainValues } from "@langchain/core/utils/types";
import { LLMResult } from "@langchain/core/outputs";
import { DocumentInterface } from "@langchain/core/documents";
import { BaseMessage } from "@langchain/core/messages";
import { ChatGeneration } from "@langchain/core/outputs";

import { ChainStep, ChainStepName } from "./base.js";
import { prepareDataForEndpoint, sendDataToEndpoint } from "./endpoint_connection.js";


const TOOL_ID = "tool";
const ENDPOINT_URL = 
process.env.NEBULY_ENDPOINT_URL || "https://backend.nebuly.com/event-ingestion/api/v1/events/trace_interaction";


export class NebulyCallbackHandler extends BaseCallbackHandler {
  name: string = "NebulyCallbackHandler";
  chain_steps: ChainStep[];
  stack: Record<string, ChainStep[]>;
  input: string;
  answer: string;
  freeze: boolean;
  userHistory?: string[];
  assistantHistory?: string[];
  tags?: Record<string, string>;
  start?: Date;
  end?: Date;

  constructor(public endUser: string, public apiKey?: string) {
    super();
    this.chain_steps = [];
    this.stack = {};
    this.input = "";
    this.answer = "";
    this.freeze = false;
  }

  setInputAnswer(input?: string, answer?: string) {
    if (this.freeze) {
      return;
    }
    this.input = input || this.input;
    this.answer = answer || this.answer;
  }

  addChainStepToStack(step: ChainStep, runId: string, parentRunId?: string) {
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

  moveFromStackToChainSteps(stepOutputs: string[], runId: string, parentRunId?: string, extraMetadata?: Record<string, unknown>) {
    if (this.freeze) {
      return;
    }
    const key = parentRunId ? (runId + parentRunId) : runId;
    let pendingStep = this.stack[key].pop();
    if (pendingStep) {
      if (extraMetadata) {
        pendingStep.metadata = { ...pendingStep.metadata, ...extraMetadata };
      }
      pendingStep.response = stepOutputs;
      this.chain_steps.push(pendingStep);
    }
  }

  async handleChainStart(chain: Serialized) {
    if (! this.start) {
      this.start = new Date();
    }
  }

  async handleChainEnd(_output: ChainValues) {
    this.end = new Date();
    if ("input" in _output && ("answer" in _output || "output" in _output)) {
      this.setInputAnswer(_output.input, _output.answer || _output.output);
    }
    if ("chat_history" in _output) {
      let chatHistory = _output.chat_history as Array<HumanMessage | AIMessage>;
      let userHistory = chatHistory.filter(h => h instanceof HumanMessage).map(h => h.content as string);
      let assistantHistory = chatHistory.filter(h => h instanceof AIMessage).map(h => h.content as string);
      this.userHistory = userHistory;
      this.assistantHistory = assistantHistory;
    }
  }

  async handleAgentAction(action: AgentAction) {
    const runId = uuidv4();
    let newStep = new ChainStep(runId, ChainStepName.Tool);
    newStep.query = JSON.stringify(action.toolInput);
    newStep.metadata = {
      toolName: action.tool,
    };
    this.addChainStepToStack(newStep, TOOL_ID);
    this.freeze = true;
  }

  async handleToolEnd(output: string) {
    this.freeze = false;
    this.moveFromStackToChainSteps([output], TOOL_ID);
  }

  async handleText(text: string) {}

  async handleAgentEnd(action: AgentFinish) {}

  async handleLLMStart(llm: Serialized, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, unknown>, tags?: string[], metadata?: Record<string, unknown>, name?: string): Promise<any> {
    //console.log("Starting LLM...");
    //console.log(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
    // let newStep = new ChainStep(runId, "LLM");
  }

  async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string, tags?: string[]): Promise<any> {
    const generation = output.generations[0][output.generations[0].length - 1];
    let outputText = generation.text;
    let extraMetadata: Record<string, unknown> = {};
    if (output.llmOutput) {
      let tokenUsage = output.llmOutput.tokenUsage as Record<string, number>;
      extraMetadata = {
        inputTokens: tokenUsage.promptTokens,
        outputTokens: tokenUsage.completionTokens,
      };
    }
    if (outputText.length == 0) {
      // we are in the function calling regime.
      let message = (generation as ChatGeneration).message;
      let function_call = message.additional_kwargs.function_call;
      if (function_call) {
        outputText = JSON.stringify(function_call);
      }
    }
    this.moveFromStackToChainSteps([outputText], runId, parentRunId, extraMetadata);
  }

  async handleRetrieverStart(retriever: Serialized, query: string, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, unknown>, name?: string): Promise<any> {
    let newStep = new ChainStep(runId, ChainStepName.Retriever);
    newStep.query = query;
    newStep.metadata = {
      sourceClass: retriever.id[retriever.id.length - 1],
      sourceName: name,
      sourceTags: tags,
    };
    this.addChainStepToStack(newStep, runId, parentRunId);
  }

  async handleRetrieverEnd(documents: DocumentInterface<Record<string, any>>[], runId: string, parentRunId?: string, tags?: string[]): Promise<any> {
    const text = documents.map((doc) => doc.pageContent);
    this.moveFromStackToChainSteps(text, runId, parentRunId);
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string
  ): Promise<any> {
    let modelName = "unknown";
    if (extraParams && extraParams.invocation_params) {
      const modelRecord = extraParams.invocation_params as Record<string, unknown>;
      if ("model" in modelRecord) {
        modelName = modelRecord["model"] as string;
      }
    }
    let userHistory = messages[0].filter(m => m instanceof HumanMessage).map(m => m.content.toString());
    let assistantHistory = messages[0].filter(m => m instanceof AIMessage).map(m => m.content.toString());    
    let newStep = new ChainStep(runId, ChainStepName.LLM);
    newStep.query = messages[0][messages[0].length - 1].content.toString();
    newStep.metadata = { model: modelName, userHistory: userHistory, assistantHistory: assistantHistory };
    this.addChainStepToStack(newStep, runId, parentRunId);
  }

  async sendData(): Promise<Record<string, unknown> | undefined>{
    const data = prepareDataForEndpoint(
      this.input,
      this.answer,
      this.chain_steps,
      this.start || new Date(), // add start time
      this.end || new Date(), // add end time
      this.userHistory || [],
      this.assistantHistory || [],
      this.endUser,
      this.tags,
    );
    const apiKey = this.apiKey || process.env.NEBULY_API_KEY;
    if (!apiKey) {
      console.error("No API key provided.");
      return;
    }
    return await sendDataToEndpoint(ENDPOINT_URL, data, apiKey);
  }
}