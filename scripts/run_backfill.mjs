const BASE_URL = 'https://bm-new-ag.vercel.app';

async function backfillLast10Days() {
  console.log(`====================================================`);
  console.log(`Starting 10-Day Dialpad Calls Classification Backfill`);
  console.log(`Endpoint: ${BASE_URL}/api/crm-lookup`);
  console.log(`====================================================\n`);

  let totalProcessed = 0;
  let totalCrmMatches = 0;
  let totalAiClassified = 0;
  let totalDefault = 0;
  let batchNum = 1;

  while (true) {
    console.log(`\n[Batch ${batchNum}] Requesting next batch of up to 20 calls (days=10)...`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/crm-lookup?action=batch_classify&days=10&limit=10`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`HTTP error ${response.status}:`, text);
        // Wait and retry
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }

      const data = await response.json();
      if (!data || !data.success) {
        console.error('Batch failed:', data);
        break;
      }

      const { processed, totalInWindow, alreadyClassified, remainingUnclassified, crmMatches, aiClassified, defaultFallback, results } = data;

      totalProcessed += processed;
      totalCrmMatches += crmMatches || 0;
      totalAiClassified += aiClassified || 0;
      totalDefault += defaultFallback || 0;

      console.log(`Batch ${batchNum} Result:`);
      console.log(`  - Processed in batch: ${processed}`);
      console.log(`  - CRM Matches (ca-/ct-/cy-): ${crmMatches}`);
      console.log(`  - AI Transcript Classified: ${aiClassified}`);
      console.log(`  - Default Fallback: ${defaultFallback}`);
      console.log(`  - Total in 10-Day Window: ${totalInWindow}`);
      console.log(`  - Already Classified: ${alreadyClassified}`);
      console.log(`  - Remaining Unclassified: ${remainingUnclassified}`);

      if (Array.isArray(results)) {
        for (const res of results) {
          const badge = res.classificationSource?.startsWith('crm') ? `🔗 CRM (${res.classificationSource})` :
                        res.classificationSource === 'ai_transcript' ? `🤖 AI Transcript` : `ℹ️ Default`;
          console.log(`    ${badge}: ${res.crmName || res.id} -> ${res.targetType} ${res.aiClassificationReason ? `("${res.aiClassificationReason}")` : ''}`);
        }
      }

      if (processed === 0 || remainingUnclassified === 0) {
        console.log(`\nAll calls in the last 10 days have been classified!`);
        break;
      }

      batchNum++;
      // Sleep 1.5s between batches
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      console.error('Exception during batch:', err.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  console.log(`\n====================================================`);
  console.log(`10-Day Backfill Summary:`);
  console.log(`Total calls processed: ${totalProcessed}`);
  console.log(`Total CRM Matches (ca-, ct-, cy-): ${totalCrmMatches}`);
  console.log(`Total AI Transcript Classified: ${totalAiClassified}`);
  console.log(`Total Default Heuristic: ${totalDefault}`);
  console.log(`====================================================\n`);
}

backfillLast10Days().catch(err => {
  console.error('Fatal backfill error:', err);
  process.exit(1);
});
