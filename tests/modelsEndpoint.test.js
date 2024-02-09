const axios = require('axios');

describe('GET /v1/models', () => {
  it('should respond with a list of models', async () => {
    const baseUrl = 'http://localhost:3100/v1/models'; // Adjust as necessary

    // Send a GET request
    const response = await axios.get(baseUrl);

      // Check the structure of the response
      expect(res.body).toEqual(expect.objectContaining({
          object: 'list',
          data: expect.any(Array)
      }));

      // Check the structure of the first item in the data array
      if (res.body.data.length > 0) {
          expect(res.body.data[0]).toEqual(expect.objectContaining({
              id: expect.any(String),
              object: expect.any(String),
              created: expect.any(Number),
              owned_by: 'user'
          }));
      }
  });
});
