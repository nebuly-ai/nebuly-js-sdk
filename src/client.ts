import { prepareDataForInterctionEndpoint, prepareDataForFeedbackEndpoint, sendDataToEndpoint, INTERACTION_ENDPOINT_URL, FEEDBACK_ENDPOINT_URL } from "./endpoint_connection.js";
import { ChainStep, RAGSource, FeedbackAction, FeedbackActionMetadata, ChainStepName } from "./base.js";

export class NebulySdk {
    constructor(private apiKey: string) { }

    async sendFeedbackAction(action: FeedbackAction, metadata?: FeedbackActionMetadata): Promise<Record<string, unknown> | undefined> {
        metadata = Object.assign({ timestamp: new Date(), anonymize: true }, metadata);
        const payload = prepareDataForFeedbackEndpoint(action, metadata);
        return sendDataToEndpoint(FEEDBACK_ENDPOINT_URL, payload, this.apiKey);
    }

    async sendInteractionWithTrace(
        input: string, 
        output: string, 
        chainSteps: ChainStep[], 
        timeStart: Date, 
        timeEnd: Date, 
        endUser: string, 
        userHistory: string[], 
        assistantHistory: string[], 
        tags?: Record<string, string>, 
        anonymize?: boolean
    ): Promise<Record<string, unknown> | undefined> {
        
        const payload = prepareDataForInterctionEndpoint(input, output, chainSteps, timeStart, timeEnd, userHistory, assistantHistory, endUser, tags, anonymize);
        return sendDataToEndpoint(INTERACTION_ENDPOINT_URL, payload, this.apiKey);
    }

    async sendOpenAIInteraction(
        messages: any[],  // eslint-disable-line @typescript-eslint/no-explicit-any
        modelOutput: string,
        model: string,
        timeStart: Date,
        timeEnd: Date,
        endUser: string,
        input?: string,
        systemPrompt?: string,
        ragSources?: RAGSource[],
        tags?: Record<string, string>,
        anonymize?: boolean,
    ): Promise<Record<string, unknown> | undefined> {
        const userInput = input? input: messages[messages.length - 1].content as string;
        const modelStep = new ChainStep("model", ChainStepName.LLM);
        modelStep.query = userInput;
        modelStep.response = [modelOutput];
        modelStep.start = timeStart
        modelStep.end = timeEnd
        modelStep.metadata = { model: model, system_prompt: systemPrompt };
        const chain_steps = []
        if (ragSources) {
            for (const source of ragSources) {
                chain_steps.push(source.toChainStep());
            }
        }
        chain_steps.push(modelStep);
        const userHistory = messages.slice(0, -1).filter(h => h.role === 'user').map(h => h.content as string);
        const assistantHistory = messages.filter(h => h.role === 'assistant').map(h => h.content as string).slice(-userHistory.length);
        return this.sendInteractionWithTrace(
            userInput,
            modelOutput,
            chain_steps,
            timeStart,
            timeEnd,
            endUser,
            userHistory,
            assistantHistory,
            tags,
            anonymize
        );
    }
}
