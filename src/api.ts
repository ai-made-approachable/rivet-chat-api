import express from 'express';
import { GraphManager } from './graphManager.js';
import fs from 'fs';
import path from 'path';
import { authenticateAndGetJWT, listFiles, fetchFileContent } from  './files.js';
import morgan from 'morgan';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3100; // Default port or environment variable
const environment = process.env.NODE_ENV;
const apiKey = process.env.RIVET_CHAT_API_KEY;
const domain = process.env.FILEBROWSER_DOMAIN;

app.use(express.json());
app.use(morgan('combined'));

app.use((req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url}`);
    next();
});

app.use(cors({
    origin: process.env.ACCESS_CONTROL_ALLOW_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'], // Specify the methods you want to allow
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware for API Key validation in production
app.use((req, res, next) => {
    //console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
    //console.log('Request Body:', JSON.stringify(req.body, null, 2));
    if (environment === 'production') {
        const authHeader = req.headers.authorization;
        // Do not check authentification on non internal domains
        if (!req.hostname.endsWith('.internal')) {
            if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
                return res.status(403).json({ message: 'Forbidden - Invalid API Key' });
            }
        }
    }
    next();
});

// Dynamic model loading for chat completions based on the model specified in the request body
app.post('/chat/completions', async (req, res) => {
    const modelId = req.body.model;
    if (!modelId) {
        return res.status(400).json({ message: 'Model identifier is required' });
    }

    const messages = req.body.messages;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Messages are required and must be an array' });
    }

    const processedMessages = messages.map(({ role: type, content: message }) => ({ type, message }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Transfer-Encoding', 'chunked');

    const commonData = {
        id: 'chatcmpl-mockId12345',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: modelId,
        system_fingerprint: null,
    };

    // Define a function to process and send chunks
    async function processAndSendChunks(graphManager) {
        let isFirstChunk = true;
        let previousChunk = null;
        let accumulatedContent = "";

        for await (const chunk of graphManager.runGraph(processedMessages)) {
            if (isFirstChunk) {
                isFirstChunk = false;
                // Include role only for the first chunk
                previousChunk = { role: "assistant", content: chunk };
            } else {
                // Send the previous chunk now that we know it's not the last
                if (previousChunk !== null) {
                    const chunkData = {
                        ...commonData,
                        choices: [{ index: 0, delta: previousChunk, logprobs: null, finish_reason: null }],
                    };
                    res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
                    accumulatedContent += previousChunk.content;
                }
                previousChunk = { content: chunk }; // Update previousChunk to current chunk
            }
        }

        // Handle the last chunk
        if (previousChunk !== null) {
            accumulatedContent += previousChunk.content;
            const lastChunkData = {
                ...commonData,
                choices: [{ index: 0, delta: previousChunk, logprobs: null, finish_reason: "stop" }],
            };
            res.write(`data: ${JSON.stringify(lastChunkData)}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        //console.log('Final Output:', accumulatedContent);
        res.end()
    }

    // Handling for non-production environment or when not the special case
    if (environment !== 'production') {
        const directoryPath = path.resolve(process.cwd(), './rivet');
        const modelFilePath = path.join(directoryPath, modelId);

        if (!fs.existsSync(modelFilePath)) {
            return res.status(404).json({ message: 'Model not found' });
        }

        const graphManager = new GraphManager({ config: { file: modelFilePath } });
        await processAndSendChunks(graphManager);
        return;
    }

    // Handling for production environment (excluding summarizer.rivet-project)
    try {
        const token = await authenticateAndGetJWT();
        if (!token) {
            return res.status(401).json({ message: 'Failed to authenticate with Filebrowser' });
        }
        const filePath = `/${modelId}`; // Adjust based on your Filebrowser structure
        const fileContent = await fetchFileContent(filePath, token);
        if (!fileContent) {
            return res.status(404).json({ message: 'Model not found on Filebrowser' });
        }

        const graphManager = new GraphManager({ modelContent: fileContent });
        await processAndSendChunks(graphManager);
    } catch (error) {
        console.error('Error processing graph:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.get('/models', async (req, res) => {
    // For prod get the contents from the filebrowser application
    if (environment === 'production') {
        try {
            const token = await authenticateAndGetJWT();
            if (!token) {
                return res.status(401).json({ message: 'Failed to authenticate with Filebrowser' });
            }
            const files = await listFiles(token); // This should return the array of files
            if (!files || !Array.isArray(files)) {
                // If files is not an array, log the actual structure for debugging
                console.error('Unexpected structure:', files);
                return res.status(500).json({ message: 'Unexpected response structure from Filebrowser' });
            }
            const models = files.filter(file => file.extension === '.rivet-project').map(file => ({
                id: file.name,
                object: "model",
                created: new Date(file.modified).getTime() / 1000, // Convert to Unix timestamp if needed
                owned_by: "user",
            }));
            res.setHeader('Content-Type', 'application/json');
            res.json({ object: "list", data: models });
        } catch (error) {
            console.error('Error listing models from Filebrowser:', error);
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    } else {
        // Local filesystem logic...
        const directoryPath = path.resolve(process.cwd(), './rivet');
        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                console.error('Unable to scan directory:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }

            const models = files.filter(file => file.endsWith('.rivet-project')).map(file => {
                const fullPath = path.join(directoryPath, file);
                const stats = fs.statSync(fullPath);
                return {
                    id: file,
                    object: "model",
                    created: Math.floor(stats.birthtimeMs / 1000),
                    owned_by: "user",
                };
            });
            res.setHeader('Content-Type', 'application/json');
            res.json({ object: "list", data: models });
        });
    }
});


const host = environment === 'production' ? '::' : 'localhost';

app.listen(Number(port), host, () => {
    console.log(`Server running at http://${host}:${port}/`);
    console.log("-----------------------------------------------------");
});