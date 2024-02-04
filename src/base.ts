export enum ChainStepName {
    LLM = "LLM",
    Retriever = "Retriever",
    Tool = "Tool",
  }

export class ChainStep {
    metadata: Record<string, unknown>;
    query?: string;
    response?: string;
    start?: Date;
    end?: Date;

    constructor(public id: string, public name: ChainStepName) {
        this.metadata = {};
    }

    isReady() {
        return this.query && this.response;
    }

    toDataSource() {
        let sourceName: string;
        if (this.name === ChainStepName.LLM) {
            sourceName = this.metadata.model as string;
        }
        else if (this.name === ChainStepName.Retriever) {
            sourceName = this.metadata.sourceName? this.metadata.sourceName as string: this.metadata.sourceClass as string;
        }
        else {
            sourceName = this.metadata.toolName as string;
        }
        return {
            id: this.id,
            source_type: this.name.toString(),
            source_name: sourceName,
            metadata: this.metadata,
            query: this.query,
            response: this.response,
            called_start: this.start,
            called_end: this.end,
        };
    }
}