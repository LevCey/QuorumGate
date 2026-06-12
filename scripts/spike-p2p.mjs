#!/usr/bin/env node
/*
 * QuorumGate — P2P delegated-inference spike (tasks W1.4).
 *
 * Measures the four-eyes transport path: a provider device serves inference over
 * Hyperswarm, a consumer device delegates completions to it and measures round-trip
 * latency and reliability. Run the two roles on two devices (or two terminals for a
 * single-machine smoke test):
 *
 *   # Device B (provider) — keeps running until Ctrl+C:
 *   node scripts/spike-p2p.mjs provider
 *
 *   # Device A (consumer) — N delegated round-trips against B's printed key:
 *   node scripts/spike-p2p.mjs consumer <provider-public-key> [model-path] [rounds]
 *
 * The model path is resolved on the provider side; pass a path that exists there.
 * The first connection can take 15–45 s on a cold DHT; subsequent calls are fast —
 * which is why the demo pre-warms the connection.
 */
import { loadModel, completion, startQVACProvider, stopQVACProvider } from '@qvac/sdk';

const [, , role, arg1, arg2, arg3] = process.argv;

if (role === 'provider') {
  const res = await startQVACProvider({});
  if (!res.success) {
    console.error('provider failed to start:', res.error);
    process.exit(1);
  }
  console.log(`PROVIDER_KEY=${res.publicKey}`);
  console.log('provider running — Ctrl+C to stop');
  process.on('SIGINT', async () => {
    await stopQVACProvider().catch(() => {});
    process.exit(0);
  });
  process.stdin.resume();
} else if (role === 'consumer') {
  const providerPublicKey = arg1;
  const modelSrc =
    arg2 ?? `${process.env.HOME}/.qvac/models/2406a1f2e667e76a_llama_3.2_1b_intruct_tool_calling_v2.Q4_K.gguf`;
  const rounds = Number(arg3 ?? 5);
  if (!providerPublicKey) {
    console.error('usage: spike-p2p.mjs consumer <provider-public-key> [model-path] [rounds]');
    process.exit(1);
  }

  const t0 = Date.now();
  const modelId = await loadModel({
    modelType: 'llm',
    modelSrc,
    delegate: { providerPublicKey, timeout: 60_000, fallbackToLocal: true },
  });
  console.log(`delegated loadModel OK modelId=${String(modelId).slice(0, 40)} connectMs=${Date.now() - t0}`);

  const results = [];
  for (let i = 1; i <= rounds; i += 1) {
    const start = Date.now();
    try {
      const res = await completion({
        modelId,
        history: [{ role: 'user', content: `Round ${i}: reply with the single word READY.` }],
        stream: true,
      });
      let text = '';
      for await (const chunk of res.tokenStream) {
        text += typeof chunk === 'string' ? chunk : (chunk?.text ?? chunk?.token ?? '');
      }
      results.push({ round: i, ok: true, ms: Date.now() - start, preview: text.trim().slice(0, 30) });
    } catch (err) {
      results.push({ round: i, ok: false, ms: Date.now() - start, error: String(err).slice(0, 80) });
    }
    console.log(JSON.stringify(results[results.length - 1]));
  }

  const ok = results.filter((r) => r.ok);
  const summary = {
    rounds,
    okCount: ok.length,
    failureRate: +(1 - ok.length / rounds).toFixed(2),
    connectMs: undefined,
    medianMs: ok.length ? ok.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(ok.length / 2)] : null,
    maxMs: ok.length ? Math.max(...ok.map((r) => r.ms)) : null,
  };
  console.log('SUMMARY ' + JSON.stringify(summary));
  process.exit(ok.length === rounds ? 0 : 2);
} else {
  console.error('usage: spike-p2p.mjs <provider|consumer> ...');
  process.exit(1);
}
