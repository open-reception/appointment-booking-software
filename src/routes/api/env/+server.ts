import { json } from "@sveltejs/kit";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

const cfg = dotenv.config();
dotenvExpand.expand(cfg);

export async function GET() {
	let envOkay = true;
	if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "development")
		envOkay = false;
	if (!process.env.DATABASE_URL?.startsWith("postgres:")) envOkay = false;

	console.warn("Environment is okay", envOkay);

	return json({
		envOkay
	});
}
