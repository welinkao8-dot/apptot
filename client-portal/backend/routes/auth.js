const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const bcrypt = require('bcrypt');

// 1. Verificar se telefone existe
router.post('/check-phone', async (req, res) => {
    const { phone } = req.body;
    try {
        const user = await db.query('SELECT id FROM profiles WHERE phone = $1', [phone]);
        res.json({ exists: user.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao verificar telefone' });
    }
});

// 2. Registro de Novo Cliente
router.post('/register', async (req, res) => {
    const { phone, fullName, password } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await db.query(
            'INSERT INTO profiles (phone, full_name, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [phone, fullName, passwordHash, 'client', 'active']
        );

        const token = jwt.sign(
            { id: newUser.rows[0].id, phone: newUser.rows[0].phone, role: newUser.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ user: newUser.rows[0], token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar conta' });
    }
});

// 3. Login com Senha
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await db.query('SELECT * FROM profiles WHERE phone = $1', [phone]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Senha incorreta' });

        const token = jwt.sign(
            { id: user.rows[0].id, phone: user.rows[0].phone, role: user.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ user: user.rows[0], token });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Buscar Perfil do Usuário
router.get('/profile/:id', async (req, res) => {
    try {
        const profile = await db.query(
            'SELECT p.*, d.* FROM profiles p LEFT JOIN drivers d ON p.id = d.id WHERE p.id = $1',
            [req.params.id]
        );
        if (profile.rows.length === 0) return res.status(404).json({ error: 'Perfil não encontrado' });
        res.json(profile.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// Registro de Dados do Motorista
router.post('/driver-registration', async (req, res) => {
    const { userId, vehicleType, licensePlate } = req.body;
    try {
        await db.query(
            'INSERT INTO drivers (id, vehicle_type, license_plate) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET vehicle_type = $2, license_plate = $3',
            [userId, vehicleType, licensePlate]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar dados do motorista' });
    }
});

// Login Admin (Senha Fixa para Testes)
router.post('/admin-login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@tot.ao' && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.json({ user: { email, role: 'admin' }, token });
    }
    res.status(401).json({ error: 'Credenciais inválidas' });
});

module.exports = router;
