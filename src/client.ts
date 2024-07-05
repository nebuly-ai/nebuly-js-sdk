import { prepareDataForInterctionEndpoint, prepareDataForFeedbackEndpoint, sendDataToEndpoint, INTERACTION_ENDPOINT_URL, FEEDBACK_ENDPOINT_URL, EXTERNAL_ENDPOINT_URL } from "./endpoint_connection";
import { ChainStep, RAGSource, FeedbackAction, FeedbackActionMetadata, ChainStepName } from "./base";
import createClient from "openapi-fetch";
import type { paths } from "./generated/schemas";
import { GetInteractionAggregatesRequest, GetInteractionAggregatesResponse, GetInteractionDetailsResponse, GetInteractionMultiAggregatesRequest, GetInteractionMultiAggregatesResponse, GetInteractionsRequest, GetInteractionsResponse, GetInteractionTimeSeriesRequest, GetInteractionTimeSeriesResponse } from "./endpoint_types";

export class NebulySdk {
    client: ReturnType<typeof createClient>;

    constructor(private apiKey: string) {
        this.apiKey = apiKey;
        this.client = createClient<paths>({ baseUrl: EXTERNAL_ENDPOINT_URL });
    }

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
        const userInput = input ? input : messages[messages.length - 1].content as string;
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

    async getInteractionAggregates({
        time_range,
        filters,
        group_by,
        limit,
        offset,
        order_by,
        variables,
        additional_group_bys
    }: GetInteractionAggregatesRequest): Promise<GetInteractionAggregatesResponse> {
        const { data, error } = await this.client.POST(
            "/get-interaction-aggregates",
            {
                body: {
                    time_range: time_range,
                    filters: filters,
                    variables: variables,
                    group_by: group_by,
                    order_by: order_by,
                    additional_group_bys: additional_group_bys,
                    limit: limit,
                    offset: offset
                },
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                }
            }
        );

        if (error) {
            console.error('Error:', error);
        }

        return data;
    }

    async getInteractions({
        time_range,
        filters,
        limit,
        offset
    }: GetInteractionsRequest): Promise<GetInteractionsResponse> {
        const { data, error } = await this.client.POST(
            "/get-interactions",
            {
                body: {
                    time_range: time_range,
                    filters: filters,
                    limit: limit,
                    offset: offset
                },
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                }
            }
        );

        if (error) {
            console.error('Error:', error);
        }

        return data;
    }

    async getInteractionTimeSeries({
        time_range,
        filters,
        granularity,
    }: GetInteractionTimeSeriesRequest): Promise<GetInteractionTimeSeriesResponse> {
        const { data, error } = await this.client.POST(
            "/get-interaction-time-series",
            {
                body: {
                    time_range: time_range,
                    filters: filters,
                    granularity: granularity,
                },
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                }
            }
        );

        if (error) {
            console.error('Error:', error);
        }

        return data;
    }

    async getInteractionDetails(interaction_id: string): Promise<GetInteractionDetailsResponse> {
        const { data, error } = await this.client.GET(
            `/export/interactions/detail/{interaction_id}`,
            {
                params: {
                    path: { interaction_id: interaction_id },
                },
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                }
            }
        );

        if (error) {
            console.error('Error:', error);
        }

        return data;
    }

    async getInteractionMultiAggregates({
        time_range,
        filters,
        group_by_groups,
        limit,
        offset,
        order_by,
        variables,
    }: GetInteractionMultiAggregatesRequest): Promise<GetInteractionMultiAggregatesResponse> {
        const { data, error } = await this.client.POST(
            "/get-interaction-multi-aggregates",
            {
                body: {
                    time_range: time_range,
                    filters: filters,
                    variables: variables,
                    group_by_groups: group_by_groups,
                    order_by: order_by,
                    limit: limit,
                    offset: offset
                },
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                }
            }
        );

        if (error) {
            console.error('Error:', error);
        }

        return data;
    }
}
