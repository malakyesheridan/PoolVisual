-- Migration: Add property details to jobs table for real estate
-- This adds comprehensive property information fields

-- Add property detail columns to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS bedrooms INTEGER CHECK (bedrooms >= 0),
ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(3,1) CHECK (bathrooms > 0),
ADD COLUMN IF NOT EXISTS garage_spaces INTEGER CHECK (garage_spaces >= 0),
ADD COLUMN IF NOT EXISTS estimated_price NUMERIC(12,2) CHECK (estimated_price >= 0),
ADD COLUMN IF NOT EXISTS property_type TEXT CHECK (property_type IN ('house', 'apartment', 'townhouse', 'condo', 'land', 'commercial', 'other')),
ADD COLUMN IF NOT EXISTS land_size_m2 NUMERIC(10,2) CHECK (land_size_m2 >= 0),
ADD COLUMN IF NOT EXISTS interior_size_m2 NUMERIC(10,2) CHECK (interior_size_m2 >= 0),
ADD COLUMN IF NOT EXISTS year_built INTEGER CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM NOW()) + 1),
ADD COLUMN IF NOT EXISTS year_renovated INTEGER CHECK (year_renovated >= 1800 AND year_renovated <= EXTRACT(YEAR FROM NOW()) + 1),
ADD COLUMN IF NOT EXISTS property_status TEXT CHECK (property_status IN ('for_sale', 'sold', 'pending', 'off_market', 'rental', 'other')),
ADD COLUMN IF NOT EXISTS listing_date DATE,
ADD COLUMN IF NOT EXISTS mls_number TEXT,
ADD COLUMN IF NOT EXISTS property_description TEXT,
ADD COLUMN IF NOT EXISTS property_features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS property_condition TEXT CHECK (property_condition IN ('excellent', 'good', 'fair', 'needs_renovation', 'other')),
ADD COLUMN IF NOT EXISTS hoa_fees NUMERIC(10,2) CHECK (hoa_fees >= 0),
ADD COLUMN IF NOT EXISTS property_taxes NUMERIC(10,2) CHECK (property_taxes >= 0),
ADD COLUMN IF NOT EXISTS school_district TEXT;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_bedrooms ON jobs(bedrooms) WHERE bedrooms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_bathrooms ON jobs(bathrooms) WHERE bathrooms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_estimated_price ON jobs(estimated_price) WHERE estimated_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_property_type ON jobs(property_type) WHERE property_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_property_status ON jobs(property_status) WHERE property_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_listing_date ON jobs(listing_date) WHERE listing_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_mls_number ON jobs(mls_number) WHERE mls_number IS NOT NULL;

-- Composite index for filtering
CREATE INDEX IF NOT EXISTS idx_jobs_property_filter ON jobs(property_type, bedrooms, estimated_price) 
WHERE property_type IS NOT NULL;

-- Add comments
COMMENT ON COLUMN jobs.bedrooms IS 'Number of bedrooms';
COMMENT ON COLUMN jobs.bathrooms IS 'Number of bathrooms (can be decimal, e.g., 2.5)';
COMMENT ON COLUMN jobs.garage_spaces IS 'Number of garage spaces';
COMMENT ON COLUMN jobs.estimated_price IS 'Estimated property price';
COMMENT ON COLUMN jobs.property_type IS 'Type of property: house, apartment, townhouse, condo, land, commercial, other';
COMMENT ON COLUMN jobs.property_status IS 'Property status: for_sale, sold, pending, off_market, rental, other';

