import { Hono } from "hono";
import { 
    createCredential,
    deleteCredential,
    getCredential,
    getCredentials,
    updateCredential
} from "../services/credentials.js";
import { generateRandomPassword, generateSshKeyPair } from "../libs/keygen.js";

const app = new Hono();

app.post('/', async (c) => {
    const credential = await c.req.json();
    const id = await createCredential(credential);
    return c.json({ id });
});

app.get('/', async (c) => {
    const credentials = await getCredentials();
    // mask cred data 'password', 'private_key', 'passphrase'
    credentials.forEach(cred => {
        if (cred.type === "password") {
            cred.password = "********";
        }
        else if (cred.type === "private_key") {
            cred.private_key = "********";
        }
        else if (cred.type === "private_key_with_passphrase") {
            cred.passphrase = "********";
            cred.private_key = "********";
        }
    })
    return c.json({ credentials });
});

app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const credential = await getCredential(id);
    if (!credential) {
        return c.json({ error: "credential not found" }, 404);
    }
    return c.json({ credential });
});

app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const credential = await c.req.json();
    await updateCredential(id, credential);
    return c.json({ id });
});

app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await deleteCredential(id);
    return c.json({ id });
});

app.post('/util/generate', async (c) => {
    const { type } = await c.req.json();
    if (!type) {
        return c.json({ error: "type is required" }, 400);
    }
    if (type === "password") {
        const password = generateRandomPassword();
        return c.json({ password });
    }
    else if (type === "ssh-rsa") {
        const { public_key, private_key, public_key_pem } = await generateSshKeyPair("rsa");
        return c.json({ public_key, private_key, public_key_pem });
    }
    else if (type === "ssh-ed25519") {
        const { public_key, private_key, public_key_pem } = await generateSshKeyPair("ed25519");
        return c.json({ public_key, private_key, public_key_pem });
    }
    return c.json({ error: "type not supported" }, 400);
})

export default app;
