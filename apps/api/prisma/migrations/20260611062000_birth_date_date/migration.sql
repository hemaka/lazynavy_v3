ALTER TABLE "User"
  ALTER COLUMN "birthDate" TYPE DATE
  USING CASE
    WHEN "birthDate" IS NULL THEN NULL
    WHEN "birthDate"::text = '0000-00-00' THEN DATE '1900-01-01'
    ELSE "birthDate"::date
  END;
