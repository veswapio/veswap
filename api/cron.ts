import { sql } from "@vercel/postgres";
// import { BACKEND_URL } from "~/constants/link";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// const SWAP_PATH = "/subgraphs/name/swap/swap";

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    // const response = await fetch(`${BACKEND_URL}${SWAP_PATH}`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json"
    //   },
    //   body: JSON.stringify({
    //     query: ""
    //   })
    // });
    // const data = await response.json();

    // TODO: Generate entries based on GraphQL queried data
    const entries = [
      ["0x1234567890123456789012345678901234567890", 50, 0.12345678, 0.87654321],
      ["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", 30, 0.55555555, 0.44444444]
    ]
      .map((entry) => `('${entry[0]}', ${entry[1]}, ${entry[2]}, ${entry[3]})`)
      .join(", ");

    await sql`INSERT INTO leaderboard (address, points, lp_value, swap_value)
VALUES ${entries}
ON CONFLICT (address) DO UPDATE
  SET points = leaderboard.points + EXCLUDED.points,
      lp_value = leaderboard.lp_value + EXCLUDED.lp_value,
      swap_value = leaderboard.swap_value + EXCLUDED.swap_value;`;

    response.status(200).json({ success: true });
  } catch (error) {
    response.status(500).json({ error });
  }
}
