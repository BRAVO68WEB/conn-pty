import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Server, 
  Plus, 
  Edit, 
  Trash2, 
  Terminal, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { useServers, useCreateServer, useUpdateServer, useDeleteServer, useCredentials, useCreateSession } from "@/hooks/useApi";
import type { Server as ApiServer } from "@/lib/api";

const Servers = () => {
  // API hooks
  const { data: servers = [], isLoading, error } = useServers();
  const { data: credentials = [] } = useCredentials();
  const createServerMutation = useCreateServer();
  const updateServerMutation = useUpdateServer();
  const deleteServerMutation = useDeleteServer();
  const createSessionMutation = useCreateSession();

  const navigate = useNavigate();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ApiServer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    hostname: "",
    port: 22,
    username: "",
    description: "",
    credential_id: ""
  });

  const getStatusColor = (server: ApiServer) => {
    // Since API doesn't provide status, we'll show as unknown
    return "bg-gray-500";
  };

  const getStatusVariant = (server: ApiServer) => {
    // Since API doesn't provide status, we'll show as secondary
    return "secondary" as const;
  };

  const getStatusText = (server: ApiServer) => {
    // Since API doesn't provide status, we'll show as unknown
    return "unknown";
  };

  const handleAddServer = async () => {
    try {
      await createServerMutation.mutateAsync({
        name: formData.name,
        hostname: formData.hostname,
        port: formData.port,
        username: formData.username,
        description: formData.description,
        credential_id: formData.credential_id
      });
      
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  const handleEditServer = async () => {
    if (!selectedServer) return;
    
    try {
      await updateServerMutation.mutateAsync({
        id: selectedServer.id,
        data: {
          name: formData.name,
          hostname: formData.hostname,
          port: formData.port,
          username: formData.username,
          description: formData.description,
          credential_id: formData.credential_id
        }
      });
      
      setIsEditDialogOpen(false);
      setSelectedServer(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update server:', error);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await deleteServerMutation.mutateAsync(serverId);
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
  };

  const handleCreateSession = async (server: ApiServer) => {
    // Navigate to session page with server info
    console.log("Creating session for server:", server.name);

    const { mutateAsync } = createSessionMutation;
    const session = await mutateAsync({
      server_id: server.id,
    });
    if (session) {
      // Navigate to session page
      navigate(`/sessions/${session.session.id}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      hostname: "",
      port: 22,
      username: "",
      description: "",
      credential_id: ""
    });
  };

  const openEditDialog = (server: ApiServer) => {
    setSelectedServer(server);
    setFormData({
      name: server.name,
      hostname: server.hostname,
      port: server.port,
      username: server.username,
      description: server.description || "",
      credential_id: server.credential_id
    });
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading servers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Failed to load servers. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servers</h1>
          <p className="text-muted-foreground">
            Manage your SSH servers and create connections
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button asChild>
              <Link to="/servers/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Link>
            </Button>
          </DialogTrigger>
          {/* Creation moved to dedicated page */}
        </Dialog>
      </div>

      {/* Servers Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
          <CardDescription>All configured SSH servers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <Card key={server.id} className="relative">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{server.name}</span>
                    <Badge variant={getStatusVariant(server)}>{getStatusText(server)}</Badge>
                  </CardTitle>
                  <CardDescription className="truncate">{server.username}@{server.hostname}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => handleCreateSession(server)}>
                      <Terminal className="h-4 w-4 mr-1" /> Connect
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(server)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteServer(server.id)} disabled={deleteServerMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {servers.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-8">
                <Server className="h-8 w-8 mx-auto mb-2" />
                <p>No servers configured yet.</p>
                <p className="text-sm">Add your first server to get started.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Server</DialogTitle>
            <DialogDescription>
              Update server configuration.
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
              <Label htmlFor="edit-hostname" className="text-right">
                Hostname
              </Label>
              <Input
                id="edit-hostname"
                value={formData.hostname}
                onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-port" className="text-right">
                Port
              </Label>
              <Input
                id="edit-port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 22 })}
                className="col-span-3"
              />
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-credential" className="text-right">
                Credential
              </Label>
              <Select
                value={formData.credential_id}
                onValueChange={(value) => setFormData({ ...formData, credential_id: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select credential" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((credential) => (
                    <SelectItem key={credential.id} value={credential.id}>
                      {credential.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleEditServer}
              disabled={updateServerMutation.isPending}
            >
              {updateServerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Servers;