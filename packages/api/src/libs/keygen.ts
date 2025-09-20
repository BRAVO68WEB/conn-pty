import crypto from "node:crypto";

// generate a .pem based ssh keypair and OpenSSH public key
export async function generateSshKeyPair(
    type: "ed25519" | "rsa"
): Promise<{
    public_key: string; // OpenSSH format (to be placed in authorized_keys)
    private_key: string; // PEM (usable by ssh2 / SSH clients)
    public_key_pem: string; // PEM (SPKI)
}> {
    // Generate key pair
    const keyPair = type === "rsa"
        ? crypto.generateKeyPairSync("rsa", {
            modulusLength: 2048,
            publicExponent: 0x10001,
        })
        : crypto.generateKeyPairSync("ed25519");

    const { publicKey, privateKey } = keyPair;

    // Export private key in PEM suitable for clients (PKCS#1 for RSA, PKCS#8 for Ed25519)
    const private_key = type === "rsa"
        ? privateKey.export({ format: "pem", type: "pkcs1" }).toString()
        : privateKey.export({ format: "pem", type: "pkcs8" }).toString();

    // Export public key in PEM (SPKI) for completeness
    const public_key_pem = publicKey.export({ format: "pem", type: "spki" }).toString();

    // Build OpenSSH public key string
    const public_key = buildOpenSshPublicKey(publicKey, type);

    return { public_key, private_key, public_key_pem };
}

function buildOpenSshPublicKey(publicKey: crypto.KeyObject, type: "ed25519" | "rsa"): string {
    if (type === "ed25519") {
        // For Ed25519, we can use JWK to get the 32-byte public key (x)
        const jwk = publicKey.export({ format: "jwk" }) as any;
        const xB64Url: string = jwk.x; // base64url
        const raw = base64UrlToBuffer(xB64Url); // 32 bytes

        const keyType = Buffer.from("ssh-ed25519");
        const body = Buffer.concat([
            writeString(keyType),
            writeString(raw),
        ]);
        return `ssh-ed25519 ${body.toString("base64")}`;
    }

    // RSA: need exponent (e) and modulus (n), both big-endian integers
    const jwk = publicKey.export({ format: "jwk" }) as any;
    const e = base64UrlToBuffer(jwk.e);
    const n = base64UrlToBuffer(jwk.n);

    const keyType = Buffer.from("ssh-rsa");
    const body = Buffer.concat([
        writeString(keyType),
        writeMpint(e),
        writeMpint(n),
    ]);

    return `ssh-rsa ${body.toString("base64")}`;
}

function writeString(buf: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(buf.length, 0);
    return Buffer.concat([len, buf]);
}

function writeMpint(buf: Buffer): Buffer {
    // Remove leading zeros
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0x00) i++;
    let b = buf.subarray(i);

    // If the high bit is set, prepend a 0x00 to indicate a positive integer
    if (b.length > 0 && (b[0] & 0x80)) {
        b = Buffer.concat([Buffer.from([0x00]), b]);
    }

    return writeString(b);
}

function base64UrlToBuffer(b64url: string): Buffer {
    // Convert base64url to base64
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    // Pad to multiple of 4
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    return Buffer.from(padded, "base64");
}

// generate random password ~length 19 (xxxx-xxxx-xxxx-xxxx)
export function generateRandomPassword(): string {
    return crypto.randomBytes(16).toString("hex").slice(0, 19).replace(/(.{4})/g, "$1-");
}
