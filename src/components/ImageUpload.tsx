import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  onClassificationComplete?: (result: any) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onClassificationComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [animalType, setAnimalType] = useState<'cattle' | 'buffalo'>('cattle');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setError('');
    setProgress(0);
  };

  const uploadAndClassify = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setProgress(10);
    setError('');

    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      setProgress(30);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('animal-images')
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress(50);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('animal-images')
        .getPublicUrl(fileName);

      setProgress(70);

      // Call classification edge function
      const { data: classificationData, error: classificationError } = await supabase.functions
        .invoke('classify-breed', {
          body: {
            image_url: urlData.publicUrl,
            animal_id: `${user.id}-${Date.now()}`,
            user_id: user.id,
            animal_type: animalType,
          },
        });

      if (classificationError) {
        throw new Error(`Classification failed: ${classificationError.message}`);
      }

      setProgress(100);

      toast({
        title: "Classification Complete!",
        description: `Detected breed: ${classificationData.top_prediction.breed} (${(classificationData.top_prediction.confidence * 100).toFixed(1)}% confidence)`,
      });

      if (onClassificationComplete) {
        onClassificationComplete(classificationData);
      }

      // Clear the form after successful upload
      clearFile();

    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Classification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Animal Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Animal Type</label>
            <Select value={animalType} onValueChange={(value: 'cattle' | 'buffalo') => setAnimalType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select animal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cattle">Cattle</SelectItem>
                <SelectItem value="buffalo">Buffalo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload Area */}
          {!selectedFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? 'Drop your image here' : 'Upload Animal Photo'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop an image, or click to select
              </p>
              <Button variant="outline" type="button">
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Supports: JPEG, PNG, WebP (max 10MB)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative">
                <img
                  src={preview!}
                  alt="Upload preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    {progress < 30 ? 'Preparing upload...' :
                     progress < 50 ? 'Uploading image...' :
                     progress < 70 ? 'Getting image URL...' :
                     progress < 100 ? 'Analyzing breed...' : 'Complete!'}
                  </p>
                </div>
              )}

              {/* Upload Button */}
              <Button 
                onClick={uploadAndClassify} 
                disabled={uploading} 
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Classify Breed
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ImageUpload;