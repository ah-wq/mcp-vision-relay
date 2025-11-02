import { config as loadEnv } from "dotenv";

// Load environment variables before starting anything else
loadEnv({ quiet: true });

import { run } from "./server/server.js";

void run();
