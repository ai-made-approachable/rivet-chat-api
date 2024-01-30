import fs from 'fs/promises';
import { startDebuggerServer, coreCreateProcessor, loadProjectFromString } from '@ironclad/rivet-node';
async function main() {
    const debuggerServer = await startDebuggerServer({});
    const projectContent = await fs.readFile('./example.rivet-project', 'utf8');
    const project = loadProjectFromString(projectContent);
    const options = {
        graph: 'example-graph',
        inputs: {
            "prompt": "Please write me a short poem about a cat."
        },
        openAiKey: process.env.OPEN_API_KEY,
    };
    const { processor, run } = coreCreateProcessor(project, options);
    // Start running the processor but don't await here
    const runPromise = run();
    // Stream and process the events
    for await (const event of processor.events()) {
        if (event.type === 'partialOutput' && event.node.type === 'chat' && event.node.title === 'Output (Chat)') {
            // Attempt to log the content of the partial output
            const content = event.outputs.response.value; // Adjust this path based on your event object structure
            console.log('Chat Partial Output Content:', content);
        }
    }
    // Await the completion of the processor run
    const outputs = await runPromise;
    // Return the specific output value if it exists
    return outputs.response?.value;
}
main()
    .then(outputValue => {
    if (outputValue) {
        console.log('Output Value:', outputValue);
    }
})
    .catch(console.error)
    .finally(() => process.exit());
//# sourceMappingURL=rivet_backup.js.map