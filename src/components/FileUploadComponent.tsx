import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, Trash2, Eye, Download } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface UploadedFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  games_count: number;
  processed: boolean;
  created_at: string;
}

interface FileUploadComponentProps {
  onFileUploaded?: (file: UploadedFile) => void;
  acceptedTypes?: string[];
  maxSize?: number; // in bytes
  allowMultiple?: boolean;
}

const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onFileUploaded,
  acceptedTypes = ['.pgn', '.json'],
  maxSize = 50 * 1024 * 1024, // 50MB default
  allowMultiple = false
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [storageUsage, setStorageUsage] = useState<{
    total_files: number;
    total_size: number;
    pgn_files: number;
    pgn_size: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUploadedFiles();
      fetchStorageUsage();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchUploadedFiles = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching uploaded files:', error);
        throw error;
      }
      
      setUploadedFiles(data || []);
    } catch (err) {
      console.error('Error fetching uploaded files:', err);
      setError('Failed to load your uploaded files. Please try refreshing the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorageUsage = async () => {
    try {
      // Create a simple query to get user's file stats
      const { data, error } = await supabase
        .from('uploaded_files')
        .select('file_size, file_type')
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error fetching storage usage:', error);
        return;
      }
      
      const stats = {
        total_files: data?.length || 0,
        total_size: data?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0,
        pgn_files: data?.filter(file => file.file_type === 'pgn').length || 0,
        pgn_size: data?.filter(file => file.file_type === 'pgn').reduce((sum, file) => sum + (file.file_size || 0), 0) || 0
      };
      
      setStorageUsage(stats);
    } catch (err) {
      console.error('Error fetching storage usage:', err);
      // Don't show error for storage usage - it's not critical
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(allowMultiple ? files : [files[0]]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(allowMultiple ? files : [files[0]]);
    }
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const handleFileUpload = async (files: File[]) => {
    if (!user) {
      setError('Please sign in to upload files');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      const uploadedFileRecords: UploadedFile[] = [];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileIndex = i + 1;
        
        console.log(`Processing file ${fileIndex}/${totalFiles}: ${file.name}`);
        
        // Update progress for file start
        const baseProgress = (i / totalFiles) * 100;
        setUploadProgress(baseProgress);
        
        // Validate file
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          setUploading(false);
          return;
        }

        // Update progress for validation complete
        setUploadProgress(baseProgress + (10 / totalFiles));

        // Create file path
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const fileType = fileExtension === 'pgn' ? 'pgn' : 'analysis';
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `users/${user.id}/${fileType}/${fileName}`;

        console.log(`Uploading file: ${fileName} (${formatFileSize(file.size)})`);
        console.log(`Path: ${filePath}`);

        // Update progress for upload start
        setUploadProgress(baseProgress + (20 / totalFiles));

        // Upload to Supabase Storage with progress tracking
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chess-games')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log('File uploaded successfully:', uploadData?.path);

        // Update progress for upload complete
        setUploadProgress(baseProgress + (60 / totalFiles));

        // Create database record
        const { data: fileRecord, error: dbError } = await supabase
          .from('uploaded_files')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            file_type: fileType,
            games_count: 0, // Will be updated after processing
            processed: false,
            metadata: {
              original_name: file.name,
              upload_date: new Date().toISOString(),
              file_extension: fileExtension
            }
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          throw new Error(`Database error: ${dbError.message}`);
        }

        console.log('File record created:', fileRecord);
        
        uploadedFileRecords.push(fileRecord);
        
        // Update progress for file complete
        setUploadProgress(baseProgress + (100 / totalFiles));
      }

      // Final progress update
      setUploadProgress(100);
      setSuccess(`Successfully uploaded ${files.length} file(s)`);
      
      // Refresh file list and storage usage
      await fetchUploadedFiles();
      await fetchStorageUsage();

      // Notify parent component
      if (uploadedFileRecords.length > 0) {
        onFileUploaded?.(uploadedFileRecords[0]);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 2000);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('chess-games')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw new Error(`Storage deletion failed: ${storageError.message}`);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('uploaded_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error(`Database deletion failed: ${dbError.message}`);
      }

      // Refresh file list and storage usage
      await fetchUploadedFiles();
      await fetchStorageUsage();
      
      setSuccess('File deleted successfully');
    } catch (err) {
      console.error('Deletion error:', err);
      setError(err instanceof Error ? err.message : 'Deletion failed');
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('chess-games')
        .download(filePath);

      if (error) {
        console.error('Download error:', error);
        throw new Error(`Download failed: ${error.message}`);
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Storage Usage */}
      {storageUsage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Storage Usage</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Total Files:</span>
              <p className="font-medium">{storageUsage.total_files}</p>
            </div>
            <div>
              <span className="text-blue-700">Total Size:</span>
              <p className="font-medium">{formatFileSize(storageUsage.total_size)}</p>
            </div>
            <div>
              <span className="text-blue-700">PGN Files:</span>
              <p className="font-medium">{storageUsage.pgn_files}</p>
            </div>
            <div>
              <span className="text-blue-700">PGN Size:</span>
              <p className="font-medium">{formatFileSize(storageUsage.pgn_size)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Upload Chess Files
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop your files here, or click to browse
            </p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Choose Files
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes.join(',')}
              multiple={allowMultiple}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          <div className="text-xs text-gray-500">
            Supported: {acceptedTypes.join(', ')} • Max size: {Math.round(maxSize / 1024 / 1024)}MB
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <div className="flex justify-between text-sm text-blue-900 mb-1">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            <span className="text-sm text-green-700">{success}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-4">
          <Loader2 className="w-6 h-6 mx-auto text-blue-500 animate-spin mb-2" />
          <p className="text-gray-500">Loading your files...</p>
        </div>
      )}

      {/* Uploaded Files List */}
      {!isLoading && uploadedFiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Your Uploaded Files</h4>
          </div>
          
          <div className="divide-y divide-gray-200">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {file.file_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.file_size)} • {file.file_type.toUpperCase()} • 
                      {file.processed ? ' Processed' : ' Pending'} • 
                      {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDownloadFile(file.file_path, file.file_name)}
                    className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.id, file.file_path)}
                    className="p-1 text-red-600 hover:text-red-800 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && uploadedFiles.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-600 mb-1">No files uploaded yet</p>
          <p className="text-sm text-gray-500">
            Upload PGN files to analyze your chess games
          </p>
        </div>
      )}
    </div>
  );
};

export default FileUploadComponent;