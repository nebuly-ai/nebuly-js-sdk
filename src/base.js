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
    toTrace() {
        if (this.name === ChainStepName.LLM) {
            const modelName = this.metadata.model;
            const systemPrompt = this.metadata.systemPrompt || "";
            const input = this.query;
            const output = this.response ? this.response[0] : "";
            const inputTokens = this.metadata.inputTokens || 0;
            const outputTokens = this.metadata.outputTokens || 0;
            let history = [];
            const userHistory = this.metadata.userHistory || [];
            const assistantHistory = this.metadata.assistantHistory || [];
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
            };
        }
        else if (this.name === ChainStepName.Retriever) {
            const sourceName = this.metadata.sourceName ? this.metadata.sourceName : this.metadata.sourceClass;
            const input = this.query;
            const outputs = this.response;
            return {
                source: sourceName,
                input: input,
                outputs: outputs,
            };
        }
        else {
            const toolName = this.metadata.toolName;
            const input = this.query;
            const outputs = this.response;
            return {
                source: toolName,
                input: input,
                outputs: outputs,
            };
        }
    }
}
