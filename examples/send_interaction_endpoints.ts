import { NebulySdk } from "@nebuly-ai/nebuly-js-sdk";
import { RAGSource } from "../dist/base";


async function main() {
    const client = new NebulySdk('<YOUR_API_KEY>');

    const messages = [
        {
            "role": "user",
            "content": "Hello"
        }
    ]

    const responseAssistant = "Hello, how can I help you today?"
    const modelName = "gpt-4o"

    const ragSouces = [
        new RAGSource(
            "diego_retriever",
            "Hello",
            ["Hello, how can I help you today?"]
        )
    ]

    client.sendOpenAIInteraction(
        messages,
        responseAssistant,
        modelName,
        new Date(),
        new Date(),
        "user1",
        undefined,
        undefined,
        ragSouces,
    )
}


main();