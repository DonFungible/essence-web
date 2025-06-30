# Dropzone Refactor: NFT Metadata Support & Flickering Fix

## Overview

The training dropzone has been refactored to support custom NFT metadata for each uploaded image and fix the flickering issue when typing in form inputs. The new design uses a 4-column responsive grid layout where users can specify custom names and descriptions for their training images.

## Key Issues Resolved

### ✅ **Flickering Issue Fixed**

**Problem**: Images were flickering when typing in name/description inputs because `URL.createObjectURL()` was being called on every re-render.

**Solution**:

- **Memoized Image URLs**: Used `useMemo` to create object URLs only when the images array changes
- **Proper Cleanup**: Added `useEffect` to revoke object URLs when component unmounts or images change
- **Optimized Re-renders**: Prevented unnecessary re-creation of blob URLs during form interactions

### ✅ **Enhanced Layout & Responsiveness**

- **Wider Form**: Increased from `max-w-3xl` to `max-w-6xl` for better screen space utilization
- **4-Column Grid**: Desktop shows 4 items per row (image, form, image, form)
- **Responsive Design**: Adapts to tablet (2 columns) and mobile (1 column)
- **Image Constraints**: Maximum width of 480px with proper centering

### ✅ **NFT Metadata Support**

- **Custom Names**: Users can specify custom IP names (defaults to filename)
- **Custom Descriptions**: Optional descriptions for NFT metadata (500 char limit)
- **Backend Integration**: Metadata is passed through the upload pipeline to the Story Protocol registration

### ✅ **IP Registration Metadata Enhancement**

- **Image URL Integration**: Added Supabase image URL to IP metadata for proper asset linking
- **Conditional Description**: Description is only included in metadata if provided by user
- **Structured Metadata**: Organized metadata with proper image field structure

## Changes Made

### 1. Updated Data Structure

**Before:**

```typescript
const [images, setImages] = useState<File[]>([])
```

**After:**

```typescript
const [images, setImages] = useState<
  Array<{
    file: File
    name: string
    description: string
  }>
>([])
```

### 2. New UI Layout

The dropzone now displays images in a responsive grid layout:

- **Desktop (large screens)**: 4-column grid (image, form, image, form)
- **Tablet**: 2-column grid
- **Mobile**: Single column
- **Image constraints**: Maximum width of 480px with aspect-square ratio
- **Metadata inputs**:
  - **IP Name**: Defaults to filename, can be customized
  - **IP Description**: Optional field for custom description

### 3. Metadata Handling

#### Frontend (app/train/page.tsx)

- Added `updateImageMetadata()` function to handle name/description changes
- Modified file upload logic to include metadata
- Updated all image array operations to work with new structure

#### Backend (app/api/process-uploaded-files/route.ts)

- Added metadata parameter to API endpoint
- Updated IP registration to use custom metadata:
  - **Title**: Uses custom name or falls back to filename
  - **Description**: Uses custom description or default training image description
  - **Attributes**: Includes file type and original filename

#### Upload Hook (hooks/use-presigned-upload.ts)

- Added metadata parameter to `uploadFiles()` function
- Updated `processUploadedFiles()` to pass metadata to backend

## User Experience

### Default Behavior

- **Name Field**: Pre-populated with filename, user can edit
- **Description Field**: Empty by default, completely optional
- **Placeholder Text**: Shows what will be used if field is left empty

### NFT Creation Logic

- **If name is provided**: Uses custom name for NFT title
- **If name is empty**: Uses original filename
- **If description is provided**: Uses custom description
- **If description is empty**: Omits description from NFT metadata

### Visual Features

- Character count for description field (500 max)
- File size and type display
- Responsive 2-column layout
- Hover effects for remove buttons

## Technical Implementation

### Image URL Management

```typescript
// Memoize image URLs to prevent flickering
const imageUrls = useMemo(() => {
  return images.map((file) => URL.createObjectURL(file))
}, [images])

// Cleanup URLs when component unmounts or images change
useEffect(() => {
  return () => {
    imageUrls.forEach((url) => URL.revokeObjectURL(url))
  }
}, [imageUrls])
```

