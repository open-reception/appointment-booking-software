CREATE TABLE "challenge_throttle" (
	"id" text PRIMARY KEY NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp DEFAULT now() NOT NULL,
	"reset_at" timestamp NOT NULL
);
