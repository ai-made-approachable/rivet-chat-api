import {
    startDebuggerServer,
    loadProjectFromString,
    createProcessor,
    NodeRunGraphOptions,
    ChatMessage,
    NodeDatasetProvider
} from '@ironclad/rivet-node';
import fs from 'fs/promises';

class DebuggerServer {
    private static instance: DebuggerServer | null = null;
    private debuggerServer: any = null; // Consider typing this more precisely if possible

    private constructor() {
        // Private constructor to prevent direct construction calls with the `new` operator.
    }

    public static getInstance(): DebuggerServer {
        if (!DebuggerServer.instance) {
            DebuggerServer.instance = new DebuggerServer();
        }
        return DebuggerServer.instance;
    }

    public startDebuggerServerIfNeeded() {
        if (!this.debuggerServer) {
            this.debuggerServer = startDebuggerServer({});
            console.log('Debugger server started');
        }
        return this.debuggerServer; // Return the debugger server instance
    }

    // Optionally, provide a method to directly access the debuggerServer
    public getDebuggerServer() {
        return this.debuggerServer;
    }
}



export class GraphManager {
    config: any;

    constructor(config: any) {
        this.config = config;
    }

    async *runGraph(messages: Array<{ type: 'user' | 'assistant'; message: string }>) {
        console.log('runGraph called with config:', this.config.file);

        DebuggerServer.getInstance();
        const projectContent = await fs.readFile(this.config.file, 'utf8');
        const project = loadProjectFromString(projectContent);
        const graphInput = this.config.graphInputName as string;
        
        const datasetOptions = {
            save: true,
            filePath: this.config.file,
        };
        
        const datasetProvider = await NodeDatasetProvider.fromProjectFile(this.config.file, datasetOptions);

        const options: NodeRunGraphOptions = {
            graph: this.config.graphName,
            inputs: {
                [graphInput]: {
                    type: 'chat-message[]',
                    value: messages.map(
                        (message) =>
                            ({
                                type: message.type,
                                message: message.message,
                            } as ChatMessage)
                    ),
                },
            },
            openAiKey: process.env.OPENAI_API_KEY,
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
                if (
                    event.type === 'partialOutput' &&
                    event.node.type === this.config.streamingOutput.nodeType &&
                    event.node.title === this.config.streamingOutput.nodeName
                ) {
                    const content = (event.outputs as any).response.value;

                    if (content.startsWith(lastContent)) {
                        const delta = content.slice(lastContent.length);
                        yield delta;
                        lastContent = content;
                    }
                }
            }

            console.log('Finished processing events');

            const finalOutputs = await runPromise;
            if(this.config.returnGraphOutput) {
                yield finalOutputs[this.config.graphOutputName as string].value;
            }

            console.log('runGraph finished');
        } catch (error) {
            console.error(error);
        }
    }
}
