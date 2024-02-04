import express from 'express';
import { GraphManager } from './graphManager.js'; // Adjust the import to use the class
import config from 'config';
const configs = config.get('servers');
configs.forEach((serverConfig) => {
    const app = express();
    const port = serverConfig.port;
    // Create a new instance of GraphManager for each configuration
    const graphManager = new GraphManager(serverConfig);
    app.use(express.json());
    app.post('/chat/completions', async (req, res) => {
        const messages = req.body.messages.slice(1).map(({ role: type, content: message }) => ({ type, message }));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        const commonData = {
            id: 'chatcmpl-mockId12345',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'rivet',
            system_fingerprint: null,
        };
        let allChunks = '';
        for await (const chunk of graphManager.runGraph(messages)) {
            const chunkData = {
                ...commonData,
                choices: [
                    {
                        index: 0,
                        delta: { content: chunk },
                        logprobs: null,
                        finish_reason: null,
                    },
                ],
            };
            res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
            if (chunk && chunk.trim().length > 0) {
                allChunks += chunk + ' ';
            }
        }
        if (allChunks.trim().length > 0 && serverConfig.textToSpeech) {
            //await textToSpeech(allChunks, serverConfig); // Assuming textToSpeech can accept config
        }
        res.write('data: [DONE]\n\n');
        res.end();
    });
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
});
//# sourceMappingURL=api.js.map