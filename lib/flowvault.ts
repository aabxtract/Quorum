// ──────────────────────────────────────────────────────────
// lib/flowvault.ts — FlowVault settlement logic using SDK
// ──────────────────────────────────────────────────────────

import { agentVault, toMicro } from './flowvault-agent';
import { getBackendSigner } from './stacks';

export interface FlowVaultSettlement {
  totalProceeds: number;
  followersShare: number;
  treasuryShare: number;
  reserveShare: number;
  splitTxHash: string;
  lockTxHash: string;
}

export async function settleProceeds(
  totalProceeds: number,
  tradeId: number,
): Promise<FlowVaultSettlement> {
  const signer = getBackendSigner();
  const TREASURY_WALLET = process.env.TREASURY_WALLET || signer.address;
  
  const followersShare = totalProceeds * 0.7;
  const treasuryShare = totalProceeds * 0.2;
  const reserveShare = totalProceeds * 0.1;

  const currentBlock = await agentVault.getCurrentBlockHeight(signer.address);

  try {
    // 1. Set routing rules for Split & Lock
    await agentVault.setRoutingRules({
      lockAmount: toMicro(reserveShare),
      lockUntilBlock: currentBlock + 2000,
      splitAddress: TREASURY_WALLET,
      splitAmount: toMicro(treasuryShare),
    });

    // 2. Deposit proceeds — FlowVault auto-routes per rules
    const depositTx = await agentVault.deposit(toMicro(totalProceeds));

    // 3. Clear routing rules so next trades aren't affected
    await agentVault.clearRoutingRules();

    return {
      totalProceeds,
      followersShare,
      treasuryShare,
      reserveShare,
      splitTxHash: depositTx.txId,
      lockTxHash: depositTx.txId,
    };
  } catch (err) {
    // Always attempt to clear routing rules on failure
    try {
      await agentVault.clearRoutingRules();
    } catch {
      // swallow — the original error is more important
    }
    throw err;
  }
}
