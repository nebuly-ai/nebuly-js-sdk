export async function sendDataToEndpoint(url, data, token) {
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
            console.log(await response.json());
            throw new Error(`Error: ${response.status}`);
        }
        const jsonResponse = await response.json();
        console.log('Success:', jsonResponse);
    }
    catch (error) {
        console.error('Error:', error);
    }
}
export function prepareDataForEndpoint(input, answer, chainSteps, timeStart, timeEnd, user_history, assistant_history, endUser, tags, anonymize) {
    // convert chain_steps to spans
    let traces = chainSteps.map((step) => {
        return step.toTrace();
    });
    let history = [];
    const length = Math.min(user_history.length, assistant_history.length);
    for (let i = 0; i < length; i++) {
        history.push([user_history[i], assistant_history[i]]);
    }
    console.log('history', history);
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
