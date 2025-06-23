"use client"

import { useState, useEffect, useMemo } from "react"
import { usePathname, useParams } from "next/navigation"
import { useActionState } from "react"
import { ArrowUp, Check, ChevronsUpDown, Settings, Sparkles, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Added Tooltip imports
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { generateImage } from "@/app/models/(details)/[modelId]/generate-image"
import { useModels } from "@/hooks/use-models"

export function PromptBar() {
  const { toast } = useToast()
  const pathname = usePathname()
  const params = useParams()

  const { models, isLoading: isLoadingModels } = useModels()
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [isModelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)

  const [prompt, setPrompt] = useState("")
  const [isRawMode, setRawMode] = useState(false)
  const [finetuneStrength, setFinetuneStrength] = useState(1.5) // Default to 1.5
  // Removed imagePromptStrength

  const isModelPage = useMemo(() => pathname.startsWith("/models/") && params.modelId, [pathname, params.modelId])
  const isHomePage = useMemo(() => pathname === "/", [pathname])
  const pageModelId = isModelPage ? (Array.isArray(params.modelId) ? params.modelId[0] : params.modelId) : null

  useEffect(() => {
    if (pageModelId) {
      setSelectedModelId(pageModelId)
    } else if (isHomePage && models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id)
    }
  }, [pageModelId, models, selectedModelId, isHomePage])

  const [state, formAction, isPending] = useActionState(async (_prevState, formData: FormData) => {
    console.log("Form submitted. Settings values:", {
      raw_mode: formData.get("raw_mode"),
      finetune_strength: formData.get("finetune_strength"),
    })
    if (!selectedModelId) {
      toast({
        title: "Model Not Selected",
        description: "Please select a model before generating.",
        variant: "destructive",
      })
      return { error: "Model not selected" }
    }
    formData.set("model_id", selectedModelId)

    const result = await generateImage(formData)
    if (result?.error) {
      toast({
        title: "Generation Failed",
        description: result.error,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Generation Started",
        description: "Your image is being created and will appear in the gallery shortly.",
      })
      setPrompt("")
    }
    return result
  }, null)

  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId)
  }, [models, selectedModelId])

  if (!isHomePage && !isModelPage) {
    return null
  }

  const handleSettingsToggle = () => {
    console.log("Settings icon clicked. Previous expanded state:", isSettingsExpanded)
    setIsSettingsExpanded(!isSettingsExpanded)
    console.log("New expanded state:", !isSettingsExpanded)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-transparent pointer-events-none">
      <div className="max-w-4xl mx-auto">
        <form action={formAction} className="pointer-events-auto">
          <div className="bg-white p-3 rounded-xl shadow-2xl border border-slate-200 flex flex-col space-y-2">
            <div className="flex items-center">
              <Sparkles className="w-5 h-5 text-slate-400 mx-2" />
              <Input
                name="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  isModelPage && selectedModel ? `Generate with ${selectedModel.name}...` : "Describe your image..."
                }
                className="w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-slate-400 text-sm"
                required
              />
              <Button
                type="submit"
                size="icon"
                className="bg-slate-800 hover:bg-slate-700 rounded-lg w-8 h-8"
                disabled={isPending || !prompt || !selectedModelId || isLoadingModels}
              >
                {isPending ? <X className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </Button>
            </div>

            <input type="hidden" name="raw_mode" value={String(isRawMode)} />
            <input type="hidden" name="finetune_strength" value={String(finetuneStrength)} />
            {/* Removed image_prompt_strength hidden input */}

            <div className="flex items-center space-x-2 pl-1">
              {isHomePage && (
                <Popover open={isModelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isModelSelectorOpen}
                      className="justify-between text-slate-600 hover:bg-slate-50 px-2 text-xs py-1 h-auto w-[180px]"
                      disabled={isLoadingModels}
                      onClick={() => console.log("Model selector trigger clicked. Open state:", isModelSelectorOpen)}
                    >
                      <span className="truncate">
                        {selectedModel?.name || (isLoadingModels ? "Loading models..." : "Select a model...")}
                      </span>
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
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
                                console.log("Model selected:", currentValue)
                                setSelectedModelId(currentValue)
                                setModelSelectorOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedModelId === model.id ? "opacity-100" : "opacity-0",
                                )}
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
              )}
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:bg-slate-100 rounded-full"
                onClick={handleSettingsToggle}
                aria-expanded={isSettingsExpanded}
                aria-controls="settings-form"
              >
                {isSettingsExpanded ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                <span className="sr-only">{isSettingsExpanded ? "Close settings" : "Open settings"}</span>
              </Button>
            </div>

            <div
              id="settings-form"
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isSettingsExpanded
                  ? "max-h-[500px] opacity-100 pt-3 mt-2 border-t border-slate-200"
                  : "max-h-0 opacity-0 pt-0 mt-0 border-t-0",
              )}
            >
              {isSettingsExpanded && (
                <div className="grid gap-6 py-2 px-1">
                  {" "}
                  {/* Increased gap for better spacing */}
                  <TooltipProvider delayDuration={100}>
                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-1.5">
                        <Label htmlFor="raw-mode" className="text-sm">
                          Raw Mode
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p>
                              Disables safety filters and other post-processing. Allows for more creative freedom but
                              may produce unexpected results.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Switch
                        id="raw-mode"
                        checked={isRawMode}
                        onCheckedChange={(checked) => {
                          console.log("Raw mode changed:", checked)
                          setRawMode(checked)
                        }}
                      />
                    </div>
                    <span className="text-xs font-normal leading-snug text-muted-foreground -mt-5 pl-px">
                      {" "}
                      {/* Adjusted margin for description */}
                      Disables safety filters for more creative freedom.
                    </span>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={100}>
                    <div className="grid gap-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-1.5">
                          <Label htmlFor="finetune-strength" className="text-sm">
                            Finetune Strength
                          </Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p>
                                How strongly the finetuned model overrides the base model generation: 0 = ignore, 1 =
                                balanced mix, 1.5 = (default), 2 = finetune dominates. Raise if the style/subject isn’t
                                showing; lower if results look over-baked or repetitive.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-xs text-muted-foreground">{finetuneStrength.toFixed(2)}</span>
                      </div>
                      <Slider
                        id="finetune-strength"
                        value={[finetuneStrength]}
                        onValueChange={(v) => {
                          console.log("Finetune strength changed:", v[0])
                          setFinetuneStrength(v[0])
                        }}
                        min={0}
                        max={2}
                        step={0.01} // Finer step for 0-2 range
                      />
                    </div>
                  </TooltipProvider>
                  {/* Removed Image Prompt Strength Slider */}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PromptBar
