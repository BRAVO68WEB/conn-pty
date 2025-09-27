import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession, useEndSession } from '@/hooks/useApi';
import { Terminal } from '../components/Terminal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Maximize2, Minimize2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SessionNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch the existing session
  const { data: session, isLoading, error, refetch } = useSession(id!);
  const endSessionMutation = useEndSession();

  // keep refetching if session is pending, untill active, every 3 seconds
  useEffect(() => {
    if (session?.status === 'pending') {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [session, refetch]);

  // Handle session end
  const handleEndSession = async () => {
    if (session) {
      try {
        await endSessionMutation.mutateAsync(session.id);
        navigate('/console');
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              The session you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/console')}>
              Back to Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-screen flex flex-col",
      isFullscreen ? "fixed inset-0 z-50 bg-background" : ""
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-transparent">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">Terminal Session</h1>
          <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
            {session.status}
          </Badge>
          <span className="text-sm text-gray-500">
            Session ID: {session.id}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndSession}
            disabled={endSessionMutation.isPending}
          >
            {endSessionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            End Session
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 p-4">
        <Card className="h-full">
          <CardContent className="p-2 h-full">
            <Terminal
              sessionId={session.id}
              className="h-full"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}