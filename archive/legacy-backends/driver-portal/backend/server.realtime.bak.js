const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentado para suportar base64 de docs

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('TOT Driver API is running');
});

const PORT = 3004; // Porta fixa para o backend do motorista
server.listen(PORT, () => {
    console.log(`Driver API running on port ${PORT}`);
});
