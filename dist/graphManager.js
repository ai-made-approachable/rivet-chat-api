import { startDebuggerServer, loadProjectFromString, createProcessor } from '@ironclad/rivet-node';
import config from 'config';
import fs from 'fs/promises';
class GraphManager {
    constructor() {
        this.output = null;
        this.isRunning = false;
        this.debuggerServer = null;
    }
    // Make sure we only have one debugger
    startDebuggerServerIfNeeded() {
        if (!this.debuggerServer) {
            this.debuggerServer = startDebuggerServer({});
        }
    }
    async *runGraph(messages) {
        console.log('runGraph called'); // Debugging line
        if (this.isRunning) {
            console.log('runGraph early exit because it is already running'); // Debugging line
            return;
        }
        this.isRunning = true;
        this.startDebuggerServerIfNeeded();
        const projectContent = await fs.readFile(config.get('file'), 'utf8');
        const project = loadProjectFromString(projectContent);
        const graphInput = config.get('graphInputName');
        const options = {
            graph: config.get('graphName'),
            inputs: {
                [graphInput]: {
                    type: 'chat-message[]',
                    value: messages.map((message) => ({
                        type: message.type,
                        message: message.message,
                    })),
                },
            },
            openAiKey: process.env.OPEN_API_KEY,
            remoteDebugger: this.debuggerServer,
        };
        console.log('Creating processor');
        // Do not fail application on error
        try {
            const { processor, run } = createProcessor(project, options);
            const runPromise = run();
            console.log('Starting to process events'); // Debugging line
            let lastContent = '';
            for await (const event of processor.events()) {
                if (event.type === 'partialOutput' &&
                    event.node.type === config.get('streamingOutput.nodeType') &&
                    event.node.title === config.get('streamingOutput.nodeName')) {
                    const content = event.outputs.response.value;
                    this.output = content; // Update the output variable with the content
                    if (content.startsWith(lastContent)) {
                        const delta = content.slice(lastContent.length); // Calculate the new data
                        yield delta; // Yield the new data
                        lastContent = content; // Update the last content
                    }
                }
            }
            console.log('Finished processing events'); // Debugging line
            const finalOutputs = await runPromise;
            // Also return the graph output if returnGraphOutput is configured as true
            if (config.get('returnGraphOutput')) {
                yield finalOutputs[config.get('graphOutputName')].value;
            }
            this.isRunning = false;
            console.log('runGraph finished'); // Debugging line
        }
        catch (error) {
            console.error(error);
            // Set isRunning to false to allow the next runGraph call to run
            this.isRunning = false;
        }
    }
    getOutput() {
        return this.output;
    }
}
export const graphManager = new GraphManager();
//# sourceMappingURL=graphManager.js.map