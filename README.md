# IRL Browser Starter

A starter template for building IRL Browser mini apps with Cloudflare Workers, D1, and Durable Objects.

## Features

- **User Authentication** - JWT-verified profiles from IRL Browser
- **Real-time Updates** - WebSocket broadcasting via Durable Objects
- **SQLite Database** - Cloudflare D1 with Drizzle ORM
- **Mobile-first UI** - React + Tailwind CSS

## Quick Start

```bash
pnpm install              # Install dependencies
pnpm db:migrate:dev       # Initialize local D1 database
pnpm run dev              # Start development server
```

Open `http://localhost:5173` in your browser. The IRL Browser Simulator will auto-login with a test profile.

## Project Structure

This is a pnpm workspace monorepo with three packages:
- `client/` - React frontend
- `server/` - Cloudflare Workers, D1 (SQLite), Durable Objects
- `shared/` - JWT verification utilities

## Building Your App

1. **Add tables** to `/server/src/db/schema.ts` alongside the existing `users` table
2. **Generate migrations**: `pnpm db:generate`
3. **Apply migrations**: `pnpm db:migrate:dev`
4. **Add API endpoints** in `/server/src/index.ts` with JWT verification
5. **Build UI components** in `/client/src/components/`
6. **Wire up WebSocket events** for real-time updates

Use the `/irl-browser` Claude Code command for guided scaffolding.

## Debugging with IRL Browser Simulator

**Note:** The IRL Browser Simulator is a development-only tool. Never use in production.

The simulator automatically injects the `window.irlBrowser` API in development mode:

```typescript
if (import.meta.env.DEV) {
  const simulator = await import('irl-browser-simulator')
  simulator.enableIrlBrowserSimulator()
}
```

**Features:**
- Auto-loads test profile (Paul Morphy)
- Floating debug panel
- Click "Open as X" to simulate multiple users in separate tabs
- Load profiles via URL: `?irlProfile=<id>`

## Deployment

This app deploys entirely to Cloudflare using:
- **Cloudflare Workers** for API routes
- **Cloudflare D1** for SQLite database
- **Cloudflare Durable Objects** for WebSocket broadcasting
- **Alchemy SDK** for infrastructure-as-code

> **Prerequisites:**
- Cloudflare account (free tier works!)
- Alchemy CLI installed (`brew install alchemy`)

Configure Cloudflare API token in Alchemy (see [Alchemy CLI Documentation](https://alchemy.run/docs/cli/configuration)):
```bash
alchemy configure
```

Copy `.env.example` to `.env` and update `ALCHEMY_STATE_TOKEN`. This is used to store the state of the deployment in a remote state store.

To deploy the app:
```bash
pnpm run deploy:cloudflare
```

## API Endpoints

- `POST /api/add-user` - Add or update user profile (requires JWT)
- `POST /api/add-avatar` - Add or update user avatar (requires JWT)
- `DELETE /api/remove-user` - Remove user (requires JWT)
- `GET /api/users` - Get all users (public)
- `GET /api/ws` - WebSocket connection for real-time updates

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide for Claude Code
- [IRL Browser Specification](./docs/irl-browser-specification.md) - IRL Browser API reference
