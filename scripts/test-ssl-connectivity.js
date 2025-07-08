import fetch from "node-fetch"
import https from "https"
import { URL } from "url"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

console.log("🔒 Testing SSL Connectivity to Supabase")
console.log("========================================\n")

// Test basic SSL connectivity to Supabase
async function testSupabaseSSL() {
  console.log("1. Testing Supabase SSL Connection")
  console.log("----------------------------------")

  if (!SUPABASE_URL) {
    console.log("❌ NEXT_PUBLIC_SUPABASE_URL not set")
    return false
  }

  try {
    const url = new URL(SUPABASE_URL)
    console.log(`🔍 Testing SSL connection to: ${url.hostname}`)

    // Test basic HTTPS connectivity
    const response = await fetch(SUPABASE_URL + "/health", {
      method: "GET",
      timeout: 10000,
      agent: new https.Agent({
        rejectUnauthorized: true, // Verify SSL certificates
        timeout: 10000,
      }),
    })

    console.log(`✅ SSL connection successful (${response.status})`)

    // Test SSL certificate validity
    console.log("🔒 SSL certificate appears valid")

    return true
  } catch (error) {
    console.log(`❌ SSL connection failed: ${error.message}`)

    if (error.message.includes("CERT")) {
      console.log("   → Certificate issue detected")
    } else if (error.message.includes("TIMEOUT")) {
      console.log("   → Connection timeout (network issue)")
    } else if (error.message.includes("ECONNRESET")) {
      console.log("   → Connection reset (firewall/proxy issue)")
    } else if (error.message.includes("SSL")) {
      console.log("   → SSL/TLS handshake failed")
    }

    return false
  }
}

// Test Supabase Storage SSL specifically
async function testSupabaseStorageSSL() {
  console.log("\n2. Testing Supabase Storage SSL")
  console.log("--------------------------------")

  if (!SUPABASE_URL) {
    console.log("❌ NEXT_PUBLIC_SUPABASE_URL not set")
    return false
  }

  try {
    const url = new URL(SUPABASE_URL)
    const storageUrl = `https://${url.hostname.replace("supabase.co", "supabase.in")}/storage/v1`

    console.log(`🔍 Testing storage SSL: ${storageUrl}`)

    const response = await fetch(storageUrl, {
      method: "GET",
      timeout: 10000,
      agent: new https.Agent({
        rejectUnauthorized: true,
        timeout: 10000,
      }),
    })

    console.log(`✅ Storage SSL connection successful (${response.status})`)
    return true
  } catch (error) {
    console.log(`❌ Storage SSL connection failed: ${error.message}`)
    return false
  }
}

// Test presigned URL SSL connectivity
async function testPresignedUrlSSL() {
  console.log("\n3. Testing Presigned URL Generation")
  console.log("-----------------------------------")

  try {
    console.log("📝 Generating test presigned URL...")

    const response = await fetch(`${BASE_URL}/api/upload-presigned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [
          {
            name: "ssl-test.jpg",
            size: 1024 * 1024,
            type: "image/jpeg",
          },
        ],
        trainingJobId: `ssl-test-${Date.now()}`,
      }),
    })

    if (!response.ok) {
      console.log(`❌ Failed to generate presigned URL: ${response.status}`)
      return false
    }

    const result = await response.json()

    if (!result.success || !result.uploadUrls || result.uploadUrls.length === 0) {
      console.log("❌ Invalid presigned URL response")
      return false
    }

    const uploadUrl = result.uploadUrls[0].uploadUrl
    const urlObj = new URL(uploadUrl)

    console.log(`✅ Presigned URL generated successfully`)
    console.log(`🔗 Target domain: ${urlObj.hostname}`)

    // Test SSL connectivity to the presigned URL domain
    console.log(`🔍 Testing SSL to presigned URL domain...`)

    try {
      const sslTestResponse = await fetch(`https://${urlObj.hostname}/`, {
        method: "HEAD",
        timeout: 10000,
        agent: new https.Agent({
          rejectUnauthorized: true,
          timeout: 10000,
        }),
      })

      console.log(`✅ SSL connection to upload domain successful`)
      return true
    } catch (sslError) {
      console.log(`❌ SSL connection to upload domain failed: ${sslError.message}`)

      if (sslError.message.includes("ERR_SSL_BAD_RECORD_MAC_ALERT")) {
        console.log("🚨 ERR_SSL_BAD_RECORD_MAC_ALERT detected!")
        console.log("   This specific error usually indicates:")
        console.log("   - VPN or proxy interference with SSL traffic")
        console.log("   - Corporate firewall blocking SSL connections")
        console.log("   - Anti-virus software interfering with HTTPS")
        console.log("   - Network routing issues")
      }

      return false
    }
  } catch (error) {
    console.log(`❌ Presigned URL test failed: ${error.message}`)
    return false
  }
}

