import round1Data from "../src/reward-data/round1-result.json" assert { type: "json" };
import round2Data from "../src/reward-data/round2-result.json" assert { type: "json" };
import type { VercelRequest, VercelResponse } from "@vercel/node";

const round1List = Object.entries(round1Data.claims);
const round2List = Object.entries(round2Data.claims);

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method === "POST") {
    const { account } = request.body;
    const result1 = round1List.find(([key]) => key === account) || [undefined, undefined];
    const result2 = round2List.find(([key]) => key === account) || [undefined, undefined];
    response.status(200).json({ rewards: [result1[1], result2[1]] });
  } else {
    response.status(405).json({ message: "Method not allowed" });
  }
}
