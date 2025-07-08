#!/usr/bin/env node

/**
 * Manual IP Registration Retry Script
 *
 * This script helps register AI models that weren't properly registered as IP assets.
 * It can be run manually or scheduled as a cron job.
 *
 * Usage:
 *   node scripts/retry-ip-registrations.js [options]
 *
 * Options:
 *   --dry-run          Show what would be processed without actually registering
 *   --limit=N          Limit number of models to process (default: 10)
 *   --force            Retry all models, even those already registered
 *   --job-id=ID        Process only a specific job ID
 *   --max-age=N        Only process jobs completed within N days (default: 30)
 *   --help             Show help message
 *
 * Examples:
 *   node scripts/retry-ip-registrations.js --dry-run
 *   node scripts/retry-ip-registrations.js --limit=5
 *   node scripts/retry-ip-registrations.js --job-id=abc123
 */

import fetch from "node-fetch"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const DEFAULT_LIMIT = 10
const DEFAULT_MAX_AGE = 30

function showHelp() {
  console.log(`
🔄 IP Registration Retry Script

This script helps register AI models that weren't properly registered as IP assets.

Usage:
  node scripts/retry-ip-registrations.js [options]

Options:
  --dry-run          Show what would be processed without actually registering
  --limit=N          Limit number of models to process (default: ${DEFAULT_LIMIT})
  --force            Retry all models, even those already registered  
  --job-id=ID        Process only a specific job ID
  --max-age=N        Only process jobs completed within N days (default: ${DEFAULT_MAX_AGE})
  --bulk             Use bulk registration endpoint (faster for many models)
  --help             Show this help message

Examples:
  node scripts/retry-ip-registrations.js --dry-run
  node scripts/retry-ip-registrations.js --limit=5
  node scripts/retry-ip-registrations.js --job-id=abc123
  node scripts/retry-ip-registrations.js --bulk --limit=20

Environment:
  Requires NEXT_PUBLIC_SUPABASE_URL and other environment variables to be set.
  Run from the project root directory.
  `)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    dryRun: false,
    limit: DEFAULT_LIMIT,
    force: false,
    jobId: null,
    maxAge: DEFAULT_MAX_AGE,
    bulk: false,
    help: false,
  }

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true
    } else if (arg === "--force") {
      options.force = true
    } else if (arg === "--bulk") {
      options.bulk = true
    } else if (arg === "--help") {
      options.help = true
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1]) || DEFAULT_LIMIT
    } else if (arg.startsWith("--job-id=")) {
      options.jobId = arg.split("=")[1]
    } else if (arg.startsWith("--max-age=")) {
      options.maxAge = parseInt(arg.split("=")[1]) || DEFAULT_MAX_AGE
    }
  }

  return options
}

async function getBaseUrl() {
  // Try to detect the base URL
  const possibleUrls = [
    "http://localhost:3000",
    "https://your-production-domain.com", // Replace with your actual domain
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean)

  for (const url of possibleUrls) {
    try {
      const response = await fetch(`${url}/api/retry-failed-registrations`, {
        method: "GET",
      })
      if (response.ok) {
        return url
      }
    } catch (error) {
      // Continue to next URL
    }
  }

  throw new Error("Could not detect base URL. Please ensure the server is running.")
}

async function getStatus(baseUrl) {
  console.log("📊 Getting registration status...\n")

  try {
    const response = await fetch(`${baseUrl}/api/retry-failed-registrations`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Failed to get status")
    }

    console.log("📈 Registration Analysis:")
    console.log(`   Total successful jobs: ${data.total}`)
    console.log(`   Already registered: ${data.registered}`)
    console.log(`   Needs registration: ${data.unregistered}`)
    console.log(`   Registration rate: ${data.analysis.registrationRate}`)
    console.log(
      `   Has parent IPs but unregistered: ${data.analysis.hasParentIPsButNoRegistration}`
    )

    if (data.unregisteredJobs && data.unregisteredJobs.length > 0) {
      console.log("\n🔍 Recent unregistered models:")
      data.unregisteredJobs.slice(0, 5).forEach((job, i) => {
        console.log(`   ${i + 1}. ${job.trigger_word} (${job.replicate_job_id})`)
      })
      if (data.unregisteredJobs.length > 5) {
        console.log(`   ... and ${data.unregisteredJobs.length - 5} more`)
      }
    }

    return data
  } catch (error) {
    console.error("❌ Error getting status:", error.message)
    throw error
  }
}

