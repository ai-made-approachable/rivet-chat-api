import express from 'express';
import { GraphManager } from './graphManager.js';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3100; // Default port or environment variable
const environment = process.env.NODE_ENV;
console.log(environment)
const apiKey = process.env.RIVET_CHAT_API_KEY;

app.use(express.json());

// Middleware for API Key validation in production
app.use((req, res, next) => {
    if (environment === 'production') {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
            return res.status(403).json({ message: 'Forbidden - Invalid API Key' });
        }
    }
    next();
});

// Dynamic model loading for chat completions based on the model specified in the request body
app.post('/v1/chat/completions', async (req, res) => {
    const modelId = req.body.model; // Get the model identifier from the request body
    if (!modelId) {
        return res.status(400).json({ message: 'Model identifier is required' });
    }

    const directoryPath = path.resolve(process.cwd(), './rivet');
    const modelFilePath = path.join(directoryPath, modelId);

    // Check if the model file exists
    if (!fs.existsSync(modelFilePath)) {
        return res.status(404).json({ message: 'Model not found' });
    }

    // Initialize GraphManager with the model
    const graphManager = new GraphManager({ file: modelFilePath });

    // Assuming "messages" is also part of the request body
    const messages = req.body.messages;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Messages are required and must be an array' });
    }

    const processedMessages = messages.map(({ role: type, content: message }) => ({ type, message }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const commonData = {
        id: 'chatcmpl-mockId12345',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: modelId, // Use the modelId from the request body
        system_fingerprint: null,
    };

    try {
        for await (const chunk of graphManager.runGraph(processedMessages)) {
            const chunkData = {
                ...commonData,
                choices: [{ index: 0, delta: { content: chunk }, logprobs: null, finish_reason: null }],
            };
            res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
    } catch (error) {
        console.error('Error processing graph:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        res.end();
    }
});


// Endpoint to list available models
app.get('/v1/models', (req, res) => {
    const directoryPath = path.resolve(process.cwd(), './rivet');
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error('Unable to scan directory:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        const data = files
            .filter(file => file.endsWith('.rivet-project')) // Filter files
            .map(file => {
                const stats = fs.statSync(path.join(directoryPath, file));
                return {
                    id: file,
                    object: "model",
                    created: Math.floor(stats.birthtimeMs / 1000),
                    owned_by: "user",
                };
            });

        res.json({ object: "list", data });
    });
});

const host = environment === 'production' ? '::' : 'localhost';

app.listen(Number(port), host, () => {
    console.log(`Server running at http://${host}:${port}/`);
});