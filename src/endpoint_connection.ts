import { ChainStep } from './base.js';

export async function sendDataToEndpoint(url: string, data: Record<string, unknown>, token: string) {
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
        console.log('Success:', jsonResponse);
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
    tags?: Record<string, string>
): Record<string, unknown> {
    // convert chain_steps to spans
    let dataSources = chainSteps.map((step) => {
        return step.toDataSource();
    });

    const data = {
        input: input,
        output: answer,
        data_sources: dataSources, // convert chain_steps to spans
        time_start: timeStart,
        time_end: timeEnd,
        history: [user_history, assistant_history],
        // hierarchy: hierarchy, unclear if really needed since we are treating chains as flat
        end_user: endUser,
        tags: tags,
    };
    return data;
}

/*
class InteractionWatch:
    input: str
    output: str
    time_end: datetime
    time_start: datetime
    spans: list[SpanWatch]
    history: list[HistoryEntry]
    hierarchy: dict[uuid.UUID, uuid.UUID | None]
    end_user: str
    end_user_group_profile: str | None
    tags: dict[str, str] | None = None
*/