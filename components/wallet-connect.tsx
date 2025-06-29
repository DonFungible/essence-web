"use client"

import { usePrivy } from "@privy-io/react-auth"
import { Button } from "@/components/ui/button"
import { Wallet, LogOut, LogIn, Copy, Check, ChevronDown, User } from "lucide-react"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (user?.wallet?.address) {
      try {
        await navigator.clipboard.writeText(user.wallet.address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error("Failed to copy address:", err)
      }
    }
  }

  // Don't render anything until Privy is ready
  if (!ready) {
    return (
      <Button variant="outline" disabled>
        <Wallet className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    )
  }

  // If user is authenticated, show wallet address dropdown
  if (authenticated && user) {
    const displayAddress = user.wallet?.address
      ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
      : user.email?.address || "Connected"

    const fullAddress = user.wallet?.address || user.email?.address || ""

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center space-x-2">
            <Wallet className="h-4 w-4" />
            <span>{displayAddress}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">Connected Account</p>
            <p className="text-xs text-muted-foreground truncate">{fullAddress}</p>
          </div>
          <DropdownMenuSeparator />
          {user.wallet?.address && (
            <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Copy Address</span>
                </>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // If not authenticated, show connect button
  return (
    <Button onClick={login}>
      <LogIn className="h-4 w-4 mr-2" />
      Login
    </Button>
  )
}
