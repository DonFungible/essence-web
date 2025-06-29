"use client"

import { usePrivy } from "@privy-io/react-auth"
import { Button } from "@/components/ui/button"
import { Wallet, LogOut, LogIn } from "lucide-react"

export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy()

  // Don't render anything until Privy is ready
  if (!ready) {
    return (
      <Button variant="outline" disabled>
        <Wallet className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    )
  }

  // If user is authenticated, show disconnect button
  if (authenticated && user) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-slate-600">
          {user.wallet?.address
            ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
            : user.email?.address || "Connected"}
        </span>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </Button>
      </div>
    )
  }

  // If not authenticated, show connect button
  return (
    <Button onClick={login}>
      <LogIn className="h-4 w-4" />
      Login
    </Button>
  )
}
