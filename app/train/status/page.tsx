"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import Sidebar from "@/components/sidebar"
import TopBar from "@/components/top-bar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, ExternalLink, Wand2, Cpu, Clock } from "lucide-react"

interface TrainingJob {
  id: string
  replicate_job_id: string | null
  status: string
  input_parameters: any
  output_model_url: string | null
  created_at: string
  updated_at: string
  error_message: string | null
  logs: string | null
  user_id: string | null
}

function StatusDisplay({ job }: { job: TrainingJob }) {
  let progressValue = 0
  let statusText = "Pending"
  let StatusIcon = Clock
  let statusColor = "bg-slate-100 text-slate-800"

  switch (job.status) {
    case "PENDING_REPLICATE_SUBMISSION":
      progressValue = 5
      statusText = "Pending Submission"
      StatusIcon = Loader2
      statusColor = "bg-slate-100 text-slate-800 animate-spin"
      break
    case "SUBMITTED_TO_REPLICATE":
      progressValue = 15
      statusText = "Submitted to Replicate"
      StatusIcon = Loader2
      statusColor = "bg-blue-100 text-blue-800 animate-spin"
      break
    case "starting":
      progressValue = 25
      statusText = "Starting"
      StatusIcon = Loader2
      statusColor = "bg-blue-100 text-blue-800 animate-spin"
      break
    case "processing":
      progressValue = 60
      statusText = "Processing"
      StatusIcon = Loader2
      statusColor = "bg-blue-100 text-blue-800 animate-spin"
      break
    case "succeeded":
      progressValue = 100
      statusText = "Succeeded"
      StatusIcon = CheckCircle
      statusColor = "bg-green-100 text-green-800"
      break
    case "failed":
    case "REPLICATE_SUBMISSION_FAILED":
    case "WEBHOOK_SETUP_FAILED":
    case "INVALID_INPUT_FOR_REPLICATE":
      progressValue = 100
      statusText = "Failed"
      StatusIcon = AlertCircle
      statusColor = "bg-red-100 text-red-800"
      break
    default:
      statusText = job.status
      break
  }

  return (
    <Card className="mb-6 shadow-md transition-all hover:shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">
              Training Job:{" "}
              <span className="font-mono text-sm bg-slate-100 px-1 py-0.5 rounded">
                {job.input_parameters?.form_data?.trigger_word || job.id.substring(0, 8)}
              </span>
            </CardTitle>
            <CardDescription>Last updated: {new Date(job.updated_at).toLocaleString()}</CardDescription>
          </div>
          <Badge className={`capitalize ${statusColor}`}>
            <StatusIcon className={`inline w-4 h-4 mr-1.5 ${StatusIcon === Loader2 ? "animate-spin" : ""}`} />
            {statusText}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {job.status !== "succeeded" && job.status !== "failed" && !job.status.includes("FAILED") && (
          <div className="mb-4">
            <Progress value={progressValue} className="w-full h-2" />
            <p className="text-xs text-slate-500 mt-1 text-center">
              {job.status === "processing"
                ? "Model is training, this can take up to 30 minutes..."
                : "Job is in queue..."}
            </p>
          </div>
        )}
        {job.status === "succeeded" && job.output_model_url && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-700">Training Successful!</p>
            <p className="text-sm text-green-600">Your model is ready.</p>
            <p className="text-xs text-green-500 mt-1 font-mono break-all">Model ID: {job.output_model_url}</p>
          </div>
        )}
        {(job.status === "failed" || job.status.includes("FAILED")) && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="font-semibold text-red-700">Training Failed</p>
            {job.error_message && <p className="text-sm text-red-600 mt-1 font-mono">Error: {job.error_message}</p>}
          </div>
        )}
        <div className="mt-4 text-xs text-slate-500 space-y-1">
          <p>
            <strong>Original File:</strong> {job.input_parameters?.original_filename || "N/A"}
          </p>
          {job.replicate_job_id && (
            <p className="flex items-center">
              <strong>Replicate Job:</strong>
              <a
                href={`https://replicate.com/p/${job.replicate_job_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono ml-1 text-blue-600 hover:underline flex items-center"
              >
                {job.replicate_job_id} <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </p>
          )}
        </div>
        {job.logs && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-slate-600 hover:text-slate-800">View Logs</summary>
            <pre className="mt-1 p-2 bg-slate-900 text-slate-200 rounded-md max-h-40 overflow-auto whitespace-pre-wrap break-all">
              {job.logs}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function TrainingStatusPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const highlightedJobId = searchParams.get("jobId")

  const [jobs, setJobs] = useState<TrainingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error: dbError } = await supabase
        .from("training_jobs")
        .select("*")
        .order("created_at", { ascending: false })

      if (dbError) {
        setError(dbError.message)
      } else {
        setJobs((data as TrainingJob[]) || [])
      }
      setLoading(false)
    }

    fetchJobs()

    const channel = supabase
      .channel("training_jobs_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "training_jobs" }, (payload) => {
        console.log("Realtime update received:", payload)
        // Refetch all jobs to ensure list is up to date
        fetchJobs()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        <p className="ml-2 text-slate-500">Loading training jobs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-6">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Error loading training jobs: {error}</p>
      </div>
    )
  }

  const highlightedJob = jobs.find((job) => job.id === highlightedJobId)
  const otherJobs = jobs.filter((job) => job.id !== highlightedJobId)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Training Status</h1>
        <Button asChild variant="outline">
          <Link href="/train">
            <Wand2 className="mr-2 h-4 w-4" /> Train New Model
          </Link>
        </Button>
      </div>

      {highlightedJob && <StatusDisplay job={highlightedJob} />}

      {otherJobs.length > 0 && (
        <>
          {highlightedJob && <h2 className="text-xl font-semibold text-slate-700 mt-8 mb-4">Previous Jobs</h2>}
          <div className="space-y-6">
            {otherJobs.map((job) => (
              <StatusDisplay key={job.id} job={job} />
            ))}
          </div>
        </>
      )}

      {!highlightedJob && jobs.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Cpu className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Training Jobs Yet</h3>
            <p className="text-slate-500 mb-6">Start training your first custom AI model.</p>
            <Button asChild>
              <Link href="/train">
                <Wand2 className="mr-2 h-4 w-4" /> Train a Model
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="mt-8 text-center">
        <Link href="/models" className="text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="inline w-4 h-4 mr-1" /> Back to All Models
        </Link>
      </div>
    </div>
  )
}

export default function TrainingStatusPageContainer() {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white rounded-tl-xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
              </div>
            }
          >
            <TrainingStatusPageContent />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
