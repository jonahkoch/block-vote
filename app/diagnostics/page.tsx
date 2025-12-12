'use client';

import { useState } from 'react';
import { useWallet } from '@meshsdk/react';
import { WalletConnectTerminal } from '@/components/WalletConnectTerminal';
import {
  runDiagnostics,
  test1_SimpleTransfer,
  test2_MintOnly,
  test3_MintAndSendToWallet,
  test4_MintCIP068Tokens,
  test5_MintWithMetadata,
  test6_MintWithManualUtxos,
  test7_TwoTransactionApproach,
  test8_MintAndSendToAddress,
  test9_LucidEvolution_MintAndSend,
} from '@/lib/diagnostics';

export default function DiagnosticsPage() {
  const { connected, wallet } = useWallet();
  const [running, setRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  async function runIndividualTest(testName: string, testFn: any) {
    if (!wallet) return;

    setRunning(true);
    setCurrentTest(testName);

    try {
      await testFn(wallet);
    } catch (error) {
      console.error('Test error:', error);
    } finally {
      setRunning(false);
      setCurrentTest('');
    }
  }

  async function runAllTests() {
    if (!wallet) return;

    setRunning(true);
    setCurrentTest('Running all tests...');

    try {
      await runDiagnostics(wallet);
    } catch (error) {
      console.error('Diagnostic error:', error);
    } finally {
      setRunning(false);
      setCurrentTest('');
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Mesh SDK Diagnostics</h1>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p className="text-yellow-700">
              Please connect your wallet to run diagnostics.
            </p>
          </div>

          <WalletConnectTerminal />

          <div className="mt-6">
            <a
              href="/"
              className="text-indigo-600 hover:text-indigo-800 text-sm"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Mesh SDK Diagnostics</h1>
        <p className="text-gray-600 mb-8">
          Step-by-step complexity testing to identify where Mesh SDK fails
        </p>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Open browser console (F12) to see detailed logs</li>
            <li>• Run tests in order or run all at once</li>
            <li>• Each test builds on the previous one</li>
            <li>• Tests will NOT affect your production code</li>
          </ul>
        </div>

        {/* Run All Button */}
        <div className="mb-6">
          <button
            onClick={runAllTests}
            disabled={running}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {running ? 'Running Tests...' : 'Run All Tests'}
          </button>
          {currentTest && (
            <p className="text-center text-sm text-gray-600 mt-2">{currentTest}</p>
          )}
        </div>

        {/* Individual Tests */}
        <div className="space-y-4">
          {/* Test 1 */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 1: Simple ADA Transfer</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Baseline test - send 2 ADA to own address
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Expected: ✅ PASS (we know this works)
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 1', test1_SimpleTransfer)}
                disabled={running}
                className="ml-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 2 */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 2: Mint Token Only</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint 1 token with Plutus V3 script (no outputs)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: Plutus V3 minting in isolation
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 2', test2_MintOnly)}
                disabled={running}
                className="ml-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 3 */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 3: Mint + Send to Wallet</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint 1 token and send to own wallet address
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: Minting + sending to regular address
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 3', test3_MintAndSendToWallet)}
                disabled={running}
                className="ml-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 4 */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 4: Mint CIP-068 Dual Tokens</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint reference token (label 100) + user tokens (label 222)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: CIP-068 dual token minting pattern
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 4', test4_MintCIP068Tokens)}
                disabled={running}
                className="ml-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 5 */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 5: Mint + Metadata</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint token with minimal CIP-25 metadata
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: Adding metadata to minting transaction
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 5', test5_MintWithMetadata)}
                disabled={running}
                className="ml-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 6 */}
          <div className="bg-white rounded-lg p-4 shadow border-2 border-blue-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 6: Manual UTxO Selection ⭐</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint + Send with manually selected UTxOs (Discord suggestion)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: Pre-filtering UTxOs to avoid multi-asset selection issues
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 6', test6_MintWithManualUtxos)}
                disabled={running}
                className="ml-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm font-semibold"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 7 */}
          <div className="bg-white rounded-lg p-4 shadow border-2 border-purple-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 7: Two-Transaction Workaround 🔧</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint in Tx1, then Send in Tx2 (waits 20 seconds between)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: Whether splitting into 2 transactions works around the issue
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Takes ~30 seconds to complete (will fail validator - expected)
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 7', test7_TwoTransactionApproach)}
                disabled={running}
                className="ml-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 text-sm font-semibold"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 8 */}
          <div className="bg-white rounded-lg p-4 shadow border-2 border-green-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 8: Mint + Send to Your Address 🎯</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Mint and send token to addr_test1qq...ucnf3d (one transaction)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: Whether the issue is specific to script addresses
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Will fail validator (empty redeemer) but tests transaction building
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 8', test8_MintAndSendToAddress)}
                disabled={running}
                className="ml-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm font-semibold"
              >
                Run
              </button>
            </div>
          </div>

          {/* Test 9 */}
          <div className="bg-white rounded-lg p-4 shadow border-4 border-yellow-400">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Test 9: Lucid Evolution Mint + Send 🚀</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Same transaction but using Lucid Evolution instead of Mesh SDK
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Tests: If transaction logic is valid using alternative library
                </p>
                <p className="text-xs text-green-600 mt-1">
                  ✨ If this succeeds, the issue is confirmed to be Mesh SDK specific
                </p>
              </div>
              <button
                onClick={() => runIndividualTest('Test 9', test9_LucidEvolution_MintAndSend)}
                disabled={running}
                className="ml-4 bg-yellow-500 text-black px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-gray-400 text-sm font-bold"
              >
                Run
              </button>
            </div>
          </div>
        </div>

        {/* Console Reminder */}
        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            💡 <strong>Tip:</strong> Open your browser console to see detailed logs for each test.
            Look for error messages, transaction hashes, and pass/fail indicators.
          </p>
        </div>

        {/* Back Link */}
        <div className="mt-6">
          <a
            href="/"
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
