"use client"

import { useState, useEffect } from "react"
import { Edit3, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useUpdateModelDescription, useModel } from "@/hooks/use-model-description"

interface EditableDescriptionProps {
  modelId: string
  description: string
  placeholder?: string
  className?: string
  isStaticModel?: boolean // For static models that can't be edited
  onDescriptionUpdate?: (newDescription: string) => void // Callback to notify parent of updates
}

export default function EditableDescription({
  modelId,
  description: initialDescription,
  placeholder = "Add a description for this model...",
  className = "",
  isStaticModel = false,
  onDescriptionUpdate,
}: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState(initialDescription)
  const { toast } = useToast()

  const updateDescriptionMutation = useUpdateModelDescription(modelId)

  // Fetch the latest model data (only for database models)
  const { data: modelData } = useModel(!isStaticModel ? modelId : "")

  // Determine which description to show - prefer live data over prop for database models
  const currentDescription =
    !isStaticModel && modelData?.description !== undefined
      ? modelData.description
      : initialDescription

  // Update local state when description changes (from props or live data)
  useEffect(() => {
    setEditedDescription(currentDescription || "")
  }, [currentDescription])

  const handleSave = async () => {
    if (editedDescription.trim() === currentDescription) {
      setIsEditing(false)
      return
    }

    try {
      await updateDescriptionMutation.mutateAsync({
        description: editedDescription.trim(),
      })

      setIsEditing(false)
      toast({
        title: "Description Updated",
        description: "The model description has been updated successfully.",
      })

      // Notify parent if callback provided
      if (onDescriptionUpdate) {
        onDescriptionUpdate(editedDescription.trim())
      }
    } catch (error) {
      console.error("Error updating description:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update the description. Please try again.",
        variant: "destructive",
      })
      setEditedDescription(currentDescription || "") // Reset to original
    }
  }

  const handleCancel = () => {
    setEditedDescription(currentDescription || "")
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    if (isStaticModel) return
    setIsEditing(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel()
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave()
    }
  }

  if (isEditing) {
    return (
      <div className={`space-y-3 ${className}`}>
        <Textarea
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[100px] resize-none"
          placeholder={placeholder}
          maxLength={2000}
          autoFocus
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {editedDescription.length}/2000 characters • Press Ctrl+Enter to save, Esc to cancel
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={updateDescriptionMutation.isPending}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateDescriptionMutation.isPending}>
              <Check className="w-4 h-4 mr-1" />
              {updateDescriptionMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`group relative ${className}`}>
      <div className="min-h-[24px]">
        {currentDescription ? (
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{currentDescription}</p>
        ) : (
          <p className="text-slate-400 italic">{placeholder}</p>
        )}
      </div>

      {!isStaticModel && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute -top-1 -right-1 h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm border border-slate-200"
          onClick={handleStartEdit}
        >
          <Edit3 className="w-3 h-3 mr-1" />
          Edit
        </Button>
      )}
    </div>
  )
}
