async function testBalanceCheck() {
  console.log("🧪 Testing Story Protocol Balance Check\n")

  try {
    // Dynamic import to handle ES modules
    const storyModule = await import("../lib/story-protocol.ts")
    const { canUserTrain, getStoryBalance, isAddressWhitelisted } = storyModule

    // Test addresses
    const whitelistedAddress = "0xe17aA3E4BFe9812b64354e5275A211216F1dee2a"
    const testAddress = "0x742d35Cc6634C0532925a3b8D4C9db96Ddb2C6e3" // Random test address

    console.log("=== Testing Whitelist Functionality ===")
    console.log(
      `Whitelisted address (${whitelistedAddress}):`,
      isAddressWhitelisted(whitelistedAddress)
    )
    console.log(`Test address (${testAddress}):`, isAddressWhitelisted(testAddress))
    console.log()

    console.log("=== Testing Balance Check ===")

    // Test whitelisted address
    console.log(`\n🔍 Checking whitelisted address: ${whitelistedAddress}`)
    try {
      const whitelistResult = await canUserTrain(whitelistedAddress)
      console.log("Result:", whitelistResult)
    } catch (error) {
      console.error("Error:", error.message)
    }

    // Test non-whitelisted address
    console.log(`\n🔍 Checking test address: ${testAddress}`)
    try {
      const testResult = await canUserTrain(testAddress)
      console.log("Result:", testResult)
    } catch (error) {
      console.error("Error:", error.message)
    }

    // Test direct balance check
    console.log(`\n🔍 Direct balance check for test address: ${testAddress}`)
    try {
      const balanceResult = await getStoryBalance(testAddress)
      console.log("Balance Result:", balanceResult)
    } catch (error) {
      console.error("Error:", error.message)
    }

    console.log("\n✅ Balance check tests completed")
  } catch (error) {
    console.error("❌ Failed to load Story Protocol module:", error.message)
    console.log("Make sure the Story Protocol environment variables are configured.")
  }
}

// Run the test
testBalanceCheck().catch(console.error)
