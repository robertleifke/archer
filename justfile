# ---------------------------------------------------------------------------- #
#                                   COMMANDS                                   #
# ---------------------------------------------------------------------------- #

# Default recipe
default:
    just --list

# Clean the .next directory
clean:
    bunx del-cli .next

# Deploy website to Vercel
deploy environment="production":
    na vercel pull --environment={{ environment }} --token=$VERCEL_TOKEN --yes
    na vercel build --target={{ environment }} --token=$VERCEL_TOKEN
    na vercel deploy --target={{ environment }} --prebuilt --token=$VERCEL_TOKEN
alias d := deploy

# ---------------------------------------------------------------------------- #
#                                    ESLINT                                    #
# ---------------------------------------------------------------------------- #

# Run ESLint checks
[group("checks")]
@eslint-check dir=".":
    just _run-eslint {{ dir }}
alias ec := eslint-check

# Run ESLint auto-fixes
[group("checks")]
@eslint-write dir=".":
    just _run-eslint {{ dir }} --fix
alias ew := eslint-write

# Private ESLint invocation helper
[private]
@_run-eslint dir *args:
    na eslint \
        --cache \
        --cache-location node_modules/.cache/eslint/.eslintcache \
        --concurrency auto \
        {{ args }} \
        {{ dir }}

# ---------------------------------------------------------------------------- #
#                                      APP                                     #
# ---------------------------------------------------------------------------- #

# Start the Next.js app
[group("app")]
@build:
    bunx next build

# Start the Next.js app in dev mode on a random port
[group("app")]
@dev *args:
    bunx next dev --port 0 --turbopack {{ args }}

[group("app")]
@risk-service:
    bun risk-service/server.ts

# Build and start the Next.js app
[group("app")]
start: build
    bunx next start
