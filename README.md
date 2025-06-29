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

# Other environment variables...
```

### Privy Setup

This application uses [Privy](https://privy.io) for wallet authentication and user management.

1. Sign up for a Privy account at [https://privy.io](https://privy.io)
2. Create a new app in the Privy dashboard
3. Copy your App ID from the dashboard
4. Set the `NEXT_PUBLIC_PRIVY_APP_ID` environment variable in your `.env.local` file

The app will work without Privy configured, but wallet functionality will be disabled. A warning will be logged to the console when `NEXT_PUBLIC_PRIVY_APP_ID` is not set.

### Supported Features

- **Wallet Connection**: Connect external wallets (MetaMask, WalletConnect, etc.)
- **Embedded Wallets**: Create wallets for users without existing wallets
- **Email/SMS Login**: Alternative authentication methods
- **Multi-factor Authentication**: Additional security layer

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
