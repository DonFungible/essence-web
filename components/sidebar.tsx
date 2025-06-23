"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Heart, FolderPlus, Sparkles, Cpu, Palette, Paintbrush } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const Sidebar = () => {
  const pathname = usePathname()

  const navItems = [
    { href: "/", label: "Explore", icon: LayoutGrid },
    { href: "/models", label: "Models", icon: Cpu },
    { href: "/assets", label: "IP Assets", icon: Sparkles },
    { href: "/likes", label: "Likes", icon: Heart, disabled: true }, // Example for a potentially disabled/future link
  ]

  const creationItems = [
    { href: "/creations/all", label: "All Creations", icon: Palette, disabled: true },
    { href: "/creations/new-folder", label: "New Folder", icon: FolderPlus, disabled: true },
  ]

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="w-64 bg-white p-4 space-y-6 border-r border-slate-200 flex flex-col">
      <div className="flex items-center space-x-2">
        <Paintbrush className="w-8 h-8 text-slate-800" />
        <h1 className="text-xl font-bold text-slate-800">essence</h1>
      </div>

      <nav className="flex-grow space-y-1 text-[16px]">
        {navItems.map((item) => {
          const active = !item.disabled && isActive(item.href)
          if (item.href === "/") {
            // Special handling for Explore button style
            return (
              <Link href={item.href} key={item.label} passHref legacyBehavior={item.disabled}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start items-center text-[16px] py-2 px-3 h-auto",
                    active
                      ? "bg-slate-100 text-slate-900 font-medium hover:bg-slate-100"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    item.disabled && "text-slate-400 cursor-not-allowed hover:bg-transparent hover:text-slate-400",
                  )}
                  disabled={item.disabled}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 mr-2",
                      active ? "text-slate-900" : "text-slate-600",
                      item.disabled && "text-slate-400",
                    )}
                  />
                  <span>{item.label}</span>
                </Button>
              </Link>
            )
          }
          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center space-x-2 px-3 py-2 rounded-md text-[16px]",
                active
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                item.disabled && "text-slate-400 cursor-not-allowed hover:bg-transparent hover:text-slate-400",
              )}
              aria-current={active ? "page" : undefined}
              onClick={(e) => item.disabled && e.preventDefault()}
            >
              <item.icon
                className={cn(
                  "w-5 h-5",
                  active ? "text-slate-900" : "text-slate-600",
                  item.disabled && "text-slate-400",
                )}
              />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <div className="pt-4">
          <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">My Creations</h2>
          {creationItems.map((item) => {
            const active = !item.disabled && isActive(item.href)
            return (
              <Link
                key={item.label}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md",
                  active
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  item.disabled && "text-slate-400 cursor-not-allowed hover:bg-transparent hover:text-slate-400",
                )}
                aria-current={active ? "page" : undefined}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5",
                    active ? "text-slate-900" : "text-slate-500",
                    item.disabled && "text-slate-400",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export { Sidebar }
export default Sidebar
