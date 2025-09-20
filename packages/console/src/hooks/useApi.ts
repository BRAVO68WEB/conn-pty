import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  serversApi, 
  credentialsApi, 
  sessionsApi, 
  CreateServerRequest, 
  UpdateServerRequest,
  CreateCredentialRequest,
  UpdateCredentialRequest,
  CreateSessionRequest,
  ApiError
} from '@/lib/api';

// Query Keys
export const queryKeys = {
  servers: ['servers'] as const,
  server: (id: string) => ['servers', id] as const,
  credentials: ['credentials'] as const,
  credential: (id: string) => ['credentials', id] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['sessions', id] as const,
};

// Server Hooks
export const useServers = () => {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: async () => {
      const response = await serversApi.getAll();
      return response.servers;
    },
  });
};

export const useServer = (id: string) => {
  return useQuery({
    queryKey: queryKeys.server(id),
    queryFn: async () => {
      const response = await serversApi.getById(id);
      return response.server;
    },
    enabled: !!id,
  });
};

export const useCreateServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateServerRequest) => serversApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
};

export const useUpdateServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServerRequest }) => 
      serversApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
      queryClient.invalidateQueries({ queryKey: queryKeys.server(id) });
    },
  });
};

export const useDeleteServer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => serversApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
    },
  });
};

// Credential Hooks
export const useCredentials = () => {
  return useQuery({
    queryKey: queryKeys.credentials,
    queryFn: async () => {
      const response = await credentialsApi.getAll();
      return response.credentials;
    },
  });
};

export const useCredential = (id: string) => {
  return useQuery({
    queryKey: queryKeys.credential(id),
    queryFn: async () => {
      const response = await credentialsApi.getById(id);
      return response.credential;
    },
    enabled: !!id,
  });
};

export const useCreateCredential = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCredentialRequest) => credentialsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials });
    },
  });
};

export const useUpdateCredential = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCredentialRequest }) => 
      credentialsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials });
      queryClient.invalidateQueries({ queryKey: queryKeys.credential(id) });
    },
  });
};

export const useDeleteCredential = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => credentialsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials });
    },
  });
};

// Session Hooks
export const useSessions = () => {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: async () => {
      const response = await sessionsApi.getAll();
      return response.sessions;
    },
  });
};

export const useSession = (id: string) => {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: async () => {
      const sessions = await sessionsApi.getAll();
      const response = { session: sessions.sessions.find(s => s.id === id) };
      return response.session;
    },
    enabled: !!id,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateSessionRequest) => sessionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
};

export const useEndSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => sessionsApi.end(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
};

// Error handling hook
export const useApiError = () => {
  const handleError = (error: unknown) => {
    if (error instanceof ApiError) {
      return {
        message: error.message,
        status: error.status,
        isApiError: true,
      };
    }
    
    return {
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      status: 0,
      isApiError: false,
    };
  };
  
  return { handleError };
};