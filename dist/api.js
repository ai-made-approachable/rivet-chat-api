import express from 'express';
import { graphManager } from './graphManager.js';
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
        id: "chatcmpl-mockId12345",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "rivet",
        system_fingerprint: null,
    };
    // Iterate over the chunks and send each one as soon as it's ready
    for await (const chunk of graphManager.runGraph(messages)) {
        const chunkData = {
            ...commonData,
            choices: [
                {
                    index: 0,
                    delta: { content: chunk },
                    logprobs: null,
                    finish_reason: null
                }
            ]
        };
        res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
    }
    // Send the final '[DONE]' message
    res.write('data: [DONE]\n\n');
    res.end(); // No more data to send
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
//# sourceMappingURL=api.js.map