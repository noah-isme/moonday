ALTER TABLE "character_profiles" ADD COLUMN "traits" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "character_profiles" ADD COLUMN "example_dialogues" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "character_profiles" ADD COLUMN "temperature" real DEFAULT 0.7 NOT NULL;
ALTER TABLE "character_profiles" DROP COLUMN IF EXISTS "humor_level";
ALTER TABLE "character_profiles" DROP COLUMN IF EXISTS "sarcasm_level";
ALTER TABLE "character_profiles" DROP COLUMN IF EXISTS "emotional_warmth";
ALTER TABLE "character_profiles" DROP COLUMN IF EXISTS "moral_directness";
