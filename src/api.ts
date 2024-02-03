import express from 'express';
import { graphManager } from './graphManager.js';
import { textToSpeech } from './textToSpeech.js';
import config from 'config';

const app = express();
const port = 3100;

app.use(express.json());

app.post('/chat/completions', async (req, res) => {
    // Get messages, remove system prompt from ChatbotUI and transform them for input to Rivet
    const messages = req.body.messages.slice(1).map(({ role: type, content: message }) => ({ type, message }));

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Common data for all chunks
    const commonData = {
        id: 'chatcmpl-mockId12345',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'rivet',
        system_fingerprint: null,
    };

    // Initialize an empty string to hold all the chunks
    let allChunks = '';

    // Iterate over the chunks and send each one as soon as it's ready
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

        // Add the chunk to allChunks
        if (chunk && chunk.trim().length > 0) {
            allChunks += chunk + ' ';
        }
    }

    // Convert allChunks to speech and play it back
    if (allChunks.trim().length > 0 && config.get('textToSpeech')) {
        await textToSpeech(allChunks);
    }

    // Send the final '[DONE]' message
    res.write('data: [DONE]\n\n');
    res.end(); // No more data to send
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
