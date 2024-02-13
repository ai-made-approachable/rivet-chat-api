import express from 'express';
import { GraphManager } from './graphManager.js';
import fs from 'fs';
import path from 'path';
import { authenticateAndGetJWT, listFiles, fetchFileContent } from './files.js';
import morgan from 'morgan';
const app = express();
const port = process.env.PORT || 3100; // Default port or environment variable
const environment = process.env.NODE_ENV;
const apiKey = process.env.RIVET_CHAT_API_KEY;
const domain = process.env.FILEBROWSER_DOMAIN;
app.use(express.json());
app.use(morgan('combined'));
// Middleware for API Key validation in production
app.use((req, res, next) => {
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
app.post('/v1/chat/completions', async (req, res) => {
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
    if (environment === 'production') {
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
            // Initialize GraphManager with the model content from Filebrowser
            // This step may require adjustments to GraphManager to accept file content directly
            const graphManager = new GraphManager({ modelContent: fileContent });
            let previousChunk = null;
            for await (const chunk of graphManager.runGraph(processedMessages)) {
                if (previousChunk !== null) {
                    // This means we have a chunk to send that is not the last one
                    const chunkData = {
                        ...commonData,
                        choices: [{ index: 0, delta: { content: previousChunk }, logprobs: null, finish_reason: null }],
                    };
                    res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
                }
                // Store the current chunk to be sent as the previous one in the next iteration
                previousChunk = chunk;
            }
            // After the loop, handle the last chunk
            if (previousChunk !== null) {
                // This is the last chunk
                const lastChunkData = {
                    ...commonData,
                    choices: [{ index: 0, delta: { content: previousChunk }, logprobs: null, finish_reason: "stop" }],
                };
                res.write(`data: ${JSON.stringify(lastChunkData)}\n\n`);
            }
            res.write('data: [DONE]\n\n');
        }
        catch (error) {
            console.error('Error processing graph:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
        finally {
            res.end();
        }
    }
    else {
        const directoryPath = path.resolve(process.cwd(), './rivet');
        const modelFilePath = path.join(directoryPath, modelId);
        if (!fs.existsSync(modelFilePath)) {
            return res.status(404).json({ message: 'Model not found' });
        }
        const graphManager = new GraphManager({ config: { file: modelFilePath } });
        try {
            for await (const chunk of graphManager.runGraph(processedMessages)) {
                const chunkData = {
                    ...commonData,
                    choices: [{ index: 0, delta: { content: chunk }, logprobs: null, finish_reason: null }],
                };
                res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
            }
            res.write('data: [DONE]\n\n');
        }
        catch (error) {
            console.error('Error processing graph:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
        finally {
            res.end();
        }
    }
});
app.get('/v1/models', async (req, res) => {
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
            res.json({ object: "list", data: models });
        }
        catch (error) {
            console.error('Error listing models from Filebrowser:', error);
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
    else {
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
            res.json({ object: "list", data: models });
        });
    }
});
const host = environment === 'production' ? '::' : 'localhost';
app.listen(Number(port), host, () => {
    console.log(`Server running at http://${host}:${port}/`);
});
//# sourceMappingURL=api.js.map