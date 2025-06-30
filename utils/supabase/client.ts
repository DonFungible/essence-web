import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 2, // Limit events to reduce connection issues
        },
        // Add heartbeat to keep connection alive
        heartbeatIntervalMs: 30000,
        // Retry configuration
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
      },
      // If you want to disable realtime entirely, uncomment this:
      // realtime: {
      //   disabled: true
      // }
    }
  )
}
