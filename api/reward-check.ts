import testData from "../src/reward-data/round-result-test.json" assert { type: "json" };
import round1Data from "../src/reward-data/round1-result.json" assert { type: "json" };
import round2Data from "../src/reward-data/round2-result.json" assert { type: "json" };
import type { VercelRequest, VercelResponse } from "@vercel/node";

const testList = Object.entries(testData.claims);
const round1List = Object.entries(round1Data.claims);
const round2List = Object.entries(round2Data.claims);

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method === "POST") {
    const account = request.body.account?.toLowerCase();
    const test = testList.find(([key]) => key.toLowerCase() === account);
    const result1 = round1List.find(([key]) => key.toLowerCase() === account);
    const result2 = round2List.find(([key]) => key.toLowerCase() === account);
    response.status(200).json({ rewards: { test, result1, result2 } });
  } else {
    response.status(405).json({ message: "Method not allowed" });
  }
}
