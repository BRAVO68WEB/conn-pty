import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2 } from "lucide-react";
import { credentialsApi, type CreateCredentialRequest, type CredentialType } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { getRandomUsername } from "@excalidraw/random-username";

const AddCredential = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<CredentialType>("password");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const generatedName = useMemo(() => getRandomUsername(), [type]);

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Username is required";
    if (type === "password" && !password.trim()) errs.password = "Password is required";
    if (type !== "password" && !privateKey.trim()) errs.privateKey = "Private key is required";
    if (type === "private_key_with_passphrase" && !passphrase.trim()) errs.passphrase = "Passphrase is required";
    return errs;
  }, [type, username, password, privateKey, passphrase]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const applyGeneratedName = () => setName(generatedName.replace(/_/g, "-"));

  const onGeneratePassword = async () => {
    try {
      const res = await credentialsApi.generate({ type: 'password' });
      setPassword(res.password || "");
    } catch (e) {
      toast({ title: "Failed to generate password" });
    }
  };

  const onGenerateKey = async (algo: 'ssh-ed25519' | 'ssh-rsa') => {
    try {
      const res = await credentialsApi.generate({ type: algo });
      setPrivateKey(res.private_key || "");
      setPublicKey(res.public_key || "");
    } catch (e) {
      toast({ title: "Failed to generate keypair" });
    }
  };

  const onSubmit = async () => {
    if (!isValid) {
      setShowErrors(true);
      toast({ title: "Please fix the highlighted fields" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateCredentialRequest = {
        name: name || generatedName,
        type,
        username,
        password: type === 'password' ? password : undefined,
        private_key: type !== 'password' ? privateKey : undefined,
        public_key: publicKey || undefined,
        passphrase: type === 'private_key_with_passphrase' ? passphrase : undefined,
      };
      await credentialsApi.create(payload);
      toast({ title: "Credential created" });
      navigate('/credentials');
    } catch (e) {
      toast({ title: "Failed to create credential" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Credential</h1>
          <p className="text-muted-foreground">Create an authentication method for servers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting} aria-disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </div>
      </div>

      {showErrors && !isValid && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 text-red-700 px-4 py-2">
          There are validation errors. Please review the fields below.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Credential Details</CardTitle>
          <CardDescription>Choose type and provide details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Credential Name</Label>
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={generatedName} />
                <Button type="button" variant="outline" onClick={applyGeneratedName} title="Generate name">
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ubuntu"
                aria-invalid={showErrors && !!errors.username}
                className={showErrors && errors.username ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {showErrors && errors.username && (
                <p className="text-xs text-red-600">{errors.username}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: CredentialType) => { setType(v); setShowErrors(false); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="private_key">Private Key</SelectItem>
                <SelectItem value="private_key_with_passphrase">Private Key with Passphrase</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'password' && (
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  type="password"
                  aria-invalid={showErrors && !!errors.password}
                  className={showErrors && errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                <Button type="button" variant="outline" onClick={onGeneratePassword} disabled={submitting}>
                  Generate
                </Button>
              </div>
              {showErrors && errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>
          )}

          {type !== 'password' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Private Key (PEM)</Label>
                <Textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  rows={8}
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  aria-invalid={showErrors && !!errors.privateKey}
                  className={showErrors && errors.privateKey ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {showErrors && errors.privateKey && (
                  <p className="text-xs text-red-600">{errors.privateKey}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Public Key (OpenSSH) - optional</Label>
                <Textarea value={publicKey} onChange={(e) => setPublicKey(e.target.value)} rows={8} placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..." />
              </div>
              {type === 'private_key_with_passphrase' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Passphrase</Label>
                  <Input
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter passphrase"
                    type="password"
                    aria-invalid={showErrors && !!errors.passphrase}
                    className={showErrors && errors.passphrase ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {showErrors && errors.passphrase && (
                    <p className="text-xs text-red-600">{errors.passphrase}</p>
                  )}
                </div>
              )}
              <div className="md:col-span-2 flex gap-2">
                <Button type="button" variant="outline" onClick={() => onGenerateKey('ssh-ed25519')} disabled={submitting}>Generate ed25519</Button>
                <Button type="button" variant="outline" onClick={() => onGenerateKey('ssh-rsa')} disabled={submitting}>Generate RSA</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AddCredential;