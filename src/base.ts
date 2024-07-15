export enum ChainStepName {
    LLM = "LLM",
    Retriever = "Retriever",
    Tool = "Tool",
}

export class ChainStep {
    metadata: Record<string, unknown>;
    query?: string;
    response?: string[];
    start?: Date;
    end?: Date;

    constructor(public id: string, public name: ChainStepName) {
        this.metadata = {};
    }

    isReady() {
        return this.query && this.response;
    }

    toTrace(): Record<string, unknown> {
        if (this.name === ChainStepName.LLM) {
            const modelName = this.metadata.model as string;
            const systemPrompt = this.metadata.systemPrompt as string || "";
            const input = this.query as string;
            const output = this.response ? this.response[0] : "";
            const inputTokens = this.metadata.inputTokens as number || 0;
            const outputTokens = this.metadata.outputTokens as number || 0;
            const history: string[][] = [];
            const userHistory = this.metadata.userHistory as string[] || [];
            const assistantHistory = this.metadata.assistantHistory as string[] || [];
            const length = Math.min(userHistory.length, assistantHistory.length);
            for (let i = 0; i < length; i++) {
                if (userHistory[i] && assistantHistory[i]) {
                    history.push([userHistory[i] || "", assistantHistory[i] || ""]);
                }
            }
            return {
                model: modelName,
                system_prompt: systemPrompt,
                history: history,
                input: input,
                output: output,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
            }
        }
        else if (this.name === ChainStepName.Retriever) {
            const sourceName = this.metadata.sourceName ? this.metadata.sourceName as string : this.metadata.sourceClass as string;
            const input = this.query as string;
            const outputs = this.response as string[];
            return {
                source: sourceName,
                input: input,
                outputs: outputs,
            }
        }
        else {
            const toolName = this.metadata.toolName as string;
            const input = this.query as string;
            const outputs = this.response as string[];
            return {
                source: toolName,
                input: input,
                outputs: outputs,
            }
        }
    }
}

export class RAGSource {
    input: string;
    outputs: string[];
    sourceName: string;

    constructor(sourceName: string, input: string, outputs: string[]) {
        this.input = input;
        this.outputs = outputs;
        this.sourceName = sourceName;
    }

    toChainStep(): ChainStep {
        const chain = new ChainStep("RAG", ChainStepName.Retriever);
        chain.query = this.input;
        chain.response = this.outputs;
        chain.metadata["sourceName"] = this.sourceName;
        return chain;
    }
}

export interface FeedbackActionMetadata {
    input?: string | null;
    output?: string | null;
    end_user?: string;
    end_user_group_profile?: string | null;
    timestamp?: Date;
    anonymize?: boolean;
}

interface ThumbsUpFeedbackAction {
    slug: "thumbs_up";
    text?: string | null;
}

interface ThumbsDownFeedbackAction {
    slug: "thumbs_down";
    text?: string | null;
}

interface CopyInputFeedbackAction {
    slug: "copy_input";
    text: string;
}

interface CopyOutputFeedbackAction {
    slug: "copy_output";
    text: string;
}

interface PasteFeedbackAction {
    slug: "paste";
    text: string;
}

interface UserCommentAction {
    slug: "comment";
    text: string;
}

interface RegenerateAction {
    slug: "regenerate";
}

interface EditAction {
    slug: "edit";
    text: string;
}

export type FeedbackAction = ThumbsUpFeedbackAction | ThumbsDownFeedbackAction | CopyInputFeedbackAction | CopyOutputFeedbackAction | PasteFeedbackAction | UserCommentAction | RegenerateAction | EditAction
