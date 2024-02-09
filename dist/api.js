import express from 'express';
import { GraphManager } from './graphManager.js'; // Adjust the import to use the class
import config from 'config';
const apiKey = config.get('api_key');
const configs = config.get('servers');
const environment = process.env.NODE_ENV;
configs.forEach((serverConfig) => {
    const app = express();
    const port = serverConfig.port;
    // Create a new instance of GraphManager for each configuration
    const graphManager = new GraphManager(serverConfig);
    app.use(express.json());
    app.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
            return res.status(403).json({ message: 'Forbidden - Invalid API Key' });
        }
        next();
    });
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
        res.write('data: [DONE]\n\n');
        res.end();
    });
    app.get('/v1/models', (req, res) => {
        res.json({
            "object": "list",
            "data": [
                {
                    "id": "rivet",
                    "object": "rivet",
                    "created": 1686935002,
                    "owned_by": "ai_made_approachable"
                }
            ]
        });
    });
    if (environment === 'production') {
        // For production, listen on all IPv6 addresses
        app.listen(port, '::', () => {
            console.log(`Server listening on [::]:${port} (IPv6)`);
        });
    }
    else {
        // For non-production environments, listen on localhost (IPv4)
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}/`);
        });
    }
});
//# sourceMappingURL=api.js.map