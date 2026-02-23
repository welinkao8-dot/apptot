const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// VERIFICAR SE TELEFONE EXISTE
router.post('/check-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        const result = await db.query('SELECT id FROM drivers WHERE phone = $1', [phone]);
        res.json({ exists: result.rows.length > 0 });
    } catch (err) {
        console.error('ERRO CHECK-PHONE:', err);
        res.status(500).json({ error: 'Erro ao verificar telefone' });
    }
});

// LOGIN DE MOTORISTA
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const result = await db.query('SELECT * FROM drivers WHERE phone = $1', [phone]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const driver = result.rows[0];
        const validPassword = await bcrypt.compare(password, driver.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ id: driver.id, role: 'driver' }, process.env.JWT_SECRET || 'tot_secret_2026');

        // Remove senha antes de enviar
        delete driver.password;

        res.json({ driver, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro no login.' });
    }
});

// PASSO 1: REGISTRO INICIAL (DADOS PESSOAIS)
router.post('/register', async (req, res) => {
    try {
        const { full_name, phone, email, address, password } = req.body;

        const existing = await db.query('SELECT * FROM drivers WHERE phone = $1 OR email = $2', [phone, email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Telefone ou Email já cadastrados.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO drivers 
            (full_name, phone, email, address, password, status) 
            VALUES ($1, $2, $3, $4, $5, 'pending_docs') RETURNING id, full_name, status, phone`,
            [full_name, phone, email, address, hashedPassword]
        );

        const driver = result.rows[0];
        const token = jwt.sign({ id: driver.id, role: 'driver' }, process.env.JWT_SECRET || 'tot_secret_2026');

        res.status(201).json({ driver, token });
    } catch (err) {
        console.error('ERRO REGISTER:', err);
        res.status(500).json({ error: 'Erro ao registrar motorista.' });
    }
});

// PASSO 2: UPLOAD DE DOCUMENTOS
router.post('/update-docs', async (req, res) => {
    try {
        const { driverId, bi_frente, bi_verso, carta } = req.body;

        await db.query(
            `UPDATE drivers 
            SET doc_bi_frente = $1, doc_bi_verso = $2, doc_carta_conducao = $3, status = 'pending' 
            WHERE id = $4`,
            [bi_frente, bi_verso, carta, driverId]
        );

        res.json({ success: true, message: 'Documentos enviados para análise' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao enviar documentos.' });
    }
});

module.exports = router;
