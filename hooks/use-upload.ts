import { useState, useCallback } from 'react'

interface UploadState {
  uploading: boolean
  progress: number
  error: string | null
  uploadedFile: {
    publicUrl: string
    storagePath: string
    fileName: string
  } | null
}

interface UploadOptions {
  onProgress?: (progress: number) => void
  onComplete?: (result: { publicUrl: string; storagePath: string; fileName: string }) => void
  onError?: (error: string) => void
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    uploadedFile: null,
  })

  const uploadFile = useCallback(async (file: File, options?: UploadOptions) => {
    setState({
      uploading: true,
      progress: 0,
      error: null,
      uploadedFile: null,
    })

    try {
      // Step 1: Get signed upload URL
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get upload URL')
      }

      const { uploadUrl, publicUrl, storagePath, fileName } = await response.json()

      // Step 2: Upload directly to Supabase with progress tracking
      const xhr = new XMLHttpRequest()

      return new Promise<{ publicUrl: string; storagePath: string; fileName: string }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            setState(prev => ({ ...prev, progress }))
            options?.onProgress?.(progress)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result = { publicUrl, storagePath, fileName }
            setState({
              uploading: false,
              progress: 100,
              error: null,
              uploadedFile: result,
            })
            options?.onComplete?.(result)
            resolve(result)
          } else {
            const error = `Upload failed with status ${xhr.status}`
            setState(prev => ({ ...prev, uploading: false, error }))
            options?.onError?.(error)
            reject(new Error(error))
          }
        })

        xhr.addEventListener('error', () => {
          const error = 'Upload failed due to network error'
          setState(prev => ({ ...prev, uploading: false, error }))
          options?.onError?.(error)
          reject(new Error(error))
        })

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      setState(prev => ({ ...prev, uploading: false, error: errorMessage }))
      options?.onError?.(errorMessage)
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      uploading: false,
      progress: 0,
      error: null,
      uploadedFile: null,
    })
  }, [])

  return {
    ...state,
    uploadFile,
    reset,
  }
} 