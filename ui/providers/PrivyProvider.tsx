"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export function AppPrivyProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return children;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          accentColor: "#60A5FA",
          loginMessage: "Connect your wallet to unlock Archer order signing.",
          showWalletLoginFirst: true,
          walletChainType: "ethereum-only",
          walletList: ["detected_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect"],
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: true,
        },
        loginMethods: ["wallet", "email"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