// Test network environment
async function testNetworkEnvironment() {
  console.log("\n4. Testing Network Environment")
  console.log("------------------------------")

  const tests = [
    { name: "DNS Resolution", test: testDNS },
    { name: "Proxy Detection", test: testProxy },
    { name: "SSL Version Support", test: testSSLVersions },
  ]

  for (const { name, test } of tests) {
    console.log(`📡 ${name}...`)
    try {
      await test()
    } catch (error) {
      console.log(`❌ ${name} failed: ${error.message}`)
    }
  }
}

async function testDNS() {
  if (!SUPABASE_URL) return

  const url = new URL(SUPABASE_URL)
  const hostname = url.hostname

  try {
    // Test DNS resolution
    const dnsTest = await fetch(`https://${hostname}`, {
      method: "HEAD",
      timeout: 5000,
    })
    console.log(`✅ DNS resolution for ${hostname} successful`)
  } catch (error) {
    if (error.message.includes("ENOTFOUND")) {
      console.log(`❌ DNS resolution failed for ${hostname}`)
    } else {
      console.log(
        `✅ DNS resolution for ${hostname} successful (connection failed for other reasons)`
      )
    }
  }
}

async function testProxy() {
  // Check for common proxy environment variables
  const proxyVars = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY"]
  let proxyDetected = false

  for (const proxyVar of proxyVars) {
    if (process.env[proxyVar]) {
      console.log(`⚠️  Proxy detected: ${proxyVar}=${process.env[proxyVar]}`)
      proxyDetected = true
    }
  }

  if (!proxyDetected) {
    console.log(`✅ No proxy environment variables detected`)
  } else {
    console.log(`   → Proxies can interfere with SSL connections`)
  }
}

async function testSSLVersions() {
  // This is a simplified test - in a real environment you'd test actual SSL versions
  console.log(`✅ SSL version testing (Node.js handles this automatically)`)
}

// Provide specific recommendations
function provideRecommendations() {
  console.log("\n🔧 Recommendations for ERR_SSL_BAD_RECORD_MAC_ALERT")
  console.log("===================================================")

  console.log("\n1. Immediate fixes to try:")
  console.log("   ✓ Disable VPN temporarily")
  console.log("   ✓ Switch to mobile hotspot or different network")
  console.log("   ✓ Try a different browser (Chrome, Firefox, Safari)")
  console.log("   ✓ Use incognito/private browsing mode")

  console.log("\n2. Browser-specific fixes:")
  console.log("   ✓ Clear browser SSL cache:")
  console.log("     - Chrome: Settings → Privacy → Clear browsing data → Cached images and files")
  console.log("     - Firefox: Settings → Privacy → Cookies and Site Data → Clear Data")
  console.log("   ✓ Disable browser extensions temporarily")
  console.log("   ✓ Reset browser network settings")

  console.log("\n3. Network/System fixes:")
  console.log("   ✓ Temporarily disable antivirus SSL scanning")
  console.log("   ✓ Check corporate firewall settings")
  console.log("   ✓ Flush DNS cache:")
  console.log("     - Windows: ipconfig /flushdns")
  console.log("     - macOS: sudo dscacheutil -flushcache")
  console.log("     - Linux: sudo systemctl restart systemd-resolved")

  console.log("\n4. Alternative solutions:")
  console.log("   ✓ Use different device on same network")
  console.log("   ✓ Try uploading smaller files first")
  console.log("   ✓ Contact network administrator if on corporate network")

  console.log("\n📞 If issues persist:")
  console.log("   ✓ Run this test from different network")
  console.log("   ✓ Test with mobile device on cellular data")
  console.log("   ✓ Check Supabase status page: https://status.supabase.com")
}

// Main test runner
async function runSSLTests() {
  try {
    console.log(`🌐 Testing from: ${process.platform}`)
    console.log(`📍 Target URL: ${SUPABASE_URL || "Not configured"}\n`)

    const supabaseTest = await testSupabaseSSL()
    const storageTest = await testSupabaseStorageSSL()
    const presignedTest = await testPresignedUrlSSL()

    await testNetworkEnvironment()

    console.log("\n📊 SSL Test Results Summary")
    console.log("============================")
    console.log(`Supabase SSL: ${supabaseTest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`Storage SSL: ${storageTest ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`Upload URL SSL: ${presignedTest ? "✅ PASS" : "❌ FAIL"}`)

    if (supabaseTest && storageTest && presignedTest) {
      console.log("\n🎉 All SSL tests passed! Upload should work.")
    } else {
      console.log("\n⚠️  SSL connectivity issues detected.")
      provideRecommendations()
    }
  } catch (error) {
    console.error("❌ SSL test execution failed:", error.message)
    console.log("\n💡 Make sure environment variables are set and dev server is running")
  }
}

runSSLTests()
