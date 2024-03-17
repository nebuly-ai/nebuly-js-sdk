/* eslint-disable @typescript-eslint/no-unused-vars */

import { v4 as uuidv4 } from 'uuid';

import { Serialized } from "@langchain/core/load/serializable";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentAction } from "@langchain/core/agents";
import { ChainValues } from "@langchain/core/utils/types";
import { LLMResult } from "@langchain/core/outputs";
import { DocumentInterface } from "@langchain/core/documents";
import { BaseMessage } from "@langchain/core/messages";
import { ChatGeneration } from "@langchain/core/outputs";

import { ChainStep, ChainStepName } from "./base.js";
import { prepareDataForInterctionEndpoint, sendDataToEndpoint, INTERACTION_ENDPOINT_URL } from "./endpoint_connection.js";


const TOOL_ID = "tool";

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
    const pendingStep = this.stack[key].pop();
    if (pendingStep) {
      if (extraMetadata) {
        pendingStep.metadata = { ...pendingStep.metadata, ...extraMetadata };
      }
      pendingStep.response = stepOutputs;
      this.chain_steps.push(pendingStep);
    }
  }

  async handleChainStart(chain: Serialized) { // eslint-disable-line 
    if (! this.start) {
      this.start = new Date();
    }
  }

  async handleChainEnd(_output: ChainValues) {
    this.end = new Date();
    if ("input" in _output && ("answer" in _output || "output" in _output)) {
      this.setInputAnswer(_output.input, _output.answer || _output.output);
    } else if ("answer" in _output || "output" in _output) {
      this.setInputAnswer(undefined, _output.answer || _output.output);
    } else if ("input" in _output && this.input.length == 0) {
      this.setInputAnswer(_output.input);
    }
    if ("chat_history" in _output) {
      const chatHistory = _output.chat_history as Array<HumanMessage | AIMessage>;
      const userHistory = chatHistory.filter(h => h instanceof HumanMessage).map(h => h.content as string);
      const assistantHistory = chatHistory.filter(h => h instanceof AIMessage).map(h => h.content as string);
      this.userHistory = userHistory;
      this.assistantHistory = assistantHistory;
    }
  }

  async handleAgentAction(action: AgentAction) {
    const runId = uuidv4();
    const newStep = new ChainStep(runId, ChainStepName.Tool);
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

  async handleLLMStart(llm: Serialized, prompts: string[], runId: string, parentRunId?: string, extraParams?: Record<string, unknown>, tags?: string[], metadata?: Record<string, unknown>, name?: string) { // eslint-disable-line
    //console.log("Starting LLM...");
    //console.log(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
    // let newStep = new ChainStep(runId, "LLM");
  }

  async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string, tags?: string[]) { // eslint-disable-line
    const generation = output.generations[0][output.generations[0].length - 1];
    let outputText = generation.text;
    let extraMetadata: Record<string, unknown> = {};
    if (output.llmOutput) {
      const tokenUsage = output.llmOutput.tokenUsage as Record<string, number>;
      extraMetadata = {
        inputTokens: tokenUsage.promptTokens,
        outputTokens: tokenUsage.completionTokens,
      };
    }
    if (outputText.length == 0) {
      // we are in the function calling regime.
      const message = (generation as ChatGeneration).message;
      const function_call = message.additional_kwargs.function_call;
      if (function_call) {
        outputText = JSON.stringify(function_call);
      }
    }
    this.moveFromStackToChainSteps([outputText], runId, parentRunId, extraMetadata);
  }

  async handleRetrieverStart(retriever: Serialized, query: string, runId: string, parentRunId?: string, tags?: string[], metadata?: Record<string, unknown>, name?: string) {
    const newStep = new ChainStep(runId, ChainStepName.Retriever);
    newStep.query = query;
    newStep.metadata = {
      sourceClass: retriever.id[retriever.id.length - 1],
      sourceName: name,
      sourceTags: tags,
    };
    this.addChainStepToStack(newStep, runId, parentRunId);
  }

  async handleRetrieverEnd(documents: DocumentInterface<Record<string, unknown>>[], runId: string, parentRunId?: string, tags?: string[]) {  // eslint-disable-line
    const text = documents.map((doc) => doc.pageContent);
    this.moveFromStackToChainSteps(text, runId, parentRunId);
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],  // eslint-disable-line
    metadata?: Record<string, unknown>,  // eslint-disable-line
    name?: string  // eslint-disable-line
  ) {
    let modelName = "unknown";
    if (extraParams && extraParams.invocation_params) {
      const modelRecord = extraParams.invocation_params as Record<string, unknown>;
      if ("model" in modelRecord) {
        modelName = modelRecord["model"] as string;
      }
    }
    const userHistory = messages[0].filter(m => m instanceof HumanMessage).map(m => m.content.toString());
    const assistantHistory = messages[0].filter(m => m instanceof AIMessage).map(m => m.content.toString());    
    const newStep = new ChainStep(runId, ChainStepName.LLM);
    newStep.query = messages[0][messages[0].length - 1].content.toString();
    newStep.metadata = { model: modelName, userHistory: userHistory, assistantHistory: assistantHistory };
    this.addChainStepToStack(newStep, runId, parentRunId);
  }

  async sendData(): Promise<Record<string, unknown> | undefined>{
    const data = prepareDataForInterctionEndpoint(
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
    return await sendDataToEndpoint(INTERACTION_ENDPOINT_URL, data, apiKey);
  }
}