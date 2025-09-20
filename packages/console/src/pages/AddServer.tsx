import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCredentials, useCreateServer } from "@/hooks/useApi";
import { credentialsApi, serversApi, type Credential, type CredentialType, type CreateCredentialRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { getRandomUsername } from "@excalidraw/random-username";

const AddServer = () => {
  const navigate = useNavigate();
  const { data: credentials = [] } = useCredentials();
  const createServerMutation = useCreateServer();

  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");

  const [credMode, setCredMode] = useState<'existing' | 'create'>('existing');
  const [selectedCredId, setSelectedCredId] = useState("");

  const [newCredType, setNewCredType] = useState<CredentialType>('password');
  const [newCredName, setNewCredName] = useState("");
  const [newCredUsername, setNewCredUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPrivateKey, setNewPrivateKey] = useState("");
  const [newPublicKey, setNewPublicKey] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const generatedName = useMemo(() => getRandomUsername(), [newCredType]);

  useEffect(() => {
    if (credMode === 'existing' && selectedCredId) {
      // fetch credential to get username
      (async () => {
        try {
          const { credential } = await credentialsApi.getById(selectedCredId);
          setUsername(credential.username);
        } catch (error) {
          console.error('Failed to fetch credential details:', error);
        }
      })();
    }
  }, [credMode, selectedCredId]);

  const onGeneratePassword = async () => {
    try {
      const res = await credentialsApi.generate({ type: 'password' });
      setNewPassword(res.password || "");
    } catch {
      toast({ title: 'Failed to generate password' });
    }
  };

  const onGenerateKey = async (algo: 'ssh-ed25519' | 'ssh-rsa') => {
    try {
      const res = await credentialsApi.generate({ type: algo });
      setNewPrivateKey(res.private_key || "");
      setNewPublicKey(res.public_key || "");
    } catch {
      toast({ title: 'Failed to generate keypair' });
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      let credential_id = selectedCredId;
      let finalUsername = username;

      if (credMode === 'create') {
        const payload: CreateCredentialRequest = {
          name: newCredName || generatedName,
          type: newCredType,
          username: newCredUsername,
          password: newCredType === 'password' ? newPassword : undefined,
          private_key: newCredType !== 'password' ? newPrivateKey : undefined,
          public_key: newPublicKey || undefined,
          passphrase: newCredType === 'private_key_with_passphrase' ? newPassphrase : undefined,
        };
        const res = await credentialsApi.create(payload);
        credential_id = res.id;
        finalUsername = newCredUsername;
      }

      await serversApi.create({
        name,
        hostname,
        port,
        username: finalUsername,
        description: description || undefined,
        credential_id,
      });

      toast({ title: 'Server created' });
      navigate('/servers');
    } catch (e) {
      toast({ title: 'Failed to create server' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Server</h1>
          <p className="text-muted-foreground">Add a server and choose credentials</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Server Details</CardTitle>
          <CardDescription>Connection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production Server" />
            </div>
            <div className="space-y-2">
              <Label>Hostname</Label>
              <Input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="server.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 22)} placeholder="22" />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ubuntu" disabled={credMode==='existing'} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Server description..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>Choose existing or create new</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={credMode} onValueChange={(v: 'existing'|'create') => setCredMode(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">Use existing</SelectItem>
                  <SelectItem value="create">Create new</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {credMode === 'existing' && (
              <div className="space-y-2">
                <Label>Credential</Label>
                <Select value={selectedCredId} onValueChange={setSelectedCredId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} · {c.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {credMode === 'create' && (
              <>
                <div className="space-y-2">
                  <Label>Credential Name</Label>
                  <Input value={newCredName} onChange={(e)=>setNewCredName(e.target.value)} placeholder={generatedName} />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={newCredUsername} onChange={(e)=>setNewCredUsername(e.target.value)} placeholder="ubuntu" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newCredType} onValueChange={(v: CredentialType)=>setNewCredType(v)}>
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

                {newCredType === 'password' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Password</Label>
                    <div className="flex gap-2">
                      <Input value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Enter your password" />
                      <Button type="button" variant="outline" onClick={onGeneratePassword}>Generate</Button>
                    </div>
                  </div>
                )}

                {newCredType !== 'password' && (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Private Key (PEM)</Label>
                      <Textarea value={newPrivateKey} onChange={(e)=>setNewPrivateKey(e.target.value)} rows={8} placeholder="-----BEGIN PRIVATE KEY-----" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Public Key (OpenSSH) - optional</Label>
                      <Textarea value={newPublicKey} onChange={(e)=>setNewPublicKey(e.target.value)} rows={8} placeholder="ssh-ed25519 AAAAC3..." />
                    </div>
                    {newCredType === 'private_key_with_passphrase' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Passphrase</Label>
                        <Input value={newPassphrase} onChange={(e)=>setNewPassphrase(e.target.value)} placeholder="Enter passphrase" />
                      </div>
                    )}
                    <div className="md:col-span-2 flex gap-2">
                      <Button type="button" variant="outline" onClick={() => onGenerateKey('ssh-ed25519')}>Generate ed25519</Button>
                      <Button type="button" variant="outline" onClick={() => onGenerateKey('ssh-rsa')}>Generate RSA</Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddServer;