import {
    startDebuggerServer,
    loadProjectFromString,
    createProcessor,
    NodeRunGraphOptions,
    ChatMessage,
    NodeDatasetProvider
} from '@ironclad/rivet-node';
import config from 'config';
import fs from 'fs/promises';

class GraphManager {
    output = null;
    isRunning = false;
    debuggerServer = null;

    // Make sure we only have one debugger
    startDebuggerServerIfNeeded() {
        if (!this.debuggerServer) {
            this.debuggerServer = startDebuggerServer({});
        }
    }

    async *runGraph(messages: Array<{ type: 'user' | 'assistant'; message: string }>) {
        console.log('runGraph called'); // Debugging line

        if (this.isRunning) {
            console.log('runGraph early exit because it is already running'); // Debugging line
            return;
        }

        this.isRunning = true;
        this.startDebuggerServerIfNeeded();
        const projectContent = await fs.readFile(config.get('file'), 'utf8');
        const project = loadProjectFromString(projectContent);
        const graphInput = config.get('graphInputName') as string;
        // Get datasetprovider so Rivet internal datasets can also be used
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
                  value: messages.map(
                      (message) =>
                          ({
                              type: message.type,
                              message: message.message,
                          } as ChatMessage)
                  ),
              },
          },
          openAiKey: process.env.OPEN_API_KEY,
          remoteDebugger: this.debuggerServer,
          datasetProvider: datasetProvider
      } satisfies NodeRunGraphOptions;

        console.log('Creating processor');

        // Do not fail application on error
        try {
            const { processor, run } = createProcessor(project, options);
            const runPromise = run();
            console.log('Starting to process events'); // Debugging line

            let lastContent = '';

            for await (const event of processor.events()) {
                if (
                    event.type === 'partialOutput' &&
                    event.node.type === config.get('streamingOutput.nodeType') &&
                    event.node.title === config.get('streamingOutput.nodeName')
                ) {
                    const content = (event.outputs as any).response.value;
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
            if(config.get('returnGraphOutput')) {
                yield finalOutputs[config.get('graphOutputName')].value;
            }
            this.isRunning = false;

            console.log('runGraph finished'); // Debugging line
        } catch (error) {
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
