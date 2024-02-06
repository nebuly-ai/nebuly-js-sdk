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
            return {
                model: modelName,
                system_prompt: systemPrompt,
                history: [],
                input: input,
                output: output,
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