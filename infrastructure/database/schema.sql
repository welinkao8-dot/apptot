-- TOT Database Schema (Pure PostgreSQL)
-- Removendo dependências do Supabase Auth

-- 1. Profiles (Usuários, Motoristas e Admins)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Para admins ou motoristas (se usarem senha)
    full_name TEXT,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('client', 'driver', 'admin')) DEFAULT 'client',
    status TEXT CHECK (status IN ('pending', 'active', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Drivers Details
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    vehicle_type TEXT, -- sedan, suv, moto, van
    license_plate TEXT,
    is_online BOOLEAN DEFAULT false,
    last_lat DOUBLE PRECISION,
    last_lng DOUBLE PRECISION,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_rides INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Service Configurations (Tariffs)
CREATE TABLE IF NOT EXISTS service_configs (
    id SERIAL PRIMARY KEY,
    service_type TEXT CHECK (service_type IN ('ride', 'delivery')),
    vehicle_category TEXT,
    base_fare DECIMAL(10,2) NOT NULL,
    price_per_km DECIMAL(10,2) NOT NULL,
    price_per_min DECIMAL(10,2) NOT NULL,
    platform_fee_type TEXT CHECK (platform_fee_type IN ('fixed', 'percentage')),
    platform_fee_value DECIMAL(10,2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Trips / Deliveries
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES profiles(id),
    driver_id UUID REFERENCES profiles(id),
    service_config_id INTEGER REFERENCES service_configs(id),
    status TEXT CHECK (status IN ('requested', 'accepted', 'arrived', 'ongoing', 'completed', 'cancelled')) DEFAULT 'requested',
    
    origin_address TEXT,
    origin_lat DOUBLE PRECISION,
    origin_lng DOUBLE PRECISION,
    
    dest_address TEXT,
    dest_lat DOUBLE PRECISION,
    dest_lng DOUBLE PRECISION,
    
    estimated_fare DECIMAL(10,2),
    final_fare DECIMAL(10,2),
    payment_method TEXT CHECK (payment_method IN ('cash', 'transfer')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Invoices / Receipts
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    user_id UUID REFERENCES profiles(id),
    pdf_url TEXT,
    amount DECIMAL(10,2) NOT NULL,
    invoice_type TEXT CHECK (invoice_type IN ('passenger_receipt', 'driver_earnings')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Working Hours / Shifts
CREATE TABLE IF NOT EXISTS driver_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES profiles(id),
    start_time TIME,
    end_time TIME,
    is_active BOOLEAN DEFAULT true,
    day_of_week INTEGER -- 0-6 (Sunday-Saturday)
);

-- Função para atualizar o timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_modtime ON profiles;
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_modtime ON drivers;
CREATE TRIGGER update_drivers_modtime BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
