-- Tabela de Motoristas (Drivers)
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    password VARCHAR(255) NOT NULL,
    
    -- Status de Aprovação
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    
    -- Documentos (Caminhos para arquivos ou base64)
    doc_bi_frente TEXT,
    doc_bi_verso TEXT,
    doc_carta_conducao TEXT,
    
    -- Metadados
    is_online BOOLEAN DEFAULT false,
    rating DECIMAL(3,2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
