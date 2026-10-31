// src/config.ts
import dotenv from "dotenv";

dotenv.config();

export const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret_task_mgmt_2024!";
export const PORT = Number(process.env.BACKEND_PORT || process.env.SERVER_PORT) || 5000;
