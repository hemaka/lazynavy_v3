CREATE TABLE "MarineCondition" (
  "id" TEXT NOT NULL,
  "latBucket" DOUBLE PRECISION NOT NULL,
  "lngBucket" DOUBLE PRECISION NOT NULL,
  "timeBucket" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3),
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "temperature" DOUBLE PRECISION,
  "pressure" DOUBLE PRECISION,
  "humidity" DOUBLE PRECISION,
  "visibility" DOUBLE PRECISION,
  "precipitation" DOUBLE PRECISION,
  "weatherCode" TEXT,
  "windSpeed" DOUBLE PRECISION,
  "windDirection" DOUBLE PRECISION,
  "windGust" DOUBLE PRECISION,
  "waveHeight" DOUBLE PRECISION,
  "waveDirection" DOUBLE PRECISION,
  "wavePeriod" DOUBLE PRECISION,
  "windWaveHeight" DOUBLE PRECISION,
  "windWaveDirection" DOUBLE PRECISION,
  "windWavePeriod" DOUBLE PRECISION,
  "swellWaveHeight" DOUBLE PRECISION,
  "swellWaveDirection" DOUBLE PRECISION,
  "swellWavePeriod" DOUBLE PRECISION,
  "seaSurfaceTemperature" DOUBLE PRECISION,
  "rawData" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarineCondition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarineCondition_latBucket_lngBucket_timeBucket_source_key"
ON "MarineCondition"("latBucket", "lngBucket", "timeBucket", "source");

CREATE INDEX "MarineCondition_latBucket_lngBucket_timeBucket_idx"
ON "MarineCondition"("latBucket", "lngBucket", "timeBucket");

CREATE INDEX "MarineCondition_timeBucket_idx"
ON "MarineCondition"("timeBucket");

CREATE INDEX "MarineCondition_source_timeBucket_idx"
ON "MarineCondition"("source", "timeBucket");
