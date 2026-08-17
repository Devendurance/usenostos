import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { botTestnet, BOT_TESTNET_RPC_URL } from "@/lib/chain/bot-testnet";

export const wagmiConfig = createConfig({
  chains: [botTestnet],
  connectors: [injected()],
  transports: {
    [botTestnet.id]: http(BOT_TESTNET_RPC_URL),
  },
  ssr: true,
});