import 'dotenv/config'; // Modern, clean way to load your .env variables
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json()); 

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running smoothly with ES Modules.' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});