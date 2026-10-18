const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('TOT Client API is running');
});

const PORT = 3003; // Porta fixa para o backend do cliente
server.listen(PORT, () => {
    console.log(`Client API running on port ${PORT}`);
});
