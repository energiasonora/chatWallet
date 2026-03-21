import { Signer } from '@ucanto/principal/ed25519';
import * as Delegation from '@ucanto/core/delegation';
import * as DID from '@ipld/dag-ucan/did';
import * as Link from 'multiformats/link';
import * as CAR from '@ucanto/transport/car';
import { identity } from 'multiformats/hashes/identity';
import { base64 } from 'multiformats/bases/base64';
import { parse as parseProof } from '@storacha/client/proof';
import dotenv from 'dotenv';
dotenv.config({ override: true });

async function run() {
    const serverPrincipal = Signer.parse(process.env.SERVER_PRIVATE_KEY);
    const proof = await parseProof(process.env.SPACE_PROOF);
    const spaceDid = process.env.SPACE_DID;

    const audience = DID.parse('did:key:z6MkueJmQF6kXxfLU2U1j9SmiKx2kR57ngxQYFew7saMqc61'); 

    const expirationEpoch = Math.floor(Date.now() / 1000) + 3600;
    const delegation = await Delegation.delegate({
      issuer: serverPrincipal,
      audience: audience,
      capabilities: [{ can: 'store/add', with: spaceDid }],
      proofs: [proof],
      expiration: expirationEpoch
    });

    const archive = await delegation.archive();
    
    const digest = identity.digest(archive.ok);
    const cid = Link.create(CAR.codec.code, digest);
    const ucanBase64 = cid.toString(base64.encoder);
    
    console.log("CID String encoded:", ucanBase64.substring(0, 50));

    try {
        const parsed = await parseProof(ucanBase64);
        console.log("parseProof works! Parsed CID:", parsed.cid.toString());
    } catch(e) { console.log("parseProof error:", e.message); }
}
run();
