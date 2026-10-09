import zlib from 'zlib';

const DEFAULT_PAUL_SETH_WEBHOOK_URL = 'https://defaulta890f079ca4640baac4ba3a4d81623.34.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/27/workflows/f0d1b076e35e45bf9296370258ff9199/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=UPaKYFNMAiGNMw1ytPulMBZj5hMFbyCWdjqg_SFWM6k';

// Helper to calculate standard CRC-32 for zip local file headers
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      let bit = (crc ^ byte) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
      byte = byte >>> 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

// Pure Node.js OpenXML Zip file generator (zero native dependencies)
function createZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const uncompressedData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const crc = crc32(uncompressedData);
    const compressedData = zlib.deflateRawSync(uncompressedData);

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);          // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);           // Flags
    localHeader.writeUInt16LE(8, 8);           // Compression: Deflate
    localHeader.writeUInt16LE(0, 10);          // Mod time
    localHeader.writeUInt16LE(0, 12);          // Mod date
    localHeader.writeUInt32LE(crc, 14);        // CRC-32
    localHeader.writeUInt32LE(compressedData.length, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedData.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // Name length
    localHeader.writeUInt16LE(0, 28);          // Extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedData);

    // Central directory header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);          // Version made by
    centralHeader.writeUInt16LE(20, 6);          // Version needed
    centralHeader.writeUInt16LE(0, 8);           // Flags
    centralHeader.writeUInt16LE(8, 10);          // Compression: Deflate
    centralHeader.writeUInt16LE(0, 12);          // Mod time
    centralHeader.writeUInt16LE(0, 14);          // Mod date
    centralHeader.writeUInt32LE(crc, 16);        // CRC-32
    centralHeader.writeUInt32LE(compressedData.length, 20); // Compressed size
    centralHeader.writeUInt32LE(uncompressedData.length, 24); // Uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28); // Name length
    centralHeader.writeUInt16LE(0, 30);          // Extra field length
    centralHeader.writeUInt16LE(0, 32);          // Comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk number start
    centralHeader.writeUInt16LE(0, 36);          // Internal attributes
    centralHeader.writeUInt32LE(0, 38);          // External attributes
    centralHeader.writeUInt32LE(offset, 42);     // Relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressedData.length;
  }

  const centralDirStart = offset;
  const centralDirSize = centralHeaders.reduce((acc, h) => acc + h.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);             // Signature
  eocd.writeUInt16LE(0, 4);                      // Disk number
  eocd.writeUInt16LE(0, 6);                      // Disk with CD
  eocd.writeUInt16LE(files.length, 8);           // Records on this disk
  eocd.writeUInt16LE(files.length, 10);          // Total records
  eocd.writeUInt32LE(centralDirSize, 12);        // Size of central directory
  eocd.writeUInt32LE(centralDirStart, 16);       // Offset of central directory
  eocd.writeUInt16LE(0, 20);                     // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a beautifully formatted Microsoft Word (.docx) file buffer for a Dialpad Call
 */
