"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { createConfig, WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { http } from "viem"
import { storyAeneid } from "viem/chains"
import { useState } from "react"

const config = createConfig({
  chains: [storyAeneid],
  multiInjectedProviderDiscovery: false,
  transports: {
    [storyAeneid.id]: http(),
  },
})

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (error && typeof error === "object" && "status" in error) {
                const status = error.status as number
                if (status >= 400 && status < 500) return false
              }
              return failureCount < 3
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  )

  // Get Privy app ID from environment variable
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // If no Privy app ID is configured, render children without Privy
  if (!privyAppId) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID not configured. Wallet functionality will be disabled.")
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
          {/* <ReactQueryDevtools initialIsOpen={false} /> */}
        </QueryClientProvider>
      </WagmiProvider>
    )
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
        // Configure supported chains
        supportedChains: [storyAeneid],
        // Appearance customization
        appearance: {
          theme: "light",
          accentColor: "#676FFF",
        },
        // Login methods
        loginMethods: ["wallet", "email", "sms"],
        // Additional configuration
        mfa: {
          noPromptOnMfaRequired: false,
        },
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
          {/* <ReactQueryDevtools initialIsOpen={false} /> */}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  )
}
