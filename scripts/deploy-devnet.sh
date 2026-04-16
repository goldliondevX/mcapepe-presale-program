#!/bin/bash

# Deploy script for devnet
# This script builds and deploys all Anchor programs to Solana devnet

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying to Solana Devnet${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error: solana CLI is not installed${NC}"
    echo "Please install it from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Check if anchor is installed
if ! command -v anchor &> /dev/null; then
    echo -e "${RED}Error: anchor CLI is not installed${NC}"
    echo "Please install it from: https://www.anchor-lang.com/docs/installation"
    exit 1
fi

# Set cluster to devnet
echo -e "${YELLOW}Setting Solana cluster to devnet...${NC}"
solana config set --url devnet

# Verify RPC URL
RPC_URL=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo -e "RPC URL: ${GREEN}$RPC_URL${NC}"

if [[ ! "$RPC_URL" == *"devnet"* ]]; then
    echo -e "${RED}Warning: RPC URL doesn't appear to be devnet!${NC}"
    echo "Current RPC URL: $RPC_URL"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check wallet balance
echo -e "${YELLOW}Checking wallet balance...${NC}"
BALANCE_RAW=$(solana balance --lamports)
BALANCE=$(echo "$BALANCE_RAW" | tr -cd '0-9')
echo "Current balance: $BALANCE_RAW"

# Check if wallet has enough SOL (at least 5 SOL for deployment)
MIN_BALANCE=5000000000  # 5 SOL in lamports
if [ "${BALANCE:-0}" -lt "$MIN_BALANCE" ] 2>/dev/null; then
    echo -e "${YELLOW}Warning: Low balance. Requesting airdrop...${NC}"
    solana airdrop 2
    echo "Waiting for airdrop to confirm..."
    sleep 10
fi

# Build the programs
echo -e "${YELLOW}Building Anchor programs...${NC}"
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful!${NC}"

# Deploy programs using Solana CLI directly (since we've set cluster to devnet)
echo -e "${YELLOW}Deploying programs to devnet...${NC}"

# Deploy aintivirus-factory
echo -e "${YELLOW}Deploying aintivirus-factory...${NC}"
solana program deploy \
    --program-id target/deploy/aintivirus_factory-keypair.json \
    target/deploy/aintivirus_factory.so

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to deploy aintivirus-factory${NC}"
    exit 1
fi
echo -e "${GREEN}✓ aintivirus-factory deployed${NC}"

# Deploy aintivirus-mixer
echo -e "${YELLOW}Deploying aintivirus-mixer...${NC}"
solana program deploy \
    --program-id target/deploy/aintivirus_mixer-keypair.json \
    target/deploy/aintivirus_mixer.so

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to deploy aintivirus-mixer${NC}"
    exit 1
fi
echo -e "${GREEN}✓ aintivirus-mixer deployed${NC}"

# Deploy aintivirus-staking
echo -e "${YELLOW}Deploying aintivirus-staking...${NC}"
solana program deploy \
    --program-id target/deploy/aintivirus_staking-keypair.json \
    target/deploy/aintivirus_staking.so

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to deploy aintivirus-staking${NC}"
    exit 1
fi
echo -e "${GREEN}✓ aintivirus-staking deployed${NC}"

echo -e "${GREEN}✓ All programs deployed successfully${NC}"

# Get program IDs
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"

FACTORY_ID=$(solana address -k target/deploy/aintivirus_factory-keypair.json)
MIXER_ID=$(solana address -k target/deploy/aintivirus_mixer-keypair.json)
STAKING_ID=$(solana address -k target/deploy/aintivirus_staking-keypair.json)

echo -e "Factory Program ID: ${GREEN}$FACTORY_ID${NC}"
echo -e "Mixer Program ID:   ${GREEN}$MIXER_ID${NC}"
echo -e "Staking Program ID: ${GREEN}$STAKING_ID${NC}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All programs deployed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

