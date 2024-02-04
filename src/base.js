export var ChainStepName;
(function (ChainStepName) {
    ChainStepName["LLM"] = "LLM";
    ChainStepName["Retriever"] = "Retriever";
    ChainStepName["Tool"] = "Tool";
})(ChainStepName || (ChainStepName = {}));
export class ChainStep {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.metadata = {};
    }
    isReady() {
        return this.query && this.response;
    }
    toDataSource() {
        let sourceName;
        if (this.name === ChainStepName.LLM) {
            sourceName = this.metadata.model;
        }
        else if (this.name === ChainStepName.Retriever) {
            sourceName = this.metadata.sourceName ? this.metadata.sourceName : this.metadata.sourceClass;
        }
        else {
            sourceName = this.metadata.toolName;
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
