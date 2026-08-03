import { parse as storachaParse } from '@storacha/client/proof';
import { extract } from '@ucanto/core/delegation';
import * as Delegation from '@ucanto/core/delegation';
import { Buffer } from 'buffer';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    const pBase64 = process.env.SPACE_PROOF;
    console.log("Len:", pBase64.length);

    // Technique 1: Storacha parse
    try {
        const sp = await storachaParse(pBase64);
        console.log("Storacha Parse OK! Has export?", typeof sp.export === 'function');
        if (typeof sp.export !== 'function') {
            console.log("Keys:", Object.keys(sp));
        }
    } catch(e) { console.error("Storacha fail", e.message); }

    // Technique 2: Extract from CAR
    try {
        const bytes = new Uint8Array(Buffer.from(pBase64, 'base64'));
        const ext = await extract(bytes);
        if (ext.ok) {
            console.log("Extract OK! Has export?", typeof ext.ok.export === 'function');
        } else {
            console.log("Iterating...");
            let found = false;
            for await (const d of ext) {
                console.log("Iter OK! Has export?", typeof d.export === 'function');
                found = true;
                break;
            }
            if (!found) console.log("Extract empty iterator");
        }
    } catch(e) { console.error("Extract fail", e.message); }

}
run();