async function runBulkRegistration(baseUrl, options) {
  console.log("🔄 Starting bulk registration...\n")

  const params = new URLSearchParams()
  params.append("limit", options.limit.toString())
  params.append("dry_run", options.dryRun.toString())
  params.append("max_age", options.maxAge.toString())

  try {
    const response = await fetch(`${baseUrl}/api/models/bulk-register-derivatives?${params}`, {
      method: "POST",
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Bulk registration failed")
    }

    if (options.dryRun) {
      console.log("🧪 Dry Run Results:")
      console.log(`   Total models found: ${data.total}`)
      console.log(`   Can register: ${data.canRegister}`)
      console.log(`   Cannot register: ${data.cannotRegister}`)

      if (data.analysis && data.analysis.length > 0) {
        console.log("\n📋 Analysis:")
        data.analysis.forEach((job, i) => {
          const status = job.canRegister ? "✅" : "❌"
          console.log(
            `   ${i + 1}. ${status} ${job.trigger_word} (${job.flow} flow, ${
              job.parentIPCount
            } parents)`
          )
        })
      }
    } else {
      console.log("✅ Bulk Registration Complete:")
      console.log(`   Processed: ${data.processed}`)
      console.log(`   Succeeded: ${data.succeeded}`)
      console.log(`   Failed: ${data.failed}`)

      if (data.results && data.results.length > 0) {
        console.log("\n📋 Results:")
        data.results.forEach((result, i) => {
          const status = result.success ? "✅" : "❌"
          const info = result.success ? result.ipId : result.error
          console.log(`   ${i + 1}. ${status} ${result.triggerWord}: ${info}`)
        })
      }
    }

    return data
  } catch (error) {
    console.error("❌ Bulk registration error:", error.message)
    throw error
  }
}

async function runRetryRegistration(baseUrl, options) {
  console.log("🔄 Starting retry registration...\n")

  const params = new URLSearchParams()
  params.append("limit", options.limit.toString())
  if (options.force) params.append("force", "true")
  if (options.jobId) params.append("job_id", options.jobId)

  try {
    const response = await fetch(`${baseUrl}/api/retry-failed-registrations?${params}`, {
      method: "POST",
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Retry registration failed")
    }

    console.log("✅ Retry Registration Complete:")
    console.log(`   Processed: ${data.processed}`)
    console.log(`   Succeeded: ${data.succeeded}`)
    console.log(`   Failed: ${data.failed}`)

    if (data.results && data.results.length > 0) {
      console.log("\n📋 Results:")
      data.results.forEach((result, i) => {
        const status = result.success ? "✅" : "❌"
        let info = ""
        if (result.success) {
          if (result.skipped) {
            info = "Already registered"
          } else {
            info = `${result.ipId} (${result.parentIPCount} parents, ${result.flow} flow)`
          }
        } else {
          info = result.error
        }
        console.log(`   ${i + 1}. ${status} ${result.triggerWord}: ${info}`)
      })
    }

    return data
  } catch (error) {
    console.error("❌ Retry registration error:", error.message)
    throw error
  }
}

async function main() {
  const options = parseArgs()

  if (options.help) {
    showHelp()
    return
  }

  console.log("🚀 IP Registration Retry Script\n")

  try {
    const baseUrl = await getBaseUrl()
    console.log(`🌐 Using base URL: ${baseUrl}\n`)

    // Always show status first
    await getStatus(baseUrl)
    console.log("\n" + "=".repeat(60) + "\n")

    if (options.dryRun) {
      console.log("🧪 Running in DRY RUN mode - no actual registrations will be performed\n")
    }

    if (options.jobId) {
      console.log(`🎯 Processing specific job: ${options.jobId}\n`)
      await runRetryRegistration(baseUrl, options)
    } else if (options.bulk) {
      await runBulkRegistration(baseUrl, options)
    } else {
      await runRetryRegistration(baseUrl, options)
    }

    console.log("\n🎉 Script completed successfully!")
  } catch (error) {
    console.error("\n💥 Script failed:", error.message)
    console.error("\nTroubleshooting:")
    console.error("1. Make sure the Next.js server is running")
    console.error("2. Check environment variables are set")
    console.error("3. Verify database connectivity")
    console.error("4. Check Story Protocol configuration")
    process.exit(1)
  }
}

// Handle CLI interruption gracefully
process.on("SIGINT", () => {
  console.log("\n\n⏹️  Script interrupted by user")
  process.exit(0)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
