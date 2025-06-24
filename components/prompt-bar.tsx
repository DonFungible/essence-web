"use client"

import { useState, useEffect, useMemo } from "react"
import { usePathname, useParams, useRouter } from "next/navigation"
import { useActionState } from "react"
import {
  ArrowUp,
  Check,
  ChevronsUpDown,
  Settings,
  Sparkles,
  X,
  Info,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Added Tooltip imports
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { generateImage } from "@/app/models/(details)/[modelId]/generate-image"
import { useModels } from "@/hooks/use-models"
import { useQueryClient } from "@tanstack/react-query"
import { imageGenerationKeys } from "@/hooks/use-image-generation"

interface GenerationState {
  id: string
  modelId: string
  modelName: string
  prompt: string
  status: "pending" | "completed" | "failed"
  imageUrl?: string
  error?: string
  startTime: number
}

export function PromptBar() {
  const { toast } = useToast()
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { models, isLoading: isLoadingModels } = useModels()
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [isModelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)
  const [generations, setGenerations] = useState<GenerationState[]>([])

  const [prompt, setPrompt] = useState("")
  const [isRawMode, setRawMode] = useState(false)
  const [finetuneStrength, setFinetuneStrength] = useState(1.5) // Default to 1.5
  // Removed imagePromptStrength

  const isModelPage = useMemo(
    () => pathname.startsWith("/models/") && params.modelId,
    [pathname, params.modelId]
  )
  const isHomePage = useMemo(() => pathname === "/", [pathname])
  const pageModelId = isModelPage
    ? Array.isArray(params.modelId)
      ? params.modelId[0]
      : params.modelId
    : null

  useEffect(() => {
    if (pageModelId) {
      setSelectedModelId(pageModelId)
    } else if (isHomePage && models.length > 0 && !selectedModelId) {
      console.log("Setting default model:", models[0].id)
      setSelectedModelId(models[0].id)
    }
  }, [pageModelId, models, selectedModelId, isHomePage])

  // Clean up old generations when user interacts with the form
  useEffect(() => {
    // Auto-hide old completed generations when user starts typing
    if (prompt && generations.length > 0) {
      const hasOldCompleted = generations.some(
        (g) => g.status === "completed" && Date.now() - g.startTime > 30000
      )
      if (hasOldCompleted) {
        setGenerations((prev) =>
          prev.filter((g) => g.status === "pending" || Date.now() - g.startTime <= 30000)
        )
      }
    }
  }, [prompt, generations])

  // Poll for generation status updates
  useEffect(() => {
    const pendingGenerations = generations.filter((g) => g.status === "pending")
    if (pendingGenerations.length === 0) return

    const checkGenerationStatus = async (generationId: string) => {
      try {
        const response = await fetch(`/api/generation-status?id=${generationId}`)
        if (response.ok) {
          const data = await response.json()
          return data
        }
      } catch (error) {
        console.error("Error checking generation status:", error)
      }
      return null
    }

    const pollGenerations = async () => {
      for (const generation of pendingGenerations) {
        const status = await checkGenerationStatus(generation.id)
        if (status && status.status !== "pending") {
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === generation.id
                ? {
                    ...g,
                    status: status.status,
                    imageUrl: status.imageUrl,
                    error: status.error,
                  }
                : g
            )
          )
        }
      }
    }

    // Poll every 3 seconds
    const interval = setInterval(pollGenerations, 3000)
    return () => clearInterval(interval)
  }, [generations])

  // Clean up old generations (keep last 10)
  useEffect(() => {
    if (generations.length > 10) {
      setGenerations((prev) => prev.slice(0, 10))
    }
  }, [generations])

  const [state, formAction, isPending] = useActionState(
    async (_prevState: any, formData: FormData) => {
      console.log("Form submitted. Settings values:", {
        raw_mode: formData.get("raw_mode"),
        finetune_strength: formData.get("finetune_strength"),
      })

      // Clear any existing success states when starting new generation

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

        // Add generation to tracking list
        if (result?.generationId && selectedModel) {
          const newGeneration: GenerationState = {
            id: result.generationId,
            modelId: selectedModelId,
            modelName: selectedModel.name,
            prompt: formData.get("prompt") as string,
            status: "pending",
            startTime: Date.now(),
          }
          setGenerations((prev) => [newGeneration, ...prev])

          // Trigger immediate refetch of recent generations
          queryClient.invalidateQueries({
            queryKey: imageGenerationKeys.list(selectedModelId),
          })

          // Trigger a second refetch after 2 seconds to handle race conditions
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: imageGenerationKeys.list(selectedModelId),
            })
          }, 2000)
        }

        setPrompt("")
      }
      return result
    },
    null
  )

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
    <div className="fixed bottom-0 left-0 right-0 p-6 z-50 bg-transparent pointer-events-none">
      <div className="max-w-2xl mx-auto">
        <form action={formAction} className="pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-[0_20px_25px_-5px_rgb(0,0,0,0.1),0_10px_10px_-5px_rgb(0,0,0,0.04)] border border-slate-300/60 ring-1 ring-slate-900/5 flex flex-col space-y-4 mb-2">
            <div className="flex items-start space-x-2">
              <Textarea
                name="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  isModelPage && selectedModel
                    ? `Generate with ${selectedModel.name}...`
                    : "Describe your image..."
                }
                className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-slate-400 text-sm resize-none min-h-[2.5rem] overflow-y-hidden"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "2.5rem"
                  target.style.height = target.scrollHeight + "px"
                }}
                required
              />

              <div className="flex items-center space-x-2 pl-1 my-auto h-full">
                {isHomePage && (
                  <Popover open={isModelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isModelSelectorOpen}
                        className="justify-between text-slate-600 hover:bg-slate-50 px-2 text-xs py-1 h-8 w-auto"
                        disabled={isLoadingModels}
                        onClick={() =>
                          console.log(
                            "Model selector trigger clicked. Open state:",
                            isModelSelectorOpen
                          )
                        }
                      >
                        <span className="truncate">
                          {selectedModel?.name ||
                            (isLoadingModels ? "Loading models..." : "Select a model...")}
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
                                    selectedModelId === model.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{model.name}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="flex items-center space-x-1 my-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 hover:bg-slate-100 rounded-full w-8 h-8 m-auto"
                  onClick={handleSettingsToggle}
                  aria-expanded={isSettingsExpanded}
                  aria-controls="settings-form"
                >
                  {isSettingsExpanded ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                  <span className="sr-only">
                    {isSettingsExpanded ? "Close settings" : "Open settings"}
                  </span>
                </Button>

                <Button
                  type="submit"
                  size="icon"
                  className="bg-slate-800 hover:bg-slate-700 rounded-lg w-8 h-8"
                  disabled={isPending || !selectedModelId || isLoadingModels}
                >
                  {isPending ? (
                    <X className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <input type="hidden" name="raw_mode" value={String(isRawMode)} />
            <input type="hidden" name="finetune_strength" value={String(finetuneStrength)} />
            {/* Removed image_prompt_strength hidden input */}

            {/* Generation Tracking - Only on Homepage */}
            {isHomePage && generations.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {generations.slice(0, 3).map((generation) => (
                  <button
                    key={generation.id}
                    onClick={() => router.push(`/models/${generation.modelId}`)}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer block truncate text-left w-full"
                  >
                    {generation.prompt} → {generation.modelName}
                  </button>
                ))}
              </div>
            )}

            <div
              id="settings-form"
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isSettingsExpanded
                  ? " opacity-100 pt-3 mt-2 border-t border-slate-200"
                  : "max-h-0 opacity-0 pt-0 mt-0 border-t-0"
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
                              Disables safety filters and other post-processing. Allows for more
                              creative freedom but may produce unexpected results.
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
                                How strongly the finetuned model overrides the base model
                                generation: 0 = ignore, 1 = balanced mix, 1.5 = (default), 2 =
                                finetune dominates. Raise if the style/subject isn’t showing; lower
                                if results look over-baked or repetitive.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {finetuneStrength.toFixed(2)}
                        </span>
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
