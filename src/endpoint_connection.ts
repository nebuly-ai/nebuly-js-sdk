import { ChainStep } from './base.js';

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
}

export function prepareDataForEndpoint(
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
    let traces = chainSteps.map((step) => {
        return step.toTrace();
    });

    let history: string[][] = [];
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
    return data;
}