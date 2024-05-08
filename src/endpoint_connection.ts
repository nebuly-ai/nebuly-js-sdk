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

    if (chainSteps.length >= 1 && input == "" || answer == "") {
        const llmSteps = chainSteps.filter((step) => step.name == "LLM");
        if (llmSteps.length > 0) {
            for (let i = 0; i < llmSteps.length; i++) {
                const llmStep = llmSteps[i];
                const stepInput = llmStep.query || "";
                const stepOutputs = llmStep.response || [];
                if (stepOutputs.length == 0) {
                    continue;
                }
                const stepOutput = stepOutputs[0];
                const assistantHistory = llmStep.metadata.assistantHistory as string[];
                const userHistory = llmStep.metadata.userHistory as string[];
                if (input == "" && answer == "") {
                    // if both input and answer are empty, use the last LLM step
                    data.interaction.input = stepInput;
                    data.interaction.output = stepOutput;
                    data.interaction.history = assistantHistory.map((assistant, i) => [userHistory[i], assistant]);
                } else if (input == "" && answer == stepOutput) {
                    // if input is empty, use the first LLM step that has the same output as the answer
                    data.interaction.input = stepInput;
                    data.interaction.history = assistantHistory.map((assistant, i) => [userHistory[i], assistant]);
                    break;
                } else if (answer == "" && input == stepInput) {
                    // if answer is empty, use the first LLM step that has the same input as the input
                    data.interaction.output = stepOutput;
                    break;
                }
            }
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
