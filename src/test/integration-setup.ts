import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // Exported env (CI) is fine.
}
