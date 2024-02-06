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

    toTrace(): Record<string, unknown>{
        if (this.name === ChainStepName.LLM) {
            const modelName = this.metadata.model as string;
            const systemPrompt = this.metadata.systemPrompt as string || "";
            const input = this.query as string;
            const output = this.response ? this.response[0] : "";
            const inputTokens = this.metadata.inputTokens as number || 0;
            const outputTokens = this.metadata.outputTokens as number || 0;
            let history: string[][] = [];
            const userHistory = this.metadata.userHistory as string[] || [];
            const assistantHistory = this.metadata.assistantHistory as string[] || [];
            const length = Math.min(userHistory.length, assistantHistory.length);
            for (let i = 0; i < length; i++) {
                history.push([userHistory[i], assistantHistory[i]]);
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
            const sourceName = this.metadata.sourceName? this.metadata.sourceName as string: this.metadata.sourceClass as string;
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