CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_requests_email_unique" UNIQUE("email"),
	CONSTRAINT "access_requests_email_shape" CHECK (char_length("access_requests"."email") <= 254 and "access_requests"."email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
