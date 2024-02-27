import * as Rivet from '@ironclad/rivet-node';
import fs from 'fs/promises';
import path from 'path';
import { setupPlugins, logAvailablePluginsInfo } from './pluginConfiguration.js';
import event from 'events';
logAvailablePluginsInfo();
event.setMaxListeners(100);
class DebuggerServer {
    constructor() {
        this.debuggerServer = null;
    }
    static getInstance() {
        if (!DebuggerServer.instance) {
            DebuggerServer.instance = new DebuggerServer();
        }
        return DebuggerServer.instance;
    }
    startDebuggerServerIfNeeded() {
        if (!this.debuggerServer) {
            this.debuggerServer = Rivet.startDebuggerServer();
            console.log('Debugger server started');
        }
        return this.debuggerServer;
    }
    getDebuggerServer() {
        return this.debuggerServer;
    }
}
DebuggerServer.instance = null;
export class GraphManager {
    constructor(params) {
        this.config = params.config || {};
        this.modelContent = params.modelContent;
    }
    async *runGraph(messages) {
        console.time('runGraph');
        let projectContent;
        // Ensure the DebuggerServer is started
        DebuggerServer.getInstance().startDebuggerServerIfNeeded();
        try {
            // Dynamically setup plugins and retrieve their settings
            const pluginSettings = await setupPlugins(Rivet);
            if (this.modelContent) {
                // Use direct model content if provided
                projectContent = this.modelContent;
            }
            else {
                // Otherwise, read the model file from the filesystem
                const modelFilePath = path.resolve(process.cwd(), './rivet', this.config.file);
                console.log("-----------------------------------------------------");
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
                    debugger: (data) => {
                        console.log(`Debugging data: ${JSON.stringify(data)}`);
                        return Promise.resolve();
                    }
                }
            };
            console.log("-----------------------------------------------------");
            console.log('Creating processor');
            const { processor, run } = Rivet.createProcessor(project, options);
            const runPromise = run();
            console.log('Starting to process events');
            let lastContent = '';
            for await (const event of processor.events()) {
                // Condition for 'partialOutput' events
                if (event.type === 'partialOutput' && event.node?.title?.toLowerCase() === "output") {
                    const content = event.outputs.response.value;
                    if (content && content.startsWith(lastContent)) {
                        const delta = content.slice(lastContent.length);
                        //console.log(`Yielding output from event type '${event.type}' with node type '${event.node?.type}'.`);
                        yield delta;
                        lastContent = content;
                    }
                }
                // Condition for 'nodeFinish' events
                else if (event.type === 'nodeFinish' &&
                    event.node?.title?.toLowerCase() === "output" &&
                    !event.node?.type?.includes('chat')) {
                    try {
                        const content = event.outputs.response.value;
                        if (content) {
                            //console.log(`Yielding output from event type '${event.type}' with node type '${event.node?.type}', on nodeFinish.`);
                            yield JSON.stringify(content);
                        }
                    }
                    catch (error) {
                        console.error(`Error: Cannot return output from node of type ${event.node?.type}. This only works with certain nodes (e.g., text or object)`);
                    }
                }
            }
            console.log('Finished processing events');
            const finalOutputs = await runPromise;
            if (finalOutputs && finalOutputs["output"]) {
                yield finalOutputs["output"].value;
            }
            if (finalOutputs["cost"]) {
                console.log(`Cost: ${finalOutputs["cost"].value}`);
            }
            console.log('runGraph finished');
        }
        catch (error) {
            console.error('Error in runGraph:', error);
        }
        finally {
            console.timeEnd('runGraph');
            console.log("-----------------------------------------------------");
        }
    }
}
//# sourceMappingURL=graphManager.js.map