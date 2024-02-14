import {
    startDebuggerServer,
    loadProjectFromString,
    createProcessor,
    NodeRunGraphOptions,
    ChatMessage,
    NodeDatasetProvider
} from '@ironclad/rivet-node';
import fs from 'fs/promises';
import path from 'path';

class DebuggerServer {
    private static instance: DebuggerServer | null = null;
    private debuggerServer: any = null;

    private constructor() {}

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
        return this.debuggerServer;
    }

    public getDebuggerServer() {
        return this.debuggerServer;
    }
}

export class GraphManager {
    config: any;
    modelContent?: string;

    constructor(params: { config?: any; modelContent?: string }) {
        this.config = params.config || {};
        this.modelContent = params.modelContent;
    }

    async *runGraph(messages: Array<{ type: 'user' | 'assistant'; message: string }>) {
        let projectContent: string;
    
        // Ensure the DebuggerServer is started
        DebuggerServer.getInstance().startDebuggerServerIfNeeded();
    
        try {
            if (this.modelContent) {
                // Use direct model content if provided
                projectContent = this.modelContent;
            } else {
                // Otherwise, read the model file from the filesystem
                const modelFilePath = path.resolve(process.cwd(), './rivet', this.config.file);
                console.log('runGraph called with model file:', modelFilePath);
                projectContent = await fs.readFile(modelFilePath, 'utf8');
            }
    
            const project = loadProjectFromString(projectContent);
            const graphInput = "input";
    
            const datasetOptions = {
                save: true,
                // filePath should only be set if you're working with a file, adjust accordingly
                filePath: this.modelContent ? undefined : path.resolve(process.cwd(), './rivet', this.config.file),
            };
    
            const datasetProvider = this.modelContent ? undefined : await NodeDatasetProvider.fromProjectFile(datasetOptions.filePath, datasetOptions);
    
            const options: NodeRunGraphOptions = {
                graph: this.config.graphName,
                inputs: {
                    [graphInput]: {
                        type: 'chat-message[]',
                        value: messages.map(
                            (message) => ({
                                type: message.type,
                                message: message.message,
                            } as ChatMessage)
                        ),
                    },
                },
                openAiKey: process.env.OPENAI_API_KEY,
                remoteDebugger: DebuggerServer.getInstance().getDebuggerServer(),
                datasetProvider: datasetProvider,
            };
    
            console.log('Creating processor');
            const { processor, run } = createProcessor(project, options);
            const runPromise = run();
            console.log('Starting to process events');
    
            let lastContent = '';
    
            for await (const event of processor.events()) {
                if (
                    event.type === 'partialOutput' &&
                    event.node.title.toLowerCase() === "output"
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
            if (finalOutputs && finalOutputs["output"]) {
                yield finalOutputs["output"].value;
            }
    
            console.log('runGraph finished');
        } catch (error) {
            console.error('Error in runGraph:', error);
        }
    }
    
    }
