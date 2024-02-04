const axios = require('axios');

describe('Parallel Requests', () => {
  it('should handle parallel requests', async () => {
    const baseUrl = 'http://localhost:3100/chat/completions'; // Adjust as necessary
    const requestData = { messages: [{ role: 'user', content: 'Hello' }] }; // Example request body

    // Send two parallel requests
    const requestOne = axios.post(baseUrl, requestData);
    const requestTwo = axios.post(baseUrl, requestData);

    // Wait for both requests to complete
    const responses = await Promise.all([requestOne, requestTwo]);

    // Check responses
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
    // Add more assertions as needed
  });
});
