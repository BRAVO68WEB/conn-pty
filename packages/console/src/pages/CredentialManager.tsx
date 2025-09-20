import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Key, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff,
  Copy,
  Shield,
  Lock,
  FileKey,
  User,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useCredentials, useCreateCredential, useUpdateCredential, useDeleteCredential } from "@/hooks/useApi";
import type { Credential, CredentialType } from "@/lib/api";
import { downloadTextFile } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const CredentialManager = () => {
  // API hooks
  const { data: credentials = [], isLoading, error } = useCredentials();
  const createCredentialMutation = useCreateCredential();
  const updateCredentialMutation = useUpdateCredential();
  const deleteCredentialMutation = useDeleteCredential();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState({
    name: "",
    type: "password" as CredentialType,
    username: "",
    password: "",
    public_key: "",
    private_key: "",
  });

  const getCredentialIcon = (type: string) => {
    switch (type) {
      case "password": return <Lock className="h-4 w-4" />;
      case "private_key": return <FileKey className="h-4 w-4" />;
      case "private_key_with_passphrase": return <FileKey className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getCredentialBadgeVariant = (type: string) => {
    switch (type) {
      case "password": return "destructive" as const;
      case "private_key": return "default" as const;
      case "private_key_with_passphrase": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const togglePrivateKeyVisibility = (credentialId: string) => {
    setShowPrivateKey(prev => ({
      ...prev,
      [credentialId]: !prev[credentialId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleAddCredential = async () => {
    try {
      await createCredentialMutation.mutateAsync({
        name: formData.name,
        type: formData.type,
        username: formData.username,
        password: formData.password,
        public_key: formData.public_key,
        private_key: formData.private_key,
      });
      
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: 'Credential created' });
    } catch (error) {
      console.error('Failed to create credential:', error);
      toast({ title: 'Failed to create credential' });
    }
  };

  const handleEditCredential = async () => {
    if (!selectedCredential) return;
    
    try {
      await updateCredentialMutation.mutateAsync({
        id: selectedCredential.id,
        data: {
          name: formData.name,
          type: formData.type,
          username: formData.username,
          password: formData.password,
          public_key: formData.public_key,
          private_key: formData.private_key,
        }
      });
      
      setIsEditDialogOpen(false);
      setSelectedCredential(null);
      resetForm();
      toast({ title: 'Credential updated' });
    } catch (error) {
      console.error('Failed to update credential:', error);
      toast({ title: 'Failed to update credential' });
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    try {
      await deleteCredentialMutation.mutateAsync(credentialId);
      toast({ title: 'Credential deleted' });
    } catch (error) {
      console.error('Failed to delete credential:', error);
      toast({ title: 'Failed to delete credential' });
    }
  };

  const handleExport = async (credentialId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/credentials/${credentialId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const { credential } = await res.json();
      const lines: string[] = [];
      lines.push(`name: ${credential.identifier || credential.name || ''}`);
      lines.push(`type: ${credential.type}`);
      lines.push(`username: ${credential.user || credential.username}`);
      if (credential.password) lines.push(`password: ${credential.password}`);
      if (credential.passphrase) lines.push(`passphrase: ${credential.passphrase}`);
      if (credential.public_key) {
        lines.push("public_key:");
        lines.push(credential.public_key);
      }
      if (credential.private_key) {
        lines.push("private_key:");
        lines.push(credential.private_key);
      }
      const content = lines.join("\n");
      downloadTextFile(`${credential.identifier || credential.name || 'credential'}.txt`, content);
      toast({ title: 'Credential exported' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to export credential' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "ssh_key",
      username: "",
      password: "",
      public_key: "",
      private_key: "",
    });
  };

  const openEditDialog = (credential: Credential) => {
    setSelectedCredential(credential);
    setFormData({
      name: credential.name,
      type: credential.type as CredentialType,
      username: credential.username || "",
      password: credential.password || "",
      public_key: credential.public_key || "",
      private_key: credential.private_key || "",
    });
    setIsEditDialogOpen(true);
  };

  const renderCredentialValue = (credential: Credential) => {
    const isVisible = showPrivateKey[credential.id];
    
    switch (credential.type) {
      case "password":
        return (
          <div className="flex items-center space-x-2">
            <span className="font-mono text-sm">
              {isVisible ? credential.password : "••••••••"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePrivateKeyVisibility(credential.id)}
            >
              {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(credential.password || "")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      case "ssh_key":
        return (
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Public:</span>
              <span className="font-mono text-xs truncate max-w-[200px]">
                {credential.public_key?.substring(0, 30)}...
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(credential.public_key || "")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">Private:</span>
              <span className="font-mono text-xs">
                {isVisible ? credential.private_key?.substring(0, 30) + "..." : "••••••••"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => togglePrivateKeyVisibility(credential.id)}
              >
                {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(credential.private_key || "")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      case "private_key":
        return (
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs">
              {isVisible ? credential.private_key?.substring(0, 30) + "..." : "••••••••"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePrivateKeyVisibility(credential.id)}
            >
              {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(credential.private_key || "")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      default:
        return <span className="text-muted-foreground">Unknown type</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading credentials...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Failed to load credentials. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Manager</h1>
          <p className="text-muted-foreground">
            Manage passwords, SSH keys, and other authentication credentials
          </p>
        </div>
        <Button asChild>
          <Link to="/credentials/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Link>
        </Button>
      </div>

      {/* Credentials Grid */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {credentials.map((credential) => (
            <Card key={credential.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {getCredentialIcon(credential.type)}
                      {credential.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant={getCredentialBadgeVariant(credential.type)}>
                        {credential.type.replace('_', ' ')}
                      </Badge>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openEditDialog(credential)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(credential.id)}>
                        <FileKey className="h-4 w-4 mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteCredential(credential.id)}
                        className="text-red-600"
                        disabled={deleteCredentialMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{credential.username || 'N/A'}</span>
                </div>
                <div>
                  {renderCredentialValue(credential)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {credential.created_at ? new Date(credential.created_at).toLocaleDateString() : 'Unknown'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {credentials.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2" />
              <p>No credentials stored yet.</p>
              <p className="text-sm">Add your first credential to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Credential</DialogTitle>
            <DialogDescription>
              Update credential information and values.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-type" className="text-right">
                Type
              </Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: "password" | "ssh_key" | "private_key") => 
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="ssh_key">SSH Key Pair</SelectItem>
                  <SelectItem value="private_key">Private Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">
                Username
              </Label>
              <Input
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="col-span-3"
              />
            </div>

            {formData.type === "password" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-password" className="text-right">
                  Password
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="col-span-3"
                />
              </div>
            )}

            {formData.type === "ssh_key" && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-publicKey" className="text-right">
                    Public Key
                  </Label>
                  <Textarea
                    id="edit-publicKey"
                    value={formData.public_key}
                    onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                    className="col-span-3"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-privateKey" className="text-right">
                    Private Key
                  </Label>
                  <Textarea
                    id="edit-privateKey"
                    value={formData.private_key}
                    onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                    className="col-span-3"
                    rows={4}
                  />
                </div>
              </>
            )}

            {formData.type === "private_key" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-privateKeyOnly" className="text-right">
                  Private Key
                </Label>
                <Textarea
                  id="edit-privateKeyOnly"
                  value={formData.private_key}
                  onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                  className="col-span-3"
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              onClick={handleEditCredential}
              disabled={updateCredentialMutation.isPending}
            >
              {updateCredentialMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CredentialManager;