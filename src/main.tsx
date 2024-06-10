import "./styles/global.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "~/query";

import PageLayout from "./components/PageLayout";
import NotMatchPage from "./components/NotMatchPage";
import LandingPage from "./pages/LandingPage";
import Swap from "./pages/Swap";
import Overview from "./pages/Overview";
import Pools from "./pages/Pools";

import { DAppKitProvider } from "@vechain/dapp-kit-react";
import type { WalletConnectOptions } from "@vechain/dapp-kit-react";

const walletConnectOptions: WalletConnectOptions = {
  // Create your project here: https://cloud.walletconnect.com/sign-up
  projectId: "41e5ccf7dd6fe46babb1a4345fe84749",
  metadata: {
    name: "VeSwap",
    description: "VeSwap",
    url: window.location.origin,
    icons: [`${window.location.origin}/favicon-black.png`]
  }
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />
  },
  {
    element: <PageLayout />,
    children: [
      {
        path: "/swap",
        element: <Swap />
      },
      {
        path: "/overview",
        element: <Overview />
      },
      {
        path: "/pools",
        element: <Pools />
      }
    ]
  },
  {
    path: "*",
    element: <NotMatchPage />
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DAppKitProvider
      nodeUrl={"https://mainnet.vechain.org/"}
      genesis={"main"}
      usePersistence={true}
      walletConnectOptions={walletConnectOptions}
      themeMode="DARK"
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </DAppKitProvider>
  </React.StrictMode>
);
