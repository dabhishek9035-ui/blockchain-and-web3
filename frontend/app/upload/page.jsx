"use client";

import { useState } from 'react';
import { parseUnits } from 'ethers';
import { postJson } from '../../lib/api.js';
import { getContractAddresses, getEscrowContract, getSigner, getTokenContract, toBytes32Hash } from '../../lib/contracts.js';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';

export default function UploadPage() {
  const [text, setText] = useState('Congrats! You won Rs 50 cashback voucher code ABC123 expiring tomorrow.');
  const [result, setResult] = useState(null);
  const [listingPrice, setListingPrice] = useState('');
  const [chainResult, setChainResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addresses] = useState(getContractAddresses());
  const canUseChain = Boolean(addresses.escrow && addresses.token);

  // Calculate suggested price (50% of value) and escrow (10% of value)
  const suggestedPrice = result?.value ? (result.value * 0.5).toFixed(1) : '';
  const escrowAmount = result?.value ? (result.value * 0.1).toFixed(1) : '';

  function getListingIdFromReceipt(receipt, escrowContract) {
    for (const log of receipt.logs || []) {
      try {
        const parsed = escrowContract.interface.parseLog(log);
        if (parsed?.name === 'ListingCreated') {
          return parsed.args.listingId.toString();
        }
      } catch {
        // Ignore logs emitted by other contracts in the same transaction.
      }
    }

    return '';
  }

  async function handleParse() {
    try {
      setLoading(true);
      setError('');
      setStatus('');
      setResult(null);
      setChainResult(null);
      const parsed = await postJson('/api/parse-voucher', { text });
      setResult(parsed);
      // Auto-fill listing price with 50% of voucher value
      setListingPrice(parsed.value ? (parsed.value * 0.5).toFixed(1) : '');
    } catch (err) {
      setError(err.message || 'Parsing failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadToChain() {
    try {
      if (!result) {
        throw new Error('Extract voucher details before uploading');
      }

      if (!result.code || !result.expiry) {
        throw new Error('Voucher code and expiry are required before listing');
      }

      const price = Number(listingPrice);
      const sellerEscrow = Number(escrowAmount);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Enter a listing price greater than 0');
      }

      if (!Number.isFinite(sellerEscrow) || sellerEscrow <= 0) {
        throw new Error('Invalid seller escrow amount');
      }

      setUploading(true);
      setError('');
      setStatus('Connecting wallet...');
      setChainResult(null);

      const signer = await getSigner();
      const walletAddress = await signer.getAddress();

      setStatus('Saving voucher metadata...');
      const saved = await postJson('/api/vouchers', {
        walletAddress,
        text,
        provider: result.provider,
        value: result.value,
        expiry: result.expiry
      });
      const voucher = saved.voucher;
      if (saved.alreadyExists && voucher.status === 'listed') {
        throw new Error('This voucher is already listed on-chain');
      }

      const expiryTimestamp = Math.floor(new Date(voucher.expiry).getTime() / 1000);
      if (!Number.isFinite(expiryTimestamp)) {
        throw new Error('Voucher expiry could not be converted to a blockchain timestamp');
      }

      const tokenContract = await getTokenContract();
      const escrowContract = await getEscrowContract();
      const escrowValue = parseUnits(String(sellerEscrow), 18);

      setStatus('Approving seller escrow amount...');
      const approveTx = await tokenContract.approve(addresses.escrow, escrowValue);
      await approveTx.wait();

      setStatus('Uploading listing to Sepolia...');
      const listingTx = await escrowContract.createListing(
        toBytes32Hash(voucher.codeHash),
        parseUnits(String(price), 18),
        escrowValue,
        expiryTimestamp
      );
      const receipt = await listingTx.wait();
      const listingId = getListingIdFromReceipt(receipt, escrowContract);
      let recordedVoucher = voucher;

      if (listingId) {
        const recorded = await postJson(`/api/vouchers/${voucher.id}/chain-listing`, {
          listingId,
          walletAddress,
          priceXirec: Number(price),
          escrowAmount: Number(sellerEscrow)
        });
        recordedVoucher = recorded.voucher || voucher;
      }

      setChainResult({
        listingId: recordedVoucher.listingId || listingId,
        txHash: receipt.hash || listingTx.hash,
        alreadyExists: Boolean(saved.alreadyExists)
      });
      setStatus(listingId ? `Listing #${listingId} uploaded to blockchain.` : 'Listing uploaded to blockchain.');
    } catch (err) {
      setError(err.message || 'Failed to upload listing to blockchain');
      setStatus('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white">Voucher Parser</h1>
        <p className="mt-2 text-slate-400 text-lg">Extract structured data from SMS or email voucher messages.</p>
      </div>

      {(error || status) && (
        <div className={`mb-8 p-4 rounded-2xl border ${error ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>
          <p className="text-sm font-medium">{error || status}</p>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Input Message</h2>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Paste the raw text of the voucher message below. Our parser will extract the provider, value, code, and expiry date.
          </p>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste voucher message here..."
            className="flex-grow min-h-[250px] w-full rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none"
          />

          <Button
            onClick={handleParse}
            loading={loading}
            className="mt-6 w-full"
          >
            Extract Voucher Details
          </Button>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Parsing Result</h2>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Provider</p>
                    <p className="text-lg font-bold text-cyan-400">{result.provider}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Value</p>
                    <p className="text-lg font-bold text-white">Rs {result.value}</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Extracted Code</p>
                  <p className="text-lg font-mono text-white">{result.code}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Expiry</p>
                  <p className="text-sm text-slate-300">{result.expiry}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
                    <p className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-2">Suggested Price (50%)</p>
                    <p className="text-2xl font-bold text-cyan-300">{suggestedPrice} XIREC</p>
                    <p className="mt-1 text-xs text-cyan-300/70">of Rs {result.value}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">Seller Escrow (10%)</p>
                    <p className="text-2xl font-bold text-emerald-300">{escrowAmount} XIREC</p>
                    <p className="mt-1 text-xs text-emerald-300/70">of Rs {result.value}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Listing Price (XIREC)"
                    value={listingPrice}
                    onChange={(event) => setListingPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder={suggestedPrice}
                  />
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Seller Escrow (XIREC)</label>
                    <div className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-slate-300 cursor-not-allowed opacity-60">
                      {escrowAmount} XIREC
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Fixed at 10% of voucher value (non-editable)</p>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleUploadToChain}
                  loading={uploading}
                  disabled={!canUseChain}
                >
                  Upload to Blockchain
                </Button>

                {!canUseChain && (
                  <p className="text-xs text-rose-400">
                    Configure NEXT_PUBLIC_XIREC_TOKEN_ADDRESS and NEXT_PUBLIC_VOUCHER_ESCROW_ADDRESS to enable blockchain uploads.
                  </p>
                )}

                {chainResult && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                    <p className="font-semibold">
                      {chainResult.listingId ? `On-chain listing #${chainResult.listingId}` : 'On-chain listing created'}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-emerald-200/80">{chainResult.txHash}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="text-4xl mb-4 opacity-20">Search</div>
                <p className="text-slate-500">Extract detail to see the result here.</p>
              </div>
            )}
          </Card>

          <Card variant="ghost" className="bg-cyan-500/5 border-cyan-500/10">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-4">How it works</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex gap-3">
                <span className="text-cyan-500 font-bold">01</span>
                <span>Parse the voucher text and verify that a code and expiry were found.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-500 font-bold">02</span>
                <span>Save only voucher metadata and a code hash off-chain.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-500 font-bold">03</span>
                <span>Approve seller escrow tokens and create the listing in the escrow contract.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
