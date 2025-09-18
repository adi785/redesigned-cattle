import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Database, TrendingUp, Clock, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnimalRecord {
  id: string;
  animal_id: string;
  predicted_breed: string;
  confidence_score: number;
  verification_status: string;
  animal_type: string;
  created_at: string;
  image_url: string;
}

interface DashboardStats {
  totalRecords: number;
  pendingVerification: number;
  averageConfidence: number;
  recentClassifications: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRecords: 0,
    pendingVerification: 0,
    averageConfidence: 0,
    recentClassifications: 0,
  });
  const [recentRecords, setRecentRecords] = useState<AnimalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch recent records
      const { data: records, error: recordsError } = await supabase.functions
        .invoke('get-animal-records', {
          body: {
            limit: 5,
            offset: 0,
          },
        });

      if (recordsError) {
        throw new Error(recordsError.message);
      }

      const animalRecords = records.records || [];
      setRecentRecords(animalRecords);

      // Calculate stats
      const totalRecords = records.pagination?.total || 0;
      const pendingVerification = animalRecords.filter(
        (record: AnimalRecord) => record.verification_status === 'pending'
      ).length;

      const averageConfidence = animalRecords.length > 0
        ? animalRecords.reduce((sum: number, record: AnimalRecord) => 
            sum + (record.confidence_score || 0), 0) / animalRecords.length
        : 0;

      // Recent classifications (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentClassifications = animalRecords.filter(
        (record: AnimalRecord) => new Date(record.created_at) > oneDayAgo
      ).length;

      setStats({
        totalRecords,
        pendingVerification,
        averageConfidence: averageConfidence * 100,
        recentClassifications,
      });

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleClassificationComplete = (result: any) => {
    // Refresh dashboard data
    fetchDashboardData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const formatBreedName = (breed: string) => {
    return breed.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Upload images to classify cattle and buffalo breeds.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
            <p className="text-xs text-muted-foreground">
              All time classifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingVerification}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting verification
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageConfidence.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Classification accuracy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent (24h)</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentClassifications}</div>
            <p className="text-xs text-muted-foreground">
              New classifications
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">New Classification</h2>
          <ImageUpload onClassificationComplete={handleClassificationComplete} />
        </div>

        {/* Recent Records */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Classifications</h2>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View All
            </Button>
          </div>

          <div className="space-y-3">
            {recentRecords.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">No classifications yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your first animal image to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              recentRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      {record.image_url && (
                        <img
                          src={record.image_url}
                          alt="Animal"
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">
                            {formatBreedName(record.predicted_breed)}
                          </h4>
                          <Badge className={getStatusColor(record.verification_status)}>
                            {record.verification_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {record.animal_type} • {(record.confidence_score * 100).toFixed(1)}% confidence
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(record.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;