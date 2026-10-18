const db = require('./db');

async function fixSchema() {
    try {
        console.log('Fixing schema...');

        // Adicionar updated_at em drivers se não existir
        await db.query(`
            ALTER TABLE drivers 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('Added updated_at to drivers.');

        // Adicionar updated_at em trips se não existir
        await db.query(`
            ALTER TABLE trips 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log('Added updated_at to trips.');

        console.log('Schema fixed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error fixing schema:', err);
        process.exit(1);
    }
}

fixSchema();
