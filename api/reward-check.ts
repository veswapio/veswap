import round1Data from "../src/reward-data/round1-result.json";
import round2Data from "../src/reward-data/round2-result.json";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method === "POST") {
    const { address } = request.body;
    const result1 = Object.entries(round1Data.claims).find(([key]) => key === address);
    const result2 = Object.entries(round2Data.claims).find(([key]) => key === address);
    response.status(200).json({ rewards: [result1?.[1], result2?.[1]] });
  } else {
    response.status(405).json({ message: "Method not allowed" });
  }
}
