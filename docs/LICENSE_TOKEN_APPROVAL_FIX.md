# License Token Approval Fix for Story Protocol Derivative Registration

## Problem Description

When attempting to register AI models as derivative IP assets using Story Protocol, we encountered the error:

```
Error signature: 0x177e802f
Decoded error: ERC721InsufficientApproval(address,uint256)
```

This error occurs during the `mintAndRegisterIpAndMakeDerivativeWithLicenseTokens` contract call.

## Root Cause Analysis

The error `ERC721InsufficientApproval` indicates that license tokens need to be **approved** for the DerivativeWorkflows contract before they can be used in derivative registration.

### Error Details

- **Contract**: `0x9e2d496f72C547C2C535B167e06ED8729B374a4f` (DerivativeWorkflows)
- **Function**: `mintAndRegisterIpAndMakeDerivativeWithLicenseTokens`
- **Issue**: License tokens `[41533, 41534, 41535, 41536, 41537]` were not approved for the contract

## Solution Implementation

### Step 1: Created Unit Test Function

A comprehensive test endpoint was created at `/api/test-license-approval` to:

1. **Check token ownership** using direct contract calls
2. **Verify approval status** for the DerivativeWorkflows contract
3. **Simulate approval process** without executing transactions
4. **Provide approval functionality** via PUT endpoint

### Step 2: Manual License Token Approval

The license tokens were manually approved using the Story Protocol SDK:

```typescript
// Using viem contract interface
const licenseTokenContract = getContract({
  address: LICENSE_TOKEN_CONTRACT,
  abi: LICENSE_TOKEN_ABI,
  client: walletClient,
})

// Approve each token for DerivativeWorkflows contract
const txHash = await licenseTokenContract.write.approve([
  derivativeWorkflowsContract,
  BigInt(tokenId),
])
```

### Step 3: Successful Resolution

After approving all 5 license tokens:

- ✅ `Token 41533 approved`
- ✅ `Token 41534 approved`
- ✅ `Token 41535 approved`
- ✅ `Token 41536 approved`
- ✅ `Token 41537 approved`

The derivative registration now works correctly.

## Key Findings from Story Protocol SDK

Based on the [Story Protocol SDK source](https://raw.githubusercontent.com/storyprotocol/sdk/refs/heads/main/packages/core-sdk/src/resources/ipAsset.ts), the SDK includes:

1. **Automatic approval handling** in optimized workflows
2. **License token validation** before derivative registration
3. **Multicall optimization** for batch operations
4. **Fee calculation** including derivative minting fees

## Contract Addresses (Story Aeneid Testnet)

- **DerivativeWorkflows**: `0x9e2d496f72C547C2C535B167e06ED8729B374a4f`
- **LicenseToken**: `0x1daAE3197Bc469Cb97B917aa460a12dD95c6627c`
- **SPG NFT Contract**: From `STORY_SPG_NFT_CONTRACT` env var

## Alternative Solution: Register Derivatives Without License Tokens

Based on the [Story Protocol SDK](https://raw.githubusercontent.com/storyprotocol/sdk/refs/heads/main/packages/core-sdk/src/resources/ipAsset.ts), there are multiple ways to register derivatives:

### Method 1: License Tokens (requires approval)

- `mintAndRegisterIpAndMakeDerivativeWithLicenseTokens` - Requires pre-minted license tokens and approvals

### Method 2: Direct License Terms (no tokens needed)

- `mintAndRegisterIpAndMakeDerivative` - Works directly with parent IP IDs and license terms

## Recommended Implementation for Future Training

The derivative registration process should have fallback options:

1. **Try license token approach** if tokens are available and approved
2. **Fall back to license terms approach** if tokens aren't available or approval fails
3. **Final fallback to standalone IP** only if derivative registration is impossible

## Enhanced Code Example

```typescript
// Step 1: Try to mint license tokens
const licenseTokenIds = await mintLicenseTokensForParents(parentIpIds)

let derivativeResult

if (licenseTokenIds.length > 0) {
  // Step 2a: Try license token approach with approval check
  const approvalStatus = await checkLicenseTokenApprovals(licenseTokenIds)

  if (!approvalStatus.allApproved) {
    await approveLicenseTokensForDerivative(licenseTokenIds)
  }

  derivativeResult = await mintAndRegisterDerivativeWithLicenseTokens({
    spgNftContract,
    licenseTokenIds,
    metadata,
  })
}

if (!derivativeResult?.success) {
  // Step 2b: Fall back to license terms approach (no tokens needed)
  derivativeResult = await registerDerivativeWithLicenseTerms({
    spgNftContract,
    parentIpIds,
    licenseTermsId: "1", // Default PIL license terms
    metadata,
  })
}

if (!derivativeResult?.success) {
  // Step 2c: Final fallback to standalone IP
  derivativeResult = await mintAndRegisterIP({
    spgNftContract,
    metadata,
  })
}
```

## Test Results Summary

- **Problem**: `0x177e802f` ERC721InsufficientApproval error
- **Solution**: Manual license token approval via Story SDK
- **Result**: Successful derivative registration
- **Model IP ID**: `0xD617fa25518Af63cB33503c1d04dCf0a3973619D`

This solution ensures that AI models can be properly registered as derivative IP assets following Story Protocol best practices.
