import { startDebuggerServer, loadProjectFromString, createProcessor, NodeDatasetProvider } from '@ironclad/rivet-node';
import config from 'config';
import fs from 'fs/promises';
class GraphManager {
    constructor() {
        this.debuggerServer = null;
    }
    startDebuggerServerIfNeeded() {
        if (!this.debuggerServer) {
            this.debuggerServer = startDebuggerServer({});
        }
    }
    async *runGraph(messages) {
        console.log('runGraph called');
        this.startDebuggerServerIfNeeded();
        const projectContent = await fs.readFile(config.get('file'), 'utf8');
        const project = loadProjectFromString(projectContent);
        const graphInput = config.get('graphInputName');
        const datasetOptions = {
            save: true,
            filePath: config.get('file'),
        };
        const datasetProvider = await NodeDatasetProvider.fromProjectFile(config.get('file'), datasetOptions);
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
                    event.node.type === config.get('streamingOutput.nodeType') &&
                    event.node.title === config.get('streamingOutput.nodeName')) {
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
            if (config.get('returnGraphOutput')) {
                yield finalOutputs[config.get('graphOutputName')].value;
            }
            console.log('runGraph finished');
        }
        catch (error) {
            console.error(error);
        }
    }
}
export const graphManager = new GraphManager();
//# sourceMappingURL=graphManager.js.map