export function buildCallTranscriptDocx(callData) {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const paragraphs = [];

  // 1. Document Title
  paragraphs.push(`
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="40"/>
          <w:szCs w:val="40"/>
          <w:color w:val="1E3A8A"/>
        </w:rPr>
        <w:t>Dialpad Call Audit &amp; AI Transcript</w:t>
      </w:r>
    </w:p>
  `);

  // Subtitle
  paragraphs.push(`
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:color w:val="64748B"/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>Recruiter: ${escapeXml(callData.handlerName || 'Paul Seth')} • Automated OneDrive Archive for OpenAI Dots</w:t>
      </w:r>
    </w:p>
  `);

  // 2. Section: Overview Table
  paragraphs.push(`
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="4" w:color="2563EB"/>
        </w:pBdr>
        <w:spacing w:before="200" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
          <w:color w:val="2563EB"/>
        </w:rPr>
        <w:t>1. Call Overview &amp; Participants</w:t>
      </w:r>
    </w:p>
  `);

  const durationSec = Number(callData.durationSeconds || callData.duration || 0);
  const durationText = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
  const talkSec = Number(callData.talkTimeSeconds || 0);
  const talkText = talkSec > 0 ? `${Math.floor(talkSec / 60)}m ${talkSec % 60}s` : durationText;

  const details = [
    ['Date & Time', callData.dateStarted || callData.date || 'N/A'],
    ['Direction', (callData.direction || 'Outbound').toUpperCase()],
    ['Total Duration', `${durationText} (Talk Time: ${talkText})`],
    ['Call Status', callData.callStatus || (callData.connected ? 'Connected' : 'No Answer')],
    ['Recruiter Disposition', callData.disposition || 'None'],
    ['Recruiter Name', `${callData.handlerName || 'Paul Seth'} (${callData.handlerEmail || 'pseth@stratass.com'})`],
    ['External Contact', `${callData.crmName || callData.externalName || 'Unknown'} (${callData.externalNumber || callData.phoneNumber || 'N/A'})`],
    ['Party Classification', `${callData.targetType || 'Candidate'} ${callData.classificationSource ? `[${callData.classificationSource}]` : ''}`],
    ['CRM Profile Link', callData.crmId ? `Recruitly ID: ${callData.crmId} (${callData.crmCompany || ''})` : 'Unmatched / Not Linked']
  ];

  for (const [k, v] of details) {
    paragraphs.push(`
      <w:p>
        <w:pPr>
          <w:spacing w:after="80"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E293B"/></w:rPr>
          <w:t>${escapeXml(k)}: </w:t>
        </w:r>
        <w:r>
          <w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
          <w:t>${escapeXml(v)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  // 3. Section: Dialpad AI Call Recap
  if (callData.recapSummary || callData.recapOutcome) {
    paragraphs.push(`
      <w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="12" w:space="4" w:color="2563EB"/>
          </w:pBdr>
          <w:spacing w:before="240" w:after="120"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="26"/>
            <w:color w:val="2563EB"/>
          </w:rPr>
          <w:t>2. Dialpad AI Summary &amp; Outcomes</w:t>
        </w:r>
      </w:p>
    `);

    if (callData.recapSummary) {
      paragraphs.push(`
        <w:p>
          <w:pPr><w:spacing w:after="60"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E293B"/></w:rPr><w:t>Call Summary: </w:t></w:r>
        </w:p>
        <w:p>
          <w:pPr><w:spacing w:after="120"/><w:ind w:left="240"/></w:pPr>
          <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(callData.recapSummary)}</w:t></w:r>
        </w:p>
      `);
    }

    if (callData.recapOutcome) {
      paragraphs.push(`
        <w:p>
          <w:pPr><w:spacing w:after="60"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E293B"/></w:rPr><w:t>Agreed Outcomes &amp; Action Items: </w:t></w:r>
        </w:p>
        <w:p>
          <w:pPr><w:spacing w:after="120"/><w:ind w:left="240"/></w:pPr>
          <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(callData.recapOutcome)}</w:t></w:r>
        </w:p>
      `);
    }
  }

  // 4. Section: Full Verbatim Transcript
  paragraphs.push(`
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="4" w:color="2563EB"/>
        </w:pBdr>
        <w:spacing w:before="240" w:after="140"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
          <w:color w:val="2563EB"/>
        </w:rPr>
        <w:t>3. Full Verbatim Transcript</w:t>
      </w:r>
    </w:p>
  `);

  const transcriptLines = (callData.transcript || 'No transcript generated.').split('\n');
  for (const line of transcriptLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40) {
      const speaker = trimmed.substring(0, colonIdx);
      const text = trimmed.substring(colonIdx + 1);
      paragraphs.push(`
        <w:p>
          <w:pPr><w:spacing w:after="80"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="1E3A8A"/></w:rPr>
            <w:t>${escapeXml(speaker)}:</w:t>
          </w:r>
          <w:r>
            <w:rPr><w:sz w:val="20"/><w:color w:val="1E293B"/></w:rPr>
            <w:t> ${escapeXml(text)}</w:t>
          </w:r>
        </w:p>
      `);
    } else {
      paragraphs.push(`
        <w:p>
          <w:pPr><w:spacing w:after="80"/></w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
            <w:t>${escapeXml(trimmed)}</w:t>
          </w:r>
        </w:p>
      `);
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const files = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: relsXml },
    { name: 'word/document.xml', data: documentXml }
  ];

  return createZip(files);
}

/**
 * Checks if a given call belongs to Paul Seth
 */
export function isPaulSethCall(callData) {
  if (!callData) return false;
  const name = `${callData.handlerName || ''} ${callData.target?.name || ''} ${callData.operator?.name || ''}`.toLowerCase().trim();
  const email = `${callData.handlerEmail || ''} ${callData.target?.email || ''} ${callData.operator?.email || ''} ${callData.dialpadUser || ''}`.toLowerCase().trim();
  const id = `${callData.handlerId || ''}`.toLowerCase().trim();

  return name.includes('paul seth') || 
         name === 'paul' || 
         email.includes('pseth') || 
         email.includes('paul.seth') || 
         id.includes('paul');
}

/**
 * Automatically packages and uploads the call transcript to Paul Seth's OneDrive folder
 */
export async function autoUploadTranscriptToOneDrive(callData, customWebhookUrl = null) {
  if (!callData) return { success: false, reason: 'No call data provided' };
  
  const transcript = (callData.transcript || '').trim();
  const hasValidTranscript = transcript && 
    transcript !== 'No transcript generated yet.' && 
    transcript !== 'Transcript is empty' && 
    !transcript.startsWith('No transcript available');

  if (!hasValidTranscript) {
    return { success: false, skipped: true, reason: 'No transcript available for this call leg' };
  }

  const webhookUrl = customWebhookUrl || process.env.PAUL_SETH_ONEDRIVE_WEBHOOK_URL || DEFAULT_PAUL_SETH_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, reason: 'Power Automate webhook URL is not configured' };
  }

  try {
    // Generate clean filename: YYYY-MM-DD_HH-mm_PaulSeth_ContactName.docx
    let datePart = 'call';
    if (callData.dateStarted) {
      datePart = String(callData.dateStarted).replace(/[: ]/g, '-').substring(0, 16);
    } else {
      const now = new Date();
      datePart = now.toISOString().replace(/[: ]/g, '-').substring(0, 16);
    }

    const contactNameClean = (callData.crmName || callData.externalName || callData.externalNumber || 'Contact')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);

    const callIdSuffix = String(callData.primaryCallId || callData.id || Date.now()).slice(-6);
    const fileName = `${datePart}_PaulSeth_${contactNameClean}_${callIdSuffix}.docx`;

    console.log(`[OneDrive Auto-Sync] Generating Word document ${fileName} for Paul Seth...`);
    const docxBuffer = buildCallTranscriptDocx(callData);
    const base64Content = docxBuffer.toString('base64');

    console.log(`[OneDrive Auto-Sync] Posting payload to Power Automate webhook (${docxBuffer.length} bytes)...`);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        fileContent: base64Content
      })
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`[OneDrive Auto-Sync] Successfully delivered ${fileName} to OneDrive! Status: ${res.status}`);
      return {
        success: true,
        fileName,
        deliveredAt: new Date().toISOString()
      };
    } else {
      const errText = await res.text();
      console.error(`[OneDrive Auto-Sync] Power Automate returned error ${res.status}:`, errText);
      return {
        success: false,
        error: `Power Automate status ${res.status}: ${errText}`
      };
    }
  } catch (err) {
    console.error(`[OneDrive Auto-Sync] Exception during OneDrive upload:`, err);
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}
