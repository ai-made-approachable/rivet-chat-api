import { startDebuggerServer, loadProjectFromString, createProcessor, NodeDatasetProvider } from '@ironclad/rivet-node';
import fs from 'fs/promises';
class DebuggerServer {
    constructor() {
        this.debuggerServer = null; // Consider typing this more precisely if possible
        // Private constructor to prevent direct construction calls with the `new` operator.
    }
    static getInstance() {
        if (!DebuggerServer.instance) {
            DebuggerServer.instance = new DebuggerServer();
        }
        return DebuggerServer.instance;
    }
    startDebuggerServerIfNeeded() {
        if (!this.debuggerServer) {
            this.debuggerServer = startDebuggerServer({});
            console.log('Debugger server started');
        }
        return this.debuggerServer; // Return the debugger server instance
    }
    // Optionally, provide a method to directly access the debuggerServer
    getDebuggerServer() {
        return this.debuggerServer;
    }
}
DebuggerServer.instance = null;
export class GraphManager {
    constructor(config) {
        this.config = config;
    }
    async *runGraph(messages) {
        console.log('runGraph called with config:', this.config.file);
        DebuggerServer.getInstance();
        const projectContent = await fs.readFile(this.config.file, 'utf8');
        const project = loadProjectFromString(projectContent);
        const graphInput = this.config.graphInputName;
        const datasetOptions = {
            save: true,
            filePath: this.config.file,
        };
        const datasetProvider = await NodeDatasetProvider.fromProjectFile(this.config.file, datasetOptions);
        const options = {
            graph: this.config.graphName,
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
            remoteDebugger: DebuggerServer.getInstance().startDebuggerServerIfNeeded(),
            datasetProvider: datasetProvider
        };
        console.log('Creating processor');
        try {
            const { processor, run } = createProcessor(project, options);
            const runPromise = run();
            console.log('Starting to process events');
            let lastContent = '';
            for await (const event of processor.events()) {
                if (event.type === 'partialOutput' &&
                    event.node.type === this.config.streamingOutput.nodeType &&
                    event.node.title === this.config.streamingOutput.nodeName) {
                    const content = event.outputs.response.value;
                    if (content.startsWith(lastContent)) {
                        const delta = content.slice(lastContent.length);
                        yield delta;
                        lastContent = content;
                    }
                }
            }
            console.log('Finished processing events');
            const finalOutputs = await runPromise;
            if (this.config.returnGraphOutput) {
                yield finalOutputs[this.config.graphOutputName].value;
            }
            console.log('runGraph finished');
        }
        catch (error) {
            console.error(error);
        }
    }
}
//# sourceMappingURL=graphManager.js.map