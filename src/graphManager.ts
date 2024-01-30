import {
    startDebuggerServer,
    loadProjectFromString,
    createProcessor,
    NodeRunGraphOptions,
    ChatMessage
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
        const graphInput = config.get('graphInput') as string;

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
      } satisfies NodeRunGraphOptions;

        console.log('Creating processor');

        const { processor, run } = createProcessor(project, options);
        const runPromise = run();

        console.log('Starting to process events'); // Debugging line

        let lastContent = '';

        for await (const event of processor.events()) {
            if (
                event.type === 'partialOutput' &&
                event.node.type === config.get('nodeType') &&
                event.node.title === config.get('nodeName')
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

        await runPromise;
        this.isRunning = false;

        console.log('runGraph finished'); // Debugging line
    }

    getOutput() {
        return this.output;
    }
}

export const graphManager = new GraphManager();
