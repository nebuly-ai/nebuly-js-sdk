import { ChainStep, FeedbackAction, FeedbackActionMetadata } from './base.js';


export const BASE_ENDPOINT_URL = process.env.NEBULY_ENDPOINT_URL || 'https://backend.nebuly.com/event-ingestion';
export const INTERACTION_ENDPOINT_URL = `${BASE_ENDPOINT_URL}/api/v1/events/trace_interaction`;
export const FEEDBACK_ENDPOINT_URL = `${BASE_ENDPOINT_URL}/api/v1/events/feedback`;


export async function sendDataToEndpoint(url: string, data: Record<string, unknown>, token: string): Promise<Record<string, unknown> | undefined> {
    try {
        const response = await fetch(url, {
            method: 'POST', // or 'PUT' depending on the API
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        const jsonResponse = await response.json();
        return jsonResponse;
    } catch (error) {
        console.error('Error:', error);
    }
    return;
}

export function prepareDataForInterctionEndpoint(
    input: string, 
    answer: string, 
    chainSteps: ChainStep[],
    timeStart: Date, 
    timeEnd: Date, 
    user_history: string[],
    assistant_history: string[],
    endUser: string,
    tags?: Record<string, string>,
    anonymize?: boolean
): Record<string, unknown> {
    // convert chain_steps to spans
    const traces = chainSteps.map((step) => {
        return step.toTrace();
    });

    const history: string[][] = [];
    const length = Math.min(user_history.length, assistant_history.length);
    for (let i = 0; i < length; i++) {
        history.push([user_history[i], assistant_history[i]]);
    }
    const data = {
        interaction: {
            input: input,
            output: answer,
            time_start: timeStart,
            time_end: timeEnd,
            history: history,
            end_user: endUser,
            tags: tags || {},
        },
        traces: traces,
        anonymize: anonymize || false,
    };

    // Set input, output and history for chat models that are not inside chains
    if (chainSteps.length == 1) {
        const step = chainSteps[0]
        if (step.name == "LLM" && traces.length == 1 && input == "" && answer == "") {
            const trace = traces[0]
            data.interaction.input = String(trace["input"])
            data.interaction.output = String(trace["output"])
            data.interaction.history = trace["history"] 
        }
    }

    return data;
}


export function prepareDataForFeedbackEndpoint(
    feedbackAction: FeedbackAction,
    metadata: FeedbackActionMetadata,
): Record<string, unknown> {
    return {
        "action": feedbackAction,
        "metadata": metadata,
    };
}
