import axios from 'axios';

// Use internal domain when online and public domain when testing locally
const localDev = process.env.LOCAL_DEV === 'true';
let filebrowserUrl = process.env.FILEBROWSER_DOMAIN;

export async function authenticateAndGetJWT() {
  const loginUrl = `${filebrowserUrl}/api/login`;
  const payload = {
    username: process.env.FILEBROWSER_USERNAME,
    password: process.env.FILEBROWSE_PASSWORD,
    recaptcha: "" //
  };

  try {
    const response = await axios.post(loginUrl, payload);
    const token = response.data;
    // console.log('JWT Token:', token);
    return token;
  } catch (error) {
    console.error('Error during authentication:', error.response ? error.response.data : error.message);
    return null;
  }
}

export async function listFiles(jwtToken) {
    try {
      const url = `${filebrowserUrl}/api/resources/`;
      const response = await axios.get(url, {
        headers: { 'X-AUTH': jwtToken }
      });
      // Directly return the array assuming response.data is the array
      return response.data.items; // Adjust this line if the structure is nested differently
    } catch (error) {
      console.error('Error fetching files:', error.response ? error.response.data : error.message);
      return []; // Return an empty array on error
    }
  }

export async function fetchFileContent(filePath, jwtToken) {
    try {
      // Construct the URL to access the specific file, including the auth token as a query parameter.
      const fileUrl = `${filebrowserUrl}/api/raw${filePath}?auth=${jwtToken}`;
  
      const response = await axios.get(fileUrl, { responseType: 'blob' });
      // For binary files, 'blob' is used. For text files, you might use 'text'.
  
      // Assuming you want to process the file content further or send it in a response:
      // Note: Depending on your use case, you might handle the response differently.
      console.log(`File ${filePath} downloaded successfully`);
      return response.data;
    } catch (error) {
      console.error('Error downloading file:', error.response ? error.response.data : error.message);
      return null;
    }
  }
