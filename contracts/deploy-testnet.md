# Deploy quorum-market.clar to Stacks Testnet

## Prerequisites

Install Clarinet (the Stacks contract toolkit):

```bash
# macOS / Linux
curl -L https://github.com/hirosystems/clarinet/releases/latest/download/clarinet-linux-x64-glibc.tar.gz | tar xz
sudo mv clarinet /usr/local/bin

# Or via Homebrew
brew install clarinet
```

## Step 1 — Generate your agent keypair (if not done yet)

```bash
npx @stacks/cli make_keychain -t
```

Copy the output. You need:
- `address`    → goes into Vercel as `STACKS_WALLET_ADDRESS`  
- `privateKey` → goes into Vercel as `STACKS_PRIVATE_KEY`

Get testnet STX from the faucet so the agent can pay tx fees:
https://explorer.hiro.so/sandbox/faucet?chain=testnet

## Step 2 — Deploy the contract

```bash
cd /path/to/quorum

# Check the contract compiles
clarinet check

# Deploy to testnet (interactive — will ask for your private key or use default keychain)
clarinet deployments apply --testnet
```

Or deploy manually with stacks-cli:

```bash
npx @stacks/cli deploy_contract \
  -t \
  -k <YOUR_PRIVATE_KEY_HEX> \
  contracts/quorum-market.clar \
  quorum-market
```

After deploying you will see output like:
```
Contract deployed: ST1XXXXX...YOUR_ADDRESS.quorum-market
Tx ID: 0xabc123...
```

## Step 3 — Set environment variables

In Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_QUORUM_CONTRACT=ST1XXXXX.quorum-market
STACKS_PRIVATE_KEY=<64-char hex key from step 1>
STACKS_WALLET_ADDRESS=<ST... address from step 1>
```

`NEXT_PUBLIC_USDCX_CONTRACT` defaults to the testnet USDCx at
`ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` — only set this if
you deploy your own USDCx token.

## Step 4 — Set the agent address on the contract

After deploying, call `set-agent` once so the contract accepts your agent wallet.
The easiest way is via Hiro Explorer → Contract → Call function:

1. Go to https://explorer.hiro.so/sandbox/contract-call?chain=testnet
2. Enter your contract: `ST1XXXXX.quorum-market`
3. Call `set-agent` with your agent wallet address as the argument
4. Sign with the deployer wallet (whoever deployed the contract)

## Step 5 — Redeploy on Vercel

```bash
vercel --prod
```

Markets created after this point will auto-register on-chain. Staking will work
through the Hiro wallet popup on the market page.
