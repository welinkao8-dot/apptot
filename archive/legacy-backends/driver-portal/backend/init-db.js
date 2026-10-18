const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const sqlPath = path.join(__dirname, '../../infrastructure/database/schema.sql');
let sql = fs.readFileSync(sqlPath).toString();

// Executa o SQL sem DROP
pool.query(sql)
    .then(() => {
        console.log('Banco de dados inicializado com sucesso (Tabelas Criadas)!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Erro ao inicializar DB:', err);
        process.exit(1);
    });
