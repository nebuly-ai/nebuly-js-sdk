import { NebulySdk } from "@nebuly-ai/nebuly-js-sdk";

async function main() {
    const client = new NebulySdk('<YOUR_API_KEY>');

    const interactions = await client.getInteractions({
        time_range: {
            start: new Date("2024-01-01T00:00:00Z"),
            end: new Date()
        },
        filters: [],
        limit: 10,
        offset: 0
    });

    console.log(interactions);

    const timeSeries = await client.getInteractionTimeSeries({
        time_range: {
            start: new Date("2024-01-01T00:00:00Z"),
            end: new Date()
        },
        filters: [],
        group_by: { kind: "user_intent" },
        limit: 10,
        offset: 0
    });

    console.log(timeSeries);


    const aggregates = await client.getInteractionAggregates({
        time_range: {
            start: new Date("2024-01-01T00:00:00Z"),
            end: new Date()
        },
        filters: [],
        group_by: { kind: "user_intent" },
        limit: 10,
        offset: 0
    });

    console.log(aggregates);

    const interactionDetails = await client.getInteractionDetails(interactions.data[0].id || "");

    console.log(interactionDetails);

    const multiAggregates = await client.getInteractionMultiAggregates({
        time_range: {
            start: new Date("2024-01-01T00:00:00Z"),
            end: new Date()
        },
        filters: [],
        group_by_groups: [[{ kind: "user_intent" }], [{ kind: "topic" }]],
        limit: 10,
        offset: 0,
    });

    console.log(multiAggregates);
}

main();