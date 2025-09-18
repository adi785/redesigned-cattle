import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Search, Globe, MapPin, Cow } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Breed {
  id: string;
  name: string;
  breed_code: string;
  animal_type: string;
  description?: string;
  native_region?: string;
  is_indigenous: boolean;
  characteristics?: {
    milk_yield?: string;
    body_size?: string;
    temperament?: string;
    adaptability?: string;
  };
  created_at: string;
}

const Breeds = () => {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [animalTypeFilter, setAnimalTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  
  const { toast } = useToast();

  const fetchBreeds = async () => {
    try {
      setLoading(true);

      const queryParams = new URLSearchParams();
      if (animalTypeFilter !== 'all') {
        queryParams.append('animal_type', animalTypeFilter);
      }

      const { data: response, error } = await supabase.functions
        .invoke('get-breeds', {
          body: Object.fromEntries(queryParams),
        });

      if (error) {
        throw new Error(error.message);
      }

      setBreeds(response.breeds || []);

    } catch (error: any) {
      console.error('Error fetching breeds:', error);
      toast({
        title: "Error",
        description: "Failed to load breed information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreeds();
  }, [animalTypeFilter]);

  const filteredBreeds = breeds.filter(breed => {
    const matchesSearch = searchTerm === '' || 
      breed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      breed.native_region?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'indigenous' && breed.is_indigenous) ||
      (activeTab === 'exotic' && !breed.is_indigenous);
    
    return matchesSearch && matchesTab;
  });

  const formatBreedName = (name: string) => {
    return name.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getAnimalIcon = (type: string) => {
    return <Cow className="h-5 w-5" />;
  };

  const getCharacteristicsList = (characteristics: any) => {
    if (!characteristics) return [];
    
    return Object.entries(characteristics)
      .filter(([_, value]) => value)
      .map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value as string
      }));
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
        <h1 className="text-3xl font-bold text-foreground">Breed Database</h1>
        <p className="text-muted-foreground">
          Explore information about different cattle and buffalo breeds
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search breeds by name or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={animalTypeFilter} onValueChange={setAnimalTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by animal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Animals</SelectItem>
            <SelectItem value="cattle">Cattle</SelectItem>
            <SelectItem value="buffalo">Buffalo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Breeds</TabsTrigger>
          <TabsTrigger value="indigenous">Indigenous</TabsTrigger>
          <TabsTrigger value="exotic">Exotic</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <BreedGrid breeds={filteredBreeds} />
        </TabsContent>
        
        <TabsContent value="indigenous" className="mt-6">
          <BreedGrid breeds={filteredBreeds} />
        </TabsContent>
        
        <TabsContent value="exotic" className="mt-6">
          <BreedGrid breeds={filteredBreeds} />
        </TabsContent>
      </Tabs>
    </div>
  );

  function BreedGrid({ breeds }: { breeds: Breed[] }) {
    if (breeds.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Cow className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No breeds found</h3>
            <p className="text-muted-foreground">
              {searchTerm || animalTypeFilter !== 'all'
                ? 'Try adjusting your search terms or filters'
                : 'No breed data available'}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {breeds.map((breed) => (
          <Card key={breed.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getAnimalIcon(breed.animal_type)}
                  <CardTitle className="text-lg">
                    {formatBreedName(breed.name)}
                  </CardTitle>
                </div>
                <Badge variant={breed.is_indigenous ? 'default' : 'secondary'}>
                  {breed.is_indigenous ? 'Indigenous' : 'Exotic'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  <span className="capitalize">{breed.animal_type}</span>
                </div>
                {breed.native_region && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{breed.native_region}</span>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {breed.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {breed.description}
                </p>
              )}

              {breed.characteristics && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Key Characteristics</h4>
                  <div className="space-y-1">
                    {getCharacteristicsList(breed.characteristics).map((char, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{char.label}:</span>
                        <span className="font-medium">{char.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Code: {breed.breed_code.toUpperCase()}</span>
                  <span>Added: {new Date(breed.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
};

export default Breeds;