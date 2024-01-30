import express from 'express';
import { Readable } from 'stream';
const app = express();
const port = 3100;
app.use(express.json());
app.post('/chat/completions', (req, res) => {
    console.log('Received a request at /chat/completions');
    // Mock response data chunks
    const dataChunks = [
        { content: "Hello" },
        { content: "!" },
        { content: " How" },
        { content: " can" },
        { content: " I" },
        { content: " assist" },
        { content: " you" },
        { content: " today" },
        { content: "?" },
        {}, // Last chunk with empty delta and finish_reason: "stop"
    ];
    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    // Create a readable stream
    const stream = new Readable({
        read() { }
    });
    // Common data for all chunks
    const commonData = {
        id: "chatcmpl-mockId12345",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "gpt-3.5-turbo",
        system_fingerprint: null,
    };
    // Function to simulate delayed chunk sending
    let chunkIndex = 0;
    const sendNextChunk = () => {
        if (chunkIndex < dataChunks.length) {
            const chunkData = {
                ...commonData,
                choices: [
                    {
                        index: 0,
                        delta: dataChunks[chunkIndex],
                        logprobs: null,
                        finish_reason: chunkIndex === dataChunks.length - 1 ? "stop" : null
                    }
                ]
            };
            const chunk = `data: ${JSON.stringify(chunkData)}\n\n`;
            stream.push(chunk);
            chunkIndex++;
            setTimeout(sendNextChunk, 100); // Adjust delay as needed
        }
        else {
            stream.push('data: [DONE]\n\n');
            stream.push(null); // No more data to send
        }
    };
    sendNextChunk();
    // Pipe the stream to the response
    stream.pipe(res);
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
//# sourceMappingURL=api_backup.js.map