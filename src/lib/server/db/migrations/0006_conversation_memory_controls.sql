ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "memory_extraction_enabled" boolean DEFAULT true NOT NULL;
