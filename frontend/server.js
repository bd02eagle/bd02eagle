
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the main evaluation workspace
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the detailed evaluation page
app.get('/evaluation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'evaluation.html'));
});

// Serve the review management page
app.get('/review-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'review-management.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on http://0.0.0.0:${PORT}`);
});
