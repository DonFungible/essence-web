# Recreate attached UI

_Automatically synced with your [v0.dev](https://v0.dev) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/dons-projects-5328fdb9/v0-recreate-attached-ui)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/gKeG7Ceehnn)

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/dons-projects-5328fdb9/v0-recreate-attached-ui](https://vercel.com/dons-projects-5328fdb9/v0-recreate-attached-ui)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/gKeG7Ceehnn](https://v0.dev/chat/projects/gKeG7Ceehnn)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

# Essence Web

## Setup

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# Backend Wallet Configuration (for server-side IP registration)
BACKEND_WALLET_PK=your-backend-wallet-private-key
STORY_SPG_NFT_CONTRACT=your-spg-nft-contract-address
STORY_RPC_URL=https://aeneid.storyrpc.io

# Story Protocol Configuration (Client-side - Required for user wallet IP registration)
NEXT_PUBLIC_STORY_SPG_NFT_CONTRACT=your-spg-nft-contract-address

# Legacy Story Protocol Configuration (still supported)
# STORY_PRIVATE_KEY=your-story-protocol-private-key

# Other environment variables...
```

### Privy Setup

This application uses [Privy](https://privy.io) for wallet authentication and user management.

1. Sign up for a Privy account at [https://privy.io](https://privy.io)
2. Create a new app in the Privy dashboard
3. Copy your App ID from the dashboard
4. Set the `NEXT_PUBLIC_PRIVY_APP_ID` environment variable in your `.env.local` file

The app will work without Privy configured, but wallet functionality will be disabled. A warning will be logged to the console when `NEXT_PUBLIC_PRIVY_APP_ID` is not set.

### Story Protocol Setup

This application integrates with [Story Protocol](https://docs.story.foundation/) to register training images and models as IP assets.

1. Set up a wallet on Story Protocol testnet (Aeneid)
2. Get testnet tokens from the [Story Protocol faucet](https://faucet.story.foundation/)
3. Deploy or get access to an SPG (Story Protocol Gateway) NFT contract
4. Set the required environment variables:
   - `STORY_PRIVATE_KEY`: Your wallet's private key (keep this secure!)
   - `STORY_SPG_NFT_CONTRACT`: The address of your SPG NFT contract
   - `STORY_RPC_URL`: RPC endpoint (defaults to Story testnet)

The app will work without Story Protocol configured, but IP asset registration will be disabled.

### Supported Features

#### Wallet & Authentication

- **Wallet Connection**: Connect external wallets (MetaMask, WalletConnect, etc.)
- **Embedded Wallets**: Create wallets for users without existing wallets
- **Email/SMS Login**: Alternative authentication methods
- **Multi-factor Authentication**: Additional security layer

#### IP Asset Management

- **Flexible IP Registration**: Choose between backend wallet (fast, automatic) or user wallet (user owns IP assets)
- **Training Image IP Registration**: Each uploaded training image is registered as an IP asset on Story Protocol
- **Model IP Registration**: Trained models are registered as IP assets derived from training images
- **IP Relationship Tracking**: Full provenance tracking from training images to final models
- **Metadata Storage**: Rich metadata including training parameters, file information, and relationships

**IP Registration Methods:**

- **Backend Wallet** (Default): Fast, automatic registration using server wallet - no user gas fees required
- **User Wallet**: User owns IP assets directly, transparent MetaMask transactions, requires user gas fees

#### Balance & Access Control

- **Conditional Balance Validation**: Balance check only required when using user wallet for IP registration
- **Whitelist Support**: Specific addresses can bypass balance requirements
- **Real-time Balance Checking**: UI shows current balance and training eligibility (when using user wallet)
- **Graceful Error Handling**: Clear messaging when insufficient balance or wallet issues

**Whitelisted Addresses:**

- `0xe17aA3E4BFe9812b64354e5275A211216F1dee2a` - Can train without balance requirements

### Usage

The `WalletConnect` component is available throughout the app and provides:

- Connect wallet button when not authenticated
- User address display and disconnect button when authenticated
- Loading states and error handling

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

### Testing

```bash
# Test Story Protocol integration
pnpm test:story-protocol

# Test balance checking functionality
pnpm test:balance-check

# Test file uploads
pnpm test:upload
```
