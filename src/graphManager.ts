import * as Rivet from '@ironclad/rivet-node';
import fs from 'fs/promises';
import path from 'path';
import { setupPlugins, logAvailablePluginsInfo } from './pluginConfiguration.js';

logAvailablePluginsInfo();

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
            this.debuggerServer = Rivet.startDebuggerServer();
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
            // Dynamically setup plugins and retrieve their settings
            const pluginSettings = await setupPlugins(Rivet);

            if (this.modelContent) {
                // Use direct model content if provided
                projectContent = this.modelContent;
            } else {
                // Otherwise, read the model file from the filesystem
                const modelFilePath = path.resolve(process.cwd(), './rivet', this.config.file);
                console.log('runGraph called with model file:', modelFilePath);
                projectContent = await fs.readFile(modelFilePath, 'utf8');
            }
    
            const project = Rivet.loadProjectFromString(projectContent);
            const graphInput = "input";
    
            const datasetOptions = {
                save: true,
                // filePath should only be set if you're working with a file, adjust accordingly
                filePath: this.modelContent ? undefined : path.resolve(process.cwd(), './rivet', this.config.file),
            };

            const datasetProvider = this.modelContent ? undefined : await Rivet.NodeDatasetProvider.fromProjectFile(datasetOptions.filePath, datasetOptions);

            const options: Rivet.NodeRunGraphOptions = {
                graph: this.config.graphName,
                inputs: {
                    [graphInput]: {
                        type: 'chat-message[]',
                        value: messages.map(
                            (message) => ({
                                type: message.type,
                                message: message.message,
                            } as Rivet.ChatMessage)
                        ),
                    },
                },
                openAiKey: process.env.OPENAI_API_KEY,
                remoteDebugger: DebuggerServer.getInstance().getDebuggerServer(),
                datasetProvider: datasetProvider,
                pluginSettings,
                context: {
                    ...Object.entries(process.env).reduce((acc, [key, value]) => {
                        acc[key] = value;
                        return acc;
                    }, {}),
                },
                onUserEvent: {
                    // Add "event" node and with id "debugger" to log data from Rivet to the server logs
                    debugger: (data: Rivet.DataValue): Promise<void> => {
                        console.log(`Debugging data: ${JSON.stringify(data)}`);
                        return Promise.resolve();
                    }
                }
            };
    
            console.log('Creating processor');
            const { processor, run } = Rivet.createProcessor(project, options);
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
