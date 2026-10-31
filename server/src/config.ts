// src/config.ts
import dotenv from "dotenv";

dotenv.config();

export const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret_task_mgmt_2024!";
export const PORT =
  process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT || 3000)
    : Number(process.env.BACKEND_PORT || process.env.SERVER_PORT || 5000);


