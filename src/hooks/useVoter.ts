import { useQuery } from "@tanstack/react-query";

export function calcRound() {
  const startTime = 1719792000; // Mon Jul 01 2024 00:00:00 GMT+0000
  const currentTime = Math.floor(Date.now() / 1000);
  const interval = 60 * 60 * 24 * 7; // 1 week

  return Math.ceil((currentTime - startTime) / interval);
}

export default function useVoter(account: string | null) {
  const round = calcRound();

  return useQuery({
    queryKey: ["voter-data", round, account],
    refetchInterval: 1000 * 60 * 10,
    enabled: !!account,
    queryFn: async () => {
      return fetch(`https://graph.vet/subgraphs/name/vebetter/dao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: `{
            allocationVotes(
              where: {round: "${round}", voter: "${account}"}
            ) {
              voter {
                AllocationVotes {
                  weight
                }
              }
            }
          }`
        })
      }).then((res: any) => res.json());
    },
    select: (data: any) => {
      return {
        hasVoted: data.data.allocationVotes.length > 0
      };
    }
  });
}
