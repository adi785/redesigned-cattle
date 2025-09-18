import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Eye, Edit, Calendar, Cow } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnimalRecord {
  id: string;
  animal_id: string;
  predicted_breed: string;
  manual_breed?: string;
  final_breed?: string;
  confidence_score: number;
  verification_status: string;
  animal_type: string;
  created_at: string;
  image_url: string;
  notes?: string;
  breed_predictions?: Array<{
    predicted_breeds: Array<{ breed: string; confidence: number }>;
    model_version: string;
    processing_time_ms: number;
    created_at: string;
  }>;
}

const Records = () => {
  const [records, setRecords] = useState<AnimalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [animalTypeFilter, setAnimalTypeFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<AnimalRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [manualBreed, setManualBreed] = useState('');
  const [notes, setNotes] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchRecords = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (animalTypeFilter !== 'all') queryParams.append('animal_type', animalTypeFilter);
      queryParams.append('limit', '50');

      const { data: response, error } = await supabase.functions
        .invoke('get-animal-records', {
          body: Object.fromEntries(queryParams),
        });

      if (error) {
        throw new Error(error.message);
      }

      setRecords(response.records || []);

    } catch (error: any) {
      console.error('Error fetching records:', error);
      toast({
        title: "Error",
        description: "Failed to load animal records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user, statusFilter, animalTypeFilter]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = searchTerm === '' || 
      record.predicted_breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.animal_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const handleEditRecord = (record: AnimalRecord) => {
    setSelectedRecord(record);
    setManualBreed(record.manual_breed || '');
    setNotes(record.notes || '');
    setVerificationStatus(record.verification_status);
    setEditDialogOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (!selectedRecord) return;

    try {
      const { data, error } = await supabase.functions
        .invoke('update-animal-record', {
          body: {
            record_id: selectedRecord.id,
            manual_breed: manualBreed || null,
            final_breed: manualBreed || selectedRecord.predicted_breed,
            verification_status: verificationStatus,
            notes: notes || null,
          },
        });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Record Updated",
        description: "Animal record has been successfully updated",
      });

      setEditDialogOpen(false);
      fetchRecords(); // Refresh the list

    } catch (error: any) {
      console.error('Error updating record:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Animal Records</h1>
        <p className="text-muted-foreground">
          View and manage your classified animal records
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by breed or animal ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={animalTypeFilter} onValueChange={setAnimalTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Animals</SelectItem>
            <SelectItem value="cattle">Cattle</SelectItem>
            <SelectItem value="buffalo">Buffalo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Records Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecords.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <Cow className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No records found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' || animalTypeFilter !== 'all'
                    ? 'Try adjusting your filters or search terms'
                    : 'Upload your first animal image to get started'}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden">
              {record.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={record.image_url}
                    alt="Animal"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  />
                </div>
              )}
              
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {formatBreedName(record.final_breed || record.predicted_breed)}
                  </CardTitle>
                  <Badge className={getStatusColor(record.verification_status)}>
                    {record.verification_status}
                  </Badge>
                </div>
                <CardDescription>
                  {record.animal_type} • {(record.confidence_score * 100).toFixed(1)}% confidence
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(record.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  {record.manual_breed && (
                    <div>
                      <span className="font-medium">Manual ID:</span> {formatBreedName(record.manual_breed)}
                    </div>
                  )}

                  {record.notes && (
                    <div>
                      <span className="font-medium">Notes:</span> {record.notes.substring(0, 50)}...
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Animal Record Details</DialogTitle>
                        <DialogDescription>
                          Classification results for {record.animal_id}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        {record.image_url && (
                          <img
                            src={record.image_url}
                            alt="Animal"
                            className="w-full h-64 object-cover rounded-lg"
                          />
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <strong>Predicted Breed:</strong> {formatBreedName(record.predicted_breed)}
                          </div>
                          <div>
                            <strong>Confidence:</strong> {(record.confidence_score * 100).toFixed(1)}%
                          </div>
                          <div>
                            <strong>Animal Type:</strong> {record.animal_type}
                          </div>
                          <div>
                            <strong>Status:</strong> {record.verification_status}
                          </div>
                          {record.manual_breed && (
                            <div>
                              <strong>Manual Breed:</strong> {formatBreedName(record.manual_breed)}
                            </div>
                          )}
                        </div>

                        {record.breed_predictions && record.breed_predictions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">All Predictions:</h4>
                            <div className="space-y-1">
                              {record.breed_predictions[0].predicted_breeds.map((pred, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span>{formatBreedName(pred.breed)}</span>
                                  <span>{(pred.confidence * 100).toFixed(1)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {record.notes && (
                          <div>
                            <strong>Notes:</strong>
                            <p className="mt-1 text-sm">{record.notes}</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEditRecord(record)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Animal Record</DialogTitle>
            <DialogDescription>
              Update the classification details for this animal
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="manualBreed">Manual Breed Identification</Label>
              <Input
                id="manualBreed"
                value={manualBreed}
                onChange={(e) => setManualBreed(e.target.value)}
                placeholder="Enter correct breed if different from prediction"
              />
            </div>

            <div>
              <Label>Verification Status</Label>
              <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about this classification"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRecord}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Records;