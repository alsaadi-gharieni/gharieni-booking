'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAllDevices, createDevice, updateDevice, deleteDevice } from '@/lib/firestore'
import { Device } from '@/types'
import toast from 'react-hot-toast'
import { isAuthenticated } from '@/lib/auth'
import { uploadImage, getDeviceImagePath, deleteImage, extractStoragePathFromUrl } from '@/lib/storage'
import Image from 'next/image'

export default function DevicesManagement() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    link: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/admin/login')
      return
    }
    setAuthChecked(true)
    loadDevices()
  }, [router])

  const loadDevices = async () => {
    try {
      const devicesData = await getAllDevices()
      setDevices(devicesData)
    } catch (error) {
      console.error('Error loading devices:', error)
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Technology name is required')
      return
    }

    // Validate URL if provided
    let validatedLink = formData.link.trim()
    if (validatedLink) {
      try {
        // Add protocol if missing
        const urlWithProtocol = validatedLink.startsWith('http://') || validatedLink.startsWith('https://') 
          ? validatedLink 
          : `https://${validatedLink}`
        new URL(urlWithProtocol)
        validatedLink = urlWithProtocol
      } catch (urlError) {
        toast.error('Please enter a valid URL (e.g., https://example.com)')
        return
      }
    }

    try {
      setUploadingImage(true)
      let imageUrl: string | undefined = editingDevice?.imageUrl

      if (editingDevice) {
        // Editing existing device
        let oldImageUrl: string | undefined = editingDevice.imageUrl
        
        // Upload new image if one was selected
        if (imageFile) {
          try {
            const fileExtension = imageFile.name.split('.').pop() || 'jpg'
            const imagePath = getDeviceImagePath(editingDevice.id, `image.${fileExtension}`)
            imageUrl = await uploadImage(imageFile, imagePath)
            
            // Delete old image if it exists and is different
            if (oldImageUrl && oldImageUrl !== imageUrl) {
              const oldPath = extractStoragePathFromUrl(oldImageUrl)
              if (oldPath) {
                await deleteImage(oldPath).catch(err => {
                  console.warn('Failed to delete old image:', err)
                })
              }
            }
          } catch (imageError) {
            console.error('Error uploading image:', imageError)
            toast.error('Failed to upload image. Please try again.')
            setUploadingImage(false)
            return
          }
        }
        
        try {
          const updateData: any = {
            name: formData.name.trim(),
          }
          
          // Only include fields that have values
          if (formData.description.trim()) {
            updateData.description = formData.description.trim()
          }
          if (imageUrl) {
            updateData.imageUrl = imageUrl
          }
          if (validatedLink) {
            updateData.link = validatedLink
          }
          
          await updateDevice(editingDevice.id, updateData)
          toast.success('Technology updated successfully!')
        } catch (updateError: any) {
          console.error('Error updating device:', updateError)
          const errorMessage = updateError?.message || 'Unknown error occurred'
          toast.error(`Failed to update technology: ${errorMessage}`)
          setUploadingImage(false)
          return
        }
      } else {
        // Creating new device
        let deviceId: string
        try {
          // First create the device without image
          deviceId = await createDevice({
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            link: validatedLink || undefined,
          })
        } catch (createError) {
          console.error('Error creating technology:', createError)
          toast.error('Failed to create technology. Please check your connection and try again.')
          setUploadingImage(false)
          return
        }
        
        // Then upload image if provided
        if (imageFile) {
          try {
            const fileExtension = imageFile.name.split('.').pop() || 'jpg'
            const imagePath = getDeviceImagePath(deviceId, `image.${fileExtension}`)
            imageUrl = await uploadImage(imageFile, imagePath)
            
            // Update device with image URL
            await updateDevice(deviceId, { imageUrl })
          } catch (imageError) {
            console.error('Error uploading image:', imageError)
            toast.error('Technology created but image upload failed. You can edit the technology to add the image later.')
            // Don't return here - device was created successfully
          }
        }
        
        toast.success('Technology created successfully!')
      }
      
      setShowForm(false)
      setEditingDevice(null)
      setFormData({ name: '', description: '', link: '' })
      setImageFile(null)
      setImagePreview(null)
      await loadDevices()
    } catch (error: any) {
      console.error('Error saving device:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      toast.error(`Failed to save device: ${errorMessage}`)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleEdit = (device: Device) => {
    setEditingDevice(device)
    setFormData({
      name: device.name,
      description: device.description || '',
      link: device.link || '',
    })
    setImageFile(null)
    setImagePreview(device.imageUrl || null)
    setShowForm(true)
  }

  const handleDelete = async (deviceId: string, deviceName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${deviceName}"?\n\n` +
      `This action cannot be undone.`
    )
    
    if (!confirmed) {
      return
    }
    
    try {
      // Find the device to get its image URL
      const device = devices.find(d => d.id === deviceId)
      
      // Delete the device from Firestore
      await deleteDevice(deviceId)
      
      // Delete the associated image from Storage if it exists
      if (device?.imageUrl) {
        const imagePath = extractStoragePathFromUrl(device.imageUrl)
        if (imagePath) {
          await deleteImage(imagePath).catch(err => {
            console.warn('Failed to delete device image:', err)
            // Don't fail the whole operation if image deletion fails
          })
        }
      }
      
      toast.success('Technology deleted successfully')
      await loadDevices()
    } catch (error) {
      console.error('Error deleting device:', error)
      toast.error('Failed to delete technology')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingDevice(null)
    setFormData({ name: '', description: '', link: '' })
    setImageFile(null)
    setImagePreview(null)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }
      
      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Technologies List</h1>
          <div className="flex gap-4">
            <Link
              href="/admin"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50"
            >
              ← Back to Dashboard
            </Link>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Add Technology
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingDevice ? 'Edit Technology' : 'Add New Technology'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                  Technology Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="e.g., Massage Chair 1"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="Technology description or notes..."
                />
              </div>

              <div>
                <label htmlFor="link" className="block text-sm font-medium text-gray-900 mb-2">
                  Learn More Link (optional)
                </label>
                <input
                  type="url"
                  id="link"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="https://example.com/technology-info"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Add a link where users can learn more about this technology
                </p>
              </div>

              {/* Image Upload */}
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-900 mb-2">
                  Technology Image (optional)
                </label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-gray-300">
                      <Image
                        src={imagePreview}
                        alt="Technology preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      title="Remove image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="image"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-600">Click to upload image</span>
                      <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50"
                >
                  Cancel
                </button>
                  <button
                  type="submit"
                  disabled={uploadingImage}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? 'Uploading...' : editingDevice ? 'Update Technology' : 'Create Technology'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              All Technologies ({devices.length})
            </h2>
            {devices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-800 mb-4">No technologies yet.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Create Your First Technology
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-indigo-400 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4 flex-1">
                        {device.imageUrl && (
                          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                            <Image
                              src={device.imageUrl}
                              alt={device.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 relative">
                          <h3 className="font-semibold text-gray-900 text-lg pr-24">{device.name}</h3>
                          {device.description && (
                            <p className="text-sm text-gray-700 mt-1">{device.description}</p>
                          )}
                          {device.link && (
                            <a
                              href={device.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute bottom-0 right-0 px-3 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-md text-xs font-medium transition-all shadow-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              🔗 Learn More
                            </a>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Created: {new Date(device.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(device)}
                          className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(device.id, device.name)}
                          className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