### State Management

```typescript
const [images, setImages] = useState<File[]>([])
const [imageMetadata, setImageMetadata] = useState<ImageMetadata[]>([])

interface ImageMetadata {
  name: string
  description: string
}

// Update metadata handler
const updateMetadata = (index: number, field: "name" | "description", value: string) => {
  const newMetadata = [...imageMetadata]
  newMetadata[index] = {
    ...newMetadata[index],
    [field]: value,
  }
  setImageMetadata(newMetadata)
}
```

### IP Registration Metadata Structure

```typescript
// Enhanced IPMetadata interface
export interface IPMetadata {
  title: string
  description?: string // Optional - only included if provided
  ipType: "image" | "model"
  image?: {
    imageUrl: string // Supabase public URL
  }
  attributes?: Array<{
    trait_type: string
    value: string
  }>
}

// Metadata creation with conditional description
const ipMetadata: any = {
  title: nftName,
  ipType: "image" as const,
  image: {
    imageUrl: fileInfo.publicUrl, // Supabase URL
  },
  attributes: [
    {
      trait_type: "File Type",
      value: fileInfo.contentType,
    },
    {
      trait_type: "Original Filename",
      value: fileInfo.originalName,
    },
  ],
}

// Only include description if it exists and is not empty
if (nftDescription && nftDescription.trim() !== "") {
  ipMetadata.description = nftDescription.trim()
}
```

### Layout Structure

```jsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
  {images.map((file, index) => (
    <div key={`${file.name}-${index}`} className="space-y-4">
      {/* Image Preview with memoized URL */}
      <div className="aspect-square relative rounded-lg overflow-hidden border max-w-[480px] mx-auto">
        <Image src={imageUrls[index]} alt={`Preview ${index + 1}`} />
      </div>

      {/* Metadata Inputs */}
      <div className="space-y-4">{/* Name and Description inputs */}</div>
    </div>
  ))}
</div>
```

## Performance Improvements

### Before (Issues)

- ❌ `URL.createObjectURL()` called on every render
- ❌ Images flickered during form interactions
- ❌ Memory leaks from unrevoked blob URLs
- ❌ Poor responsive layout on larger screens
- ❌ Missing image URLs in IP metadata
- ❌ Empty descriptions included in metadata

### After (Fixed)

- ✅ Object URLs created only when images change
- ✅ Smooth form interactions without flickering
- ✅ Proper cleanup prevents memory leaks
- ✅ Responsive 4-column grid with 480px max width
- ✅ Optimized for desktop, tablet, and mobile
- ✅ Supabase image URLs included in IP metadata
- ✅ Conditional description inclusion (only when provided)

## Files Modified

- `app/train/page.tsx` - Main dropzone UI with flickering fix and responsive layout
- `hooks/use-presigned-upload.ts` - Upload logic with metadata support
- `app/api/process-uploaded-files/route.ts` - Backend processing with enhanced IP metadata
- `lib/story-protocol.ts` - Server-side IP metadata interface with image URL support
- `lib/story-protocol-client.ts` - Client-side IP metadata interface updates
- `hooks/use-story-ip-registration.ts` - Client-side registration with image URL support
- `docs/DROPZONE_REFACTOR.md` - This documentation

## Next Steps

- [ ] Consider implementing React Hook Form for more advanced form validation (optional)
- [ ] Add image preview zoom functionality
- [ ] Implement drag-and-drop reordering of images
- [ ] Add batch metadata editing for multiple images
- [ ] Implement IPFS upload for metadata storage (production enhancement)

## Testing

The solution has been tested for:

- ✅ No flickering when typing in form inputs
- ✅ Proper URL cleanup on component unmount
- ✅ Responsive layout across different screen sizes
- ✅ Metadata passing through to backend processing
- ✅ Image removal functionality with URL cleanup
- ✅ IP registration with Supabase image URLs
- ✅ Conditional description handling in metadata
- ✅ TypeScript compilation without errors
