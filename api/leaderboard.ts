import { sql } from "@vercel/postgres";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    const result = await sql`SELECT * FROM leaderboard ORDER BY points DESC LIMIT 100;`;
    response.status(200).json({ data: result.rows });
  } catch (error) {
    response.status(500).json({ error });
  }
}
