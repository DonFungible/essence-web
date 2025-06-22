"use client"

import { useState } from "react"
import { Plus, Zap, ChevronDown, Mic, ArrowUp, ChevronsUpDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { models } from "@/lib/models-data" // Import the models data
import { cn } from "@/lib/utils"

const PromptBar = () => {
  const [open, setOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState(models[0].id) // Default to the first model

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
      <div className="max-w-3xl mx-auto bg-white p-3 rounded-xl shadow-2xl border border-slate-200 flex flex-col space-y-2">
        <Input
          type="text"
          placeholder="Describe your 3D object or scene..."
          className="w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-slate-400 text-sm py-3"
        />

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 rounded-full">
            <Plus className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 text-xs px-2 py-1 h-auto"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                Inspiration
                <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Surreal</DropdownMenuItem>
              <DropdownMenuItem>Abstract</DropdownMenuItem>
              <DropdownMenuItem>Minimalist</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />

          {/* Model Selector Combobox */}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                role="combobox"
                aria-expanded={open}
                className="justify-between text-slate-600 hover:bg-slate-100 px-2 text-xs py-1 h-auto w-[150px]"
              >
                <span className="truncate">{models.find((model) => model.id === selectedModel)?.name}</span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search model..." />
                <CommandList>
                  <CommandEmpty>No model found.</CommandEmpty>
                  <CommandGroup>
                    {models.map((model) => (
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={(currentValue) => {
                          setSelectedModel(currentValue === selectedModel ? "" : currentValue)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", selectedModel === model.id ? "opacity-100" : "opacity-0")}
                        />
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          <span className="text-xs text-slate-500">{model.version}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 rounded-full">
            <Mic className="w-5 h-5" />
          </Button>
          <Button size="icon" className="bg-slate-800 hover:bg-slate-700 rounded-lg w-8 h-8">
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PromptBar
