# Flow Transaction Latency test tool

## Installation

This project was created using `bun init` in bun v1.2.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

Please make sure you have [Bun](https://bun.sh) installed.

To install dependencies:

```bash
bun install
```

## Environment Variables

Please copy the `.env.example` file to `.env` and fill in the required environment variables.

```bash
cp .env.example .env
```

You need to set the following environment variables in the `.env` file:

```bash
# The Flow network to connect to
NETWORK=testnet

# The private key of EVM address
PRIVATE_KEY=
# The address to accept funds from the sender address, can be none that means the sender address is the recipient
RECIPIENT=

# Your Alchemy EVM endpoint URL
MAINNET_ALCHEMY_URL=
TESTNET_ALCHEMY_URL=

# Flow address and private key
MAINNET_FLOW_ADDRESS=
TESTNET_FLOW_ADDRESS=
FLOW_PRIVATE_KEY=
```

## Usage

```bash
bun start
```

The output will be generated at `outputs` directory.

## Output columns

### What is the difference between `waiting` and `completed`?

- `waiting`: The time between the batch starts and the action being started to execute and await.
- `completed`: The time between the batch starts and the action being completed.
