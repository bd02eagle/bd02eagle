import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Proxy API requests to backend
app.use('/api', async (req, res) => {
  try {
    const backendUrl = `http://0.0.0.0:3000${req.originalUrl}`;
    console.log('Proxying request to:', backendUrl);

    const headers = {
      'Content-Type': 'application/json'
    };

    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined
    });

    // Check if response is OK before trying to parse JSON
    if (!response.ok) {
      console.error(`Proxy error: ${response.status} ${response.statusText}`);
      // Try to get error details from backend response
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'Failed to parse error response' };
      }
      return res.status(response.status).json({ error: 'Proxy request failed', details: errorData });
    }

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Serve specific HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/my-games.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-games.html'));
});

app.get('/workspace.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'workspace.html'));
});

app.get('/evaluation.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'evaluation.html'));
});

app.get('/review-management.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'review-management.html'));
});

// Handle SPA routing - send index.html for other routes
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on http://0.0.0.0:${PORT}`);
